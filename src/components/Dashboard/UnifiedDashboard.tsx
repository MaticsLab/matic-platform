'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  CheckCircle2, Clock, AlertCircle, FileText, ChevronDown, ChevronUp, 
  LogOut, Send, MessageSquare, Calendar, Loader2, FileEdit, Upload, 
  Download, Trash2, Eye, User, ChevronRight
} from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Badge } from '@/ui-components/badge'
import { Textarea } from '@/ui-components/textarea'
import { cn } from '@/lib/utils'
import { Field, Section, PortalConfig } from '@/types/portal'
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter'
import { toast } from 'sonner'
import { portalDashboardClient, PortalActivity, TimelineEvent, ApplicationDashboard } from '@/lib/api/portal-dashboard-client'
import { dashboardClient } from '@/lib/api/dashboard-client'
import type { DashboardSettings } from '@/types/dashboard'

// ═══════════════════════════════════════════════════════════════════════════
// STATUS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  draft: {
    label: 'In Progress',
    icon: <FileEdit className="w-5 h-5" />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  },
  in_progress: {
    label: 'In Progress',
    icon: <FileEdit className="w-5 h-5" />,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50'
  },
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

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DATA FOR PREVIEW MODE
// ═══════════════════════════════════════════════════════════════════════════
const MOCK_TIMELINE = [
  { id: '1', title: 'Application Submitted', time: '2 days ago', type: 'submitted' },
  { id: '2', title: 'Under Review', time: '1 day ago', type: 'status_update' },
  { id: '3', title: 'Documents Received', time: '12 hours ago', type: 'document' },
]

const MOCK_MESSAGES: PortalActivity[] = [
  {
    id: '1',
    row_id: 'mock',
    activity_type: 'message',
    content: 'Welcome! Let us know if you have any questions about your application.',
    visibility: 'both',
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    sender_type: 'staff',
    sender_name: 'Staff',
    is_read: true
  },
  {
    id: '2',
    row_id: 'mock',
    activity_type: 'message',
    content: "Thank you! I'll reach out if I have any questions.",
    visibility: 'both',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    sender_type: 'applicant',
    sender_name: 'You',
    is_read: true
  }
]

const MOCK_DOCUMENTS = [
  { id: '1', name: 'Application Form.pdf', url: '#', uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), size: 245000 }
]

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════
interface UnifiedDashboardProps {
  // Mode: 'preview' for builder, 'live' for actual applicant view
  mode: 'preview' | 'live'
  
  // Dashboard settings (from builder or fetched)
  dashboardSettings: DashboardSettings
  
  // Portal/form info
  portalName: string
  themeColor: string
  logoUrl?: string
  
