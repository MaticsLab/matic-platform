/**
 * Applicant Dashboard Page
 * Shows application status, timeline, and chat for portal users
 */

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  FileText,
  Send,
  ChevronRight,
  AlertCircle,
  User,
  Building2
} from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui-components/card'
import { Input } from '@/ui-components/input'
import { Badge } from '@/ui-components/badge'
import { cn } from '@/lib/utils'
import { dashboardClient } from '@/lib/api/dashboard-client'
import type {
  ApplicantDashboard,
  PortalActivity,
  DashboardSection,
  TimelineEvent
} from '@/types/dashboard'
import { toast } from 'sonner'

interface ApplicantDashboardPageProps {
  applicationId: string
  portalToken?: string
}

export function ApplicantDashboardPage({ applicationId, portalToken }: ApplicantDashboardPageProps) {
  const [dashboard, setDashboard] = useState<ApplicantDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadDashboard()
  }, [applicationId])

  const loadDashboard = async () => {
    try {
      setIsLoading(true)
      const data = await dashboardClient.getApplicantDashboard(applicationId, portalToken)
      setDashboard(data)
      
      // Mark all activities as read by applicant
      if (data.activities.length > 0) {
        await dashboardClient.markActivitiesRead(applicationId, 'all', 'applicant', portalToken)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return

    setIsSending(true)
    try {
      const newActivity = await dashboardClient.createActivity(
        applicationId,
        {
          activityType: 'message',
          content: message.trim(),
          visibility: 'both'
        },
        portalToken
      )
      
      setDashboard(prev => prev ? {
        ...prev,
        activities: [newActivity, ...prev.activities]
      } : null)
      
      setMessage('')
      toast.success('Message sent')
      
      // Scroll to bottom of chat
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unable to Load Dashboard</h2>
            <p className="text-gray-500 mb-4">{error || 'Something went wrong'}</p>
            <Button onClick={loadDashboard}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { application, layout, activities, timeline } = dashboard

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {layout.settings.welcomeTitle || 'Your Application Dashboard'}
              </h1>
              <p className="text-gray-500 mt-1">
                {layout.settings.welcomeText || `Application for ${application.formName}`}
              </p>
            </div>
            <StatusBadge status={application.status} stageName={application.stageName} stageColor={application.stageColor} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Status & Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            {layout.settings.showStatus && (
              <StatusCard application={application} />
            )}

            {/* Timeline */}
            {layout.settings.showTimeline && timeline.length > 0 && (
              <TimelineCard events={timeline} />
            )}

            {/* Custom Sections */}
            {layout.sections
              .filter(s => s.type === 'fields' || s.type === 'info')
              .map(section => (
                <FieldsSection
                  key={section.id}
                  section={section}
                  data={application.data}
                />
              ))
            }
          </div>

          {/* Right Column - Chat */}
          <div className="space-y-6">
            {layout.settings.showChat && (
              <ChatCard
                activities={activities}
                message={message}
                setMessage={setMessage}
                onSend={handleSendMessage}
                isSending={isSending}
                chatEndRef={chatEndRef}
              />
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <FileText className="w-4 h-4" />
                  View Application
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

// Sub-components

function StatusBadge({ status, stageName, stageColor }: { status: string; stageName?: string; stageColor?: string }) {
  const getStatusStyles = () => {
    switch (status?.toLowerCase()) {
      case 'approved':
      case 'accepted':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'pending':
      case 'in_review':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }

  return (
    <div className="flex items-center gap-2">
      {stageName && (
        <Badge
          variant="outline"
          style={{ borderColor: stageColor, color: stageColor }}
        >
          {stageName}
        </Badge>
      )}
      <Badge className={cn('border', getStatusStyles())}>
        {status || 'Submitted'}
      </Badge>
    </div>
  )
}

function StatusCard({ application }: { application: ApplicantDashboard['application'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          Application Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-500">Form</p>
            <p className="font-medium">{application.formName}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-medium capitalize">{application.status || 'Submitted'}</p>
          </div>
          {application.stageName && (
            <div>
              <p className="text-sm text-gray-500">Current Stage</p>
              <p className="font-medium">{application.stageName}</p>
            </div>
          )}
          {application.submittedAt && (
            <div>
              <p className="text-sm text-gray-500">Submitted</p>
              <p className="font-medium">
                {new Date(application.submittedAt).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TimelineCard({ events }: { events: TimelineEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.slice(0, 5).map((event, index) => (
            <div key={event.id} className="flex gap-3">
              <div className="relative">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  event.type === 'submitted' ? 'bg-green-100 text-green-600' :
                  event.type === 'message' ? 'bg-blue-100 text-blue-600' :
                  'bg-gray-100 text-gray-600'
                )}>
                  {event.type === 'submitted' ? <CheckCircle2 className="w-4 h-4" /> :
                   event.type === 'message' ? <MessageSquare className="w-4 h-4" /> :
                   <ChevronRight className="w-4 h-4" />}
                </div>
                {index < events.length - 1 && (
                  <div className="absolute top-8 left-4 w-px h-full -translate-x-1/2 bg-gray-200" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <p className="font-medium text-sm">{event.title}</p>
                {event.content && (
                  <p className="text-sm text-gray-500 mt-1">{event.content}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function FieldsSection({ section, data }: { section: DashboardSection; data: Record<string, unknown> }) {
  const displayFields = section.fields?.length
    ? section.fields.filter(f => data[f] !== undefined)
    : Object.keys(data).slice(0, 6)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{section.title}</CardTitle>
        {section.description && (
          <CardDescription>{section.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {displayFields.map(fieldId => (
            <div key={fieldId}>
              <p className="text-sm text-gray-500 capitalize">
                {fieldId.replace(/_/g, ' ')}
              </p>
              <p className="font-medium">
                {String(data[fieldId] ?? '-')}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function ChatCard({
  activities,
  message,
  setMessage,
  onSend,
  isSending,
  chatEndRef
}: {
  activities: PortalActivity[]
  message: string
  setMessage: (m: string) => void
  onSend: () => void
  isSending: boolean
  chatEndRef: React.RefObject<HTMLDivElement>
}) {
  const messages = activities
    .filter(a => a.activityType === 'message')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="w-4 h-4" />
          Messages
        </CardTitle>
      </CardHeader>
      
      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Send a message to get started</p>
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.senderType === 'applicant' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2",
                  msg.senderType === 'applicant'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                )}
              >
                <div className="flex items-center gap-1 mb-1">
                  {msg.senderType === 'applicant' ? (
                    <User className="w-3 h-3" />
                  ) : (
                    <Building2 className="w-3 h-3" />
                  )}
                  <span className="text-xs opacity-75">
                    {msg.senderType === 'applicant' ? 'You' : 'Staff'}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
                <p className={cn(
                  "text-xs mt-1",
                  msg.senderType === 'applicant' ? 'text-blue-200' : 'text-gray-400'
                )}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
            disabled={isSending}
          />
          <Button onClick={onSend} disabled={isSending || !message.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ApplicantDashboardPage
