'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, AlertCircle, FileText, ChevronDown, ChevronUp, LogOut, Send, MessageSquare, Calendar, Loader2, FileEdit } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Badge } from '@/ui-components/badge'
import { Textarea } from '@/ui-components/textarea'
import { cn } from '@/lib/utils'
import { Field, Section, PortalConfig } from '@/types/portal'
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter'
import { toast } from 'sonner'
import { portalDashboardClient, PortalActivity, TimelineEvent, ApplicationDashboard } from '@/lib/api/portal-dashboard-client'

interface ApplicantDashboardProps {
  config: PortalConfig
  submissionData: Record<string, any>
  applicationStatus?: string
  email: string
  formId: string
  rowId?: string // The application/row ID for fetching activities
  onLogout: () => void
  onContinueApplication?: () => void // Called when user wants to continue editing their application
  themeColor?: string
}

// Status display configuration
const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  submitted: { 
    label: 'Submitted', 
    icon: <CheckCircle2 className="w-5 h-5" />, 
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  under_review: { 
    label: 'Under Review', 
    icon: <Clock className="w-5 h-5" />, 
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50'
  },
  approved: { 
    label: 'Approved', 
    icon: <CheckCircle2 className="w-5 h-5" />, 
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  rejected: { 
    label: 'Rejected', 
    icon: <AlertCircle className="w-5 h-5" />, 
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  pending: { 
    label: 'Pending', 
    icon: <Clock className="w-5 h-5" />, 
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  },
  revision_requested: { 
    label: 'Revision Requested', 
    icon: <FileEdit className="w-5 h-5" />, 
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
}

export function ApplicantDashboard({ 
  config, 
  submissionData, 
  applicationStatus = 'submitted',
  email,
  formId,
  rowId,
  onLogout,
  onContinueApplication,
  themeColor = '#000'
}: ApplicantDashboardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [dashboardData, setDashboardData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)
  
  // Activity feed state
  const [activities, setActivities] = useState<PortalActivity[]>([])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Dashboard layout from builder (fetched from backend)
  const [dashboardLayout, setDashboardLayout] = useState<ApplicationDashboard['layout'] | null>(null)

  // Fetch dashboard data including activities AND layout from builder
  useEffect(() => {
    if (rowId) {
      fetchDashboardData()
    }
  }, [rowId])

  const fetchDashboardData = async () => {
    if (!rowId) return
    
    setIsLoadingActivities(true)
    try {
      const dashboard = await portalDashboardClient.getDashboard(rowId)
      setActivities(dashboard.activities || [])
      setTimeline(dashboard.timeline || [])
      // Store the layout from the dashboard builder
      if (dashboard.layout) {
        setDashboardLayout(dashboard.layout)
      }
      
      // Mark activities as read
      await portalDashboardClient.markActivitiesRead(rowId, 'applicant')
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      // Non-critical error, just show empty activities
    } finally {
      setIsLoadingActivities(false)
    }
  }
  
  // Determine which sections to show based on dashboard layout settings
  const showStatusCard = dashboardLayout?.settings?.show_status_badge !== false
  const showTimeline = dashboardLayout?.settings?.show_timeline !== false  
  const showMessages = dashboardLayout?.settings?.allow_messages !== false

  // Scroll to bottom of messages when new ones arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activities])

  // Get status display info
  const statusInfo = STATUS_CONFIG[applicationStatus] || STATUS_CONFIG.submitted

  // Find dashboard sections (sectionType === 'dashboard')
  const dashboardSections = useMemo(() => {
    return config.sections.filter(s => s.sectionType === 'dashboard')
  }, [config.sections])

  // Find form sections (for displaying submitted data)
  const formSections = useMemo(() => {
    return config.sections.filter(s => s.sectionType === 'form' || !s.sectionType)
  }, [config.sections])

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  // Get display value for a field
  const getFieldDisplayValue = (field: Field, value: any): string => {
    if (value === undefined || value === null || value === '') {
      return '—'
    }
    
    if (field.type === 'checkbox') {
      return value ? 'Yes' : 'No'
    }
    
    if (field.type === 'multiselect' && Array.isArray(value)) {
      return value.join(', ')
    }
    
    if (field.type === 'date' || field.type === 'datetime') {
      try {
        return new Date(value).toLocaleDateString()
      } catch {
        return String(value)
      }
    }
    
    if (field.type === 'file' || field.type === 'image') {
      if (typeof value === 'string' && value.startsWith('http')) {
        return 'File uploaded'
      }
      return 'File attached'
    }
    
    return String(value)
  }

  // Handle saving dashboard section data
  const handleSaveDashboardData = async () => {
    if (Object.keys(dashboardData).length === 0) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)
    try {
      // Merge dashboard data with existing submission
      const mergedData = { ...submissionData, ...dashboardData }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'}/forms/${formId}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: mergedData, email })
        }
      )

      if (!response.ok) {
        throw new Error('Failed to save')
      }

      toast.success('Information saved successfully!')
      setDashboardData({})
    } catch (error) {
      console.error('Failed to save dashboard data:', error)
      toast.error('Failed to save. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !rowId) return

    setIsSendingMessage(true)
    try {
      const activity = await portalDashboardClient.createActivity(rowId, {
        activity_type: 'message',
        content: newMessage.trim(),
        visibility: 'both',
      })
      
      // Add to local state
      setActivities(prev => [activity, ...prev])
      setNewMessage('')
      toast.success('Message sent!')
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error('Failed to send message. Please try again.')
    } finally {
      setIsSendingMessage(false)
    }
  }

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config.settings.logoUrl && (
              <img 
                src={config.settings.logoUrl} 
                alt="Logo" 
                className="h-8 w-auto"
              />
            )}
            <div>
              <h1 className="font-semibold text-gray-900">{config.settings.name}</h1>
              <p className="text-sm text-gray-500">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onContinueApplication && applicationStatus === 'revision_requested' && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={onContinueApplication}
                style={{ backgroundColor: themeColor }}
                className="text-white"
              >
                <FileEdit className="w-4 h-4 mr-2" />
                Edit & Resubmit
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Status Card - controlled by dashboard builder settings */}
        {showStatusCard && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-full", statusInfo.bgColor, statusInfo.color)}>
                      {statusInfo.icon}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Application Status</p>
                      <p className="text-lg font-semibold text-gray-900">{statusInfo.label}</p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn("text-sm", statusInfo.color)}
                  >
                    {statusInfo.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Dashboard Sections (Additional Data Collection) */}
        {dashboardSections.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-6"
          >
            {dashboardSections.map((section) => (
              <Card key={section.id} className="mb-4">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{section.title}</CardTitle>
                  {section.description && (
                    <CardDescription>{section.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-12 gap-4">
                    {(section.fields || []).map((field: Field) => (
                      <div 
                        key={field.id} 
                        className={cn(
                          field.width === 'half' ? 'col-span-12 sm:col-span-6' : 
                          field.width === 'third' ? 'col-span-12 sm:col-span-4' :
                          field.width === 'quarter' ? 'col-span-12 sm:col-span-3' :
                          'col-span-12'
                        )}
                      >
                        <PortalFieldAdapter
                          field={field}
                          value={dashboardData[field.id] ?? submissionData[field.id]}
                          onChange={(val) => setDashboardData(prev => ({ ...prev, [field.id]: val }))}
                          themeColor={themeColor}
                          formId={formId}
                          allFields={section.fields}
                          formData={{ ...submissionData, ...dashboardData }}
                        />
                      </div>
                    ))}
                  </div>
                  
                  {section.fields && section.fields.length > 0 && (
                    <div className="flex justify-end pt-4 border-t">
                      <Button
                        onClick={handleSaveDashboardData}
                        disabled={isSaving || Object.keys(dashboardData).length === 0}
                        style={{ backgroundColor: themeColor }}
                        className="text-white"
                      >
                        {isSaving ? (
                          'Saving...'
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Save Information
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Activity Feed / Messages */}
        {rowId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="mb-6"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-gray-500" />
                  <CardTitle className="text-lg">Messages & Updates</CardTitle>
                </div>
                <CardDescription>
                  Communicate with the review team and see updates on your application
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Timeline - controlled by dashboard builder settings */}
                {showTimeline && timeline.length > 0 && (
                  <div className="mb-6 pb-4 border-b border-gray-100">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Timeline
                    </h4>
                    <div className="space-y-2">
                      {timeline.map((event, index) => (
                        <div key={event.id} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className={cn(
                              "w-2 h-2 rounded-full mt-1.5",
                              event.type === 'submitted' ? 'bg-blue-500' :
                              event.type === 'status_update' ? 'bg-yellow-500' :
                              event.type === 'stage_change' ? 'bg-green-500' :
                              'bg-gray-400'
                            )} />
                            {index < timeline.length - 1 && (
                              <div className="w-0.5 h-6 bg-gray-200" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{event.title}</p>
                            {event.content && (
                              <p className="text-sm text-gray-500 mt-0.5">{event.content}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatTimestamp(event.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages - controlled by dashboard builder settings */}
                {showMessages && (
                  <div className="space-y-4">
                    {isLoadingActivities ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    ) : activities.filter(a => a.activity_type === 'message').length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {activities
                          .filter(a => a.activity_type === 'message')
                          .reverse()
                          .map((activity) => (
                            <div 
                              key={activity.id}
                              className={cn(
                                "flex",
                                activity.sender_type === 'applicant' ? 'justify-end' : 'justify-start'
                              )}
                            >
                              <div className={cn(
                                "max-w-[80%] rounded-lg px-4 py-2",
                                activity.sender_type === 'applicant' 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-gray-100 text-gray-900'
                              )}>
                                {activity.sender_type === 'staff' && (
                                  <p className="text-xs font-medium mb-1 opacity-70">
                                    {activity.sender_name || 'Staff'}
                                  </p>
                                )}
                                <p className="text-sm whitespace-pre-wrap">{activity.content}</p>
                                <p className={cn(
                                  "text-xs mt-1",
                                  activity.sender_type === 'applicant' 
                                    ? 'text-blue-100' 
                                    : 'text-gray-400'
                                )}>
                                  {formatTimestamp(activity.created_at)}
                                </p>
                              </div>
                            </div>
                          ))
                        }
                        <div ref={messagesEndRef} />
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No messages yet. Send a message to get started.
                      </p>
                    )}

                    {/* Message Input */}
                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 min-h-[80px] resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim() || isSendingMessage}
                        style={{ backgroundColor: themeColor }}
                        className="text-white self-end"
                      >
                        {isSendingMessage ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Submitted Application (Read-only) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                <CardTitle className="text-lg">Your Application</CardTitle>
              </div>
              <CardDescription>
                Review your submitted application details below
              </CardDescription>
            </CardHeader>
            <CardContent>
              {formSections.map((section, index) => {
                const isExpanded = expandedSections.has(section.id)
                const sectionFields = section.fields || []
                
                // Skip sections with no submitted data
                const hasData = sectionFields.some(f => submissionData[f.id] !== undefined && submissionData[f.id] !== '')
                if (!hasData && sectionFields.length > 0) return null

                return (
                  <div key={section.id} className={cn("border-b border-gray-100 last:border-0", index > 0 && "pt-4")}>
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      <span className="font-medium text-gray-900">{section.title}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="pb-4"
                      >
                        <div className="space-y-3 pl-2">
                          {sectionFields.map((field) => {
                            const value = submissionData[field.id]
                            // Skip display-only fields
                            if (['heading', 'paragraph', 'divider', 'callout'].includes(field.type)) {
                              return null
                            }
                            
                            return (
                              <div key={field.id} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
                                <span className="text-sm text-gray-500 sm:w-1/3 sm:text-right">
                                  {field.label}
                                </span>
                                <span className="text-sm text-gray-900 sm:w-2/3 font-medium">
                                  {getFieldDisplayValue(field, value)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )
              })}

              {formSections.length === 0 && (
                <p className="text-gray-500 text-center py-8">
                  No application data available
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  )
}