  // Live mode only props
  config?: PortalConfig
  submissionData?: Record<string, any>
  applicationStatus?: string
  email?: string
  formId?: string
  rowId?: string
  onLogout?: () => void
  onContinueApplication?: () => void
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export function UnifiedDashboard({
  mode,
  dashboardSettings,
  portalName,
  themeColor,
  logoUrl,
  config,
  submissionData = {},
  applicationStatus = 'submitted',
  email = 'applicant@example.com',
  formId,
  rowId,
  onLogout,
  onContinueApplication,
}: UnifiedDashboardProps) {
  const isPreview = mode === 'preview'
  
  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [dashboardData, setDashboardData] = useState<Record<string, any>>({})
  const [isSaving, setIsSaving] = useState(false)
  
  // Activity feed state
  const [activities, setActivities] = useState<PortalActivity[]>(isPreview ? MOCK_MESSAGES : [])
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [isSendingMessage, setIsSendingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Documents state
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; url: string; uploadedAt: string; size?: number }>>(
    isPreview ? MOCK_DOCUMENTS : []
  )
  const [isUploadingDocument, setIsUploadingDocument] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────────────────
  const statusInfo = STATUS_CONFIG[applicationStatus] || STATUS_CONFIG.submitted
  
  // Dashboard settings with fallbacks (check both camelCase and snake_case)
  const showStatusCard = dashboardSettings?.showStatus ?? dashboardSettings?.show_status ?? true
  const showTimeline = dashboardSettings?.showTimeline ?? dashboardSettings?.show_timeline ?? true
  const showMessages = dashboardSettings?.showChat ?? dashboardSettings?.show_chat ?? true
  const showDocuments = dashboardSettings?.showDocuments ?? dashboardSettings?.show_documents ?? true
  const welcomeTitle = dashboardSettings?.welcomeTitle ?? dashboardSettings?.welcome_title ?? ''
  const welcomeText = dashboardSettings?.welcomeText ?? dashboardSettings?.welcome_text ?? ''
  
  // Find dashboard sections and form sections
  const dashboardSections = useMemo(() => {
    if (!config) return []
    return config.sections.filter(s => s.sectionType === 'dashboard')
  }, [config?.sections])

  const formSections = useMemo(() => {
    if (!config) return []
    return config.sections.filter(s => s.sectionType === 'form' || !s.sectionType)
  }, [config?.sections])
  
  // ─────────────────────────────────────────────────────────────────────────
  // DATA FETCHING (Live mode only)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPreview || !rowId) return
    
    const fetchDashboardData = async () => {
      setIsLoadingActivities(true)
      try {
        const dashboard = await portalDashboardClient.getDashboard(rowId)
        setActivities(dashboard.activities || [])
        setTimeline(dashboard.timeline || [])
        await portalDashboardClient.markActivitiesRead(rowId, 'applicant')
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setIsLoadingActivities(false)
      }
    }
    
    fetchDashboardData()
  }, [rowId, isPreview])
  
  // Fetch documents (Live mode only)
  useEffect(() => {
    if (isPreview || !rowId) return
    
    const fetchDocuments = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'}/portal/documents?row_id=${rowId}`
        )
        if (response.ok) {
          const docs = await response.json()
          setDocuments(docs || [])
        }
      } catch (error) {
        console.error('Failed to fetch documents:', error)
      }
    }
    fetchDocuments()
  }, [rowId, isPreview])
  
  // Scroll to bottom of messages when new ones arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activities])
  
  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────
  const handleSendMessage = async () => {
    if (isPreview) return
    if (!newMessage.trim() || !rowId) return

    setIsSendingMessage(true)
    try {
      const activity = await portalDashboardClient.createActivity(rowId, {
        activity_type: 'message',
        content: newMessage.trim(),
        visibility: 'both',
      })
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
  
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPreview) return
    const files = e.target.files
    if (!files || files.length === 0 || !rowId) return

    setIsUploadingDocument(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('row_id', rowId)

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'}/portal/documents`,
          { method: 'POST', body: formData }
        )

        if (response.ok) {
          const doc = await response.json()
          setDocuments(prev => [...prev, doc])
          toast.success(`${file.name} uploaded successfully`)
        } else {
          throw new Error('Upload failed')
        }
      }
    } catch (error) {
      console.error('Failed to upload document:', error)
      toast.error('Failed to upload document. Please try again.')
    } finally {
      setIsUploadingDocument(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  
  const handleDeleteDocument = async (documentId: string, documentName: string) => {
    if (isPreview) return
    if (!confirm(`Are you sure you want to delete "${documentName}"?`)) return
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'}/portal/documents/${documentId}`,
        { method: 'DELETE' }
      )
      
      if (response.ok) {
        setDocuments(prev => prev.filter(d => d.id !== documentId))
        toast.success('Document deleted')
      } else {
        throw new Error('Delete failed')
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
      toast.error('Failed to delete document')
    }
  }
  
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
    return date.toLocaleDateString()
  }

  const getFieldDisplayValue = (field: Field, value: any): string => {
    if (value === undefined || value === null || value === '') return '—'
    if (field.type === 'checkbox') return value ? 'Yes' : 'No'
    if (field.type === 'select' || field.type === 'radio') {
      const options = field.options || field.config?.items || []
      const option = options.find((o: any) => o.value === value || o === value)
      return option?.label || option || value
    }
    if (Array.isArray(value)) return value.join(', ')
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full bg-gray-50 overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={portalName} className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <div 
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: themeColor }}
              >
                {portalName.charAt(0)}
              </div>
            )}
            <div>
              <span className="font-semibold text-gray-900">{portalName}</span>
              {!isPreview && email && (
                <p className="text-sm text-gray-500">{email}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Continue Application Button (Live mode only) */}
            {!isPreview && onContinueApplication && ['draft', 'pending', 'in_progress', 'revision_requested'].includes(applicationStatus) && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={onContinueApplication}
                style={{ backgroundColor: themeColor }}
                className="text-white hover:opacity-90 shadow-md font-medium"
              >
                <FileEdit className="w-4 h-4 mr-2" />
                {applicationStatus === 'revision_requested' ? 'Edit & Resubmit Application' : 'Return to Application'}
              </Button>
            )}
            {/* User button / Sign out */}
            {isPreview ? (
              <Button variant="ghost" size="sm" className="text-gray-600" disabled>
                <User className="w-4 h-4 mr-2" />
                John Doe
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Welcome Section */}
        {(welcomeTitle || welcomeText || isPreview) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {welcomeTitle || 'Welcome to Your Dashboard'}
            </h1>
            <p className="text-gray-600">
              {welcomeText || 'Track your application progress and communicate with our team.'}
            </p>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            {showStatusCard && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
              >
                <Card className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2.5 rounded-full", statusInfo.bgColor, statusInfo.color)}>
                          {statusInfo.icon}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Application Status</p>
                          <p className="text-base font-semibold text-gray-900">{statusInfo.label}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-sm", statusInfo.color, statusInfo.bgColor)}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Timeline */}
            {showTimeline && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Activity Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {(isPreview ? MOCK_TIMELINE : timeline).length > 0 ? (
                      <div className="space-y-4">
                        {(isPreview ? MOCK_TIMELINE : timeline).map((event: any, index: number, arr: any[]) => (
                          <div key={event.id || index} className="flex items-start gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn(
                                "w-2.5 h-2.5 rounded-full mt-1.5",
                                event.type === 'submitted' ? 'bg-green-500' : 
                                event.type === 'status_update' ? 'bg-blue-500' : 
                                event.type === 'stage_change' ? 'bg-yellow-500' : 'bg-purple-500'
                              )} />
                              {index < arr.length - 1 && <div className="w-0.5 h-8 bg-gray-200 mt-1" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{event.title}</p>
                              {event.content && (
                                <p className="text-xs text-gray-500 mt-0.5">{event.content}</p>
                              )}
                              <p className="text-xs text-gray-400">{event.time || (event.timestamp && formatTimestamp(event.timestamp))}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">No activity yet</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Messages */}
            {showMessages && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Messages
                    </CardTitle>
                    <CardDescription>Communicate with our team</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Messages List */}
                    <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                      {(isPreview ? MOCK_MESSAGES : activities.filter(a => a.activity_type === 'message')).length > 0 ? (
                        (isPreview ? MOCK_MESSAGES : activities.filter(a => a.activity_type === 'message')).map((activity) => {
                          const isStaff = activity.sender_type === 'staff'
                          return (
                            <div key={activity.id} className={cn("flex", isStaff ? "justify-start" : "justify-end")}>
                              <div 
                                className={cn(
                                  "max-w-[80%] rounded-lg px-3 py-2",
                                  isStaff 
                                    ? "bg-gray-100 text-gray-900" 
                                    : "text-white"
                                )}
                                style={!isStaff ? { backgroundColor: themeColor } : undefined}
                              >
                                {isStaff && (
                                  <p className="text-xs font-medium mb-0.5 text-gray-500">
                                    {activity.sender_name || 'Staff'}
                                  </p>
                                )}
                                <p className="text-sm">{activity.content}</p>
                                <p className={cn("text-xs mt-1", isStaff ? "text-gray-400" : "opacity-70")}>
                                  {formatTimestamp(activity.created_at)}
                                </p>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-sm text-gray-500 text-center py-4">
                          No messages yet. Send a message to get started.
                        </p>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                    
                    {/* Message Input */}
                    <div className="flex gap-2 pt-4 border-t border-gray-100">
                      <Textarea 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..." 
                        className="flex-1 min-h-[60px] text-sm resize-none"
                        disabled={isPreview || isSendingMessage}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            handleSendMessage()
                          }
                        }}
                      />
                      <Button 
                        size="sm" 
                        className="self-end text-white"
                        style={{ backgroundColor: themeColor }}
                        onClick={handleSendMessage}
                        disabled={isPreview || isSendingMessage || !newMessage.trim()}
                      >
                        {isSendingMessage ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Documents */}
            {showDocuments && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Documents
                      </CardTitle>
                      {!isPreview && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingDocument}
                          className="h-7 text-xs"
                        >
                          {isUploadingDocument ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Upload className="w-3 h-3 mr-1" />
                          )}
                          Upload
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {!isPreview && (
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                        onChange={handleDocumentUpload}
                      />
                    )}
                    
                    {documents.length > 0 ? (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div 
                            key={doc.id}
                            className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                                <p className="text-xs text-gray-400">
                                  {formatTimestamp(doc.uploadedAt)}
                                  {doc.size && ` • ${Math.round(doc.size / 1024)}KB`}
                                </p>
                              </div>
                              {!isPreview && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                      <Eye className="w-3.5 h-3.5 text-gray-500" />
                                    </a>
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                                    <a href={doc.url} download={doc.name}>
                                      <Download className="w-3.5 h-3.5 text-gray-500" />
                                    </a>
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 w-7 p-0 hover:text-red-500"
                                    onClick={() => handleDeleteDocument(doc.id, doc.name)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div 
                        className={cn(
                          "border-2 border-dashed border-gray-200 rounded-lg p-4 text-center transition-colors",
                          !isPreview && "cursor-pointer hover:border-gray-300"
                        )}
                        onClick={() => !isPreview && fileInputRef.current?.click()}
                      >
                        <Upload className="w-5 h-5 text-gray-400 mx-auto mb-2" />
                        <p className="text-xs text-gray-500">
                          {isPreview ? 'Upload additional documents' : 'Click to upload documents'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Quick Actions (Live mode only, when applicable) */}
            {!isPreview && onContinueApplication && ['draft', 'pending', 'in_progress', 'revision_requested'].includes(applicationStatus) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.25 }}
              >
                <Card className="shadow-sm border-l-4" style={{ borderLeftColor: themeColor }}>
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg" style={{ backgroundColor: `${themeColor}15` }}>
                          <FileEdit className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {applicationStatus === 'revision_requested' 
                              ? 'Action Required' 
                              : 'Complete Your Application'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {applicationStatus === 'revision_requested'
                              ? 'Please review and address the requested changes to your application.'
                              : 'Continue where you left off and submit your application.'}
                          </p>
                        </div>
                      </div>
                      <Button 
                        className="w-full justify-between font-medium shadow-sm"
                        size="lg"
                        onClick={onContinueApplication}
                        style={{ backgroundColor: themeColor }}
                      >
                        <span>{applicationStatus === 'revision_requested' ? 'Edit & Resubmit Application' : 'Return to Application'}</span>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Your Application (Live mode only) */}
            {!isPreview && config && formSections.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <CardTitle className="text-sm">Your Application</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {formSections.map((section, index) => {
                      const isExpanded = expandedSections.has(section.id)
                      const sectionFields = section.fields || []
                      const hasData = sectionFields.some(f => submissionData[f.id] !== undefined && submissionData[f.id] !== '')
                      if (!hasData && sectionFields.length > 0) return null

                      return (
                        <div key={section.id} className={cn("border-b border-gray-100 last:border-0", index > 0 && "pt-3")}>
                          <button
                            onClick={() => toggleSection(section.id)}
                            className="w-full flex items-center justify-between py-2 text-left hover:bg-gray-50 rounded-lg px-2 -mx-2 transition-colors"
                          >
                            <span className="text-sm font-medium text-gray-900">{section.title}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="pb-3"
                            >
                              <div className="space-y-2 pl-2">
                                {sectionFields.map((field) => {
                                  const value = submissionData[field.id]
                                  if (['heading', 'paragraph', 'divider', 'callout'].includes(field.type)) return null
                                  
                                  return (
                                    <div key={field.id} className="flex flex-col gap-0.5">
                                      <span className="text-xs text-gray-500">{field.label}</span>
                                      <span className="text-sm text-gray-900">{getFieldDisplayValue(field, value)}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Preview Badge */}
      {isPreview && (
        <div className="fixed bottom-4 right-4 bg-black/80 text-white px-3 py-1.5 rounded-full text-xs font-medium">
          Dashboard Preview
        </div>
      )}
    </div>
  )
}
