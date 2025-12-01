'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  X, Mail, Send, Clock, CheckCircle, AlertCircle, 
  Eye, RefreshCw, ChevronDown, MessageSquare,
  Activity, FileText, User, Calendar, MailOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { emailClient, SentEmail, ActivityItem, SendEmailRequest, GmailConnection } from '@/lib/api/email-client'
import { RichTextEditor } from '@/components/PortalBuilder/RichTextEditor'
import { Badge } from '@/ui-components/badge'

interface ApplicationData {
  id: string
  name: string
  email: string
  submittedAt: string
  stageId: string
  stageName: string
  status: string
  raw_data: Record<string, unknown>
}

// Helper to extract email from application data
function getApplicantEmail(application: ApplicationData): string {
  // First check the email property
  if (application.email) return application.email
  
  // Then check raw_data for various email fields
  const data = application.raw_data || {}
  const emailFields = [
    '_applicant_email', 'email', 'Email', 'EMAIL',
    'personal_email', 'personalEmail', 'work_email', 'workEmail',
    'contact_email', 'contactEmail', 'email_address', 'emailAddress'
  ]
  
  for (const field of emailFields) {
    const value = data[field]
    if (typeof value === 'string' && value.includes('@')) {
      return value
    }
  }
  
  // Search all fields for email-like values
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && value.includes('@') && value.includes('.')) {
      return value
    }
  }
  
  return ''
}

interface ApplicationContactPanelProps {
  application: ApplicationData
  workspaceId: string
  formId: string | null
  onClose: () => void
}

type TabType = 'compose' | 'history' | 'activity'

// Thread info for replying
interface ReplyThread {
  threadId: string
  messageId: string
  references: string
}

export function ApplicationContactPanel({ 
  application, 
  workspaceId, 
  formId,
  onClose 
}: ApplicationContactPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('compose')
  
  // Email compose state
  const [subject, setSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)
  const [replyThread, setReplyThread] = useState<ReplyThread | null>(null) // Track thread for replies
  
  // Gmail connection
  const [gmailConnection, setGmailConnection] = useState<GmailConnection | null>(null)
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)
  
  // Email history
  const [emailHistory, setEmailHistory] = useState<SentEmail[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null)
  
  // Activity log
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [isLoadingActivity, setIsLoadingActivity] = useState(false)

  // Check Gmail connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setIsCheckingConnection(true)
        const connection = await emailClient.getConnection(workspaceId)
        console.log('[ContactPanel] Gmail connection:', connection)
        setGmailConnection(connection)
      } catch (error: any) {
        console.error('Failed to check Gmail connection:', error?.message || error)
        // If it's an auth error, the connection check failed but Gmail might still be connected
        // Set a default disconnected state
        setGmailConnection({ connected: false, email: '' })
      } finally {
        setIsCheckingConnection(false)
      }
    }
    checkConnection()
  }, [workspaceId])

  // Load email history for this submission
  const loadEmailHistory = useCallback(async () => {
    if (!application.id) return
    setIsLoadingHistory(true)
    try {
      const history = await emailClient.getSubmissionHistory(application.id, workspaceId)
      setEmailHistory(history || [])
    } catch (error) {
      console.error('Failed to load email history:', error)
      setEmailHistory([])
    } finally {
      setIsLoadingHistory(false)
    }
  }, [application.id, workspaceId])

  // Load activity log
  const loadActivity = useCallback(async () => {
    if (!application.id) return
    setIsLoadingActivity(true)
    try {
      const activityLog = await emailClient.getSubmissionActivity(application.id, workspaceId)
      setActivities(activityLog || [])
    } catch (error) {
      console.error('Failed to load activity:', error)
      setActivities([])
    } finally {
      setIsLoadingActivity(false)
    }
  }, [application.id, workspaceId])

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'history') {
      loadEmailHistory()
    } else if (activeTab === 'activity') {
      loadActivity()
    }
  }, [activeTab, loadEmailHistory, loadActivity])

  // Handle sending email
  const handleSendEmail = async () => {
    if (!gmailConnection?.connected) {
      setSendResult({ success: false, message: 'Please connect your Gmail account first.' })
      return
    }

    if (!subject.trim() || !messageBody.trim()) {
      setSendResult({ success: false, message: 'Please enter a subject and message.' })
      return
    }

    setIsSending(true)
    setSendResult(null)

    try {
      const request: SendEmailRequest = {
        form_id: formId || undefined,
        submission_ids: [application.id],
        subject: subject,
        body: messageBody,
        is_html: true,
        merge_tags: true,
        track_opens: true,
        // Include thread info if this is a reply
        ...(replyThread && {
          thread_id: replyThread.threadId,
          in_reply_to: replyThread.messageId,
          references: replyThread.references,
        }),
      }

      const result = await emailClient.send(workspaceId, request)

      if (result.success && result.sent_count > 0) {
        setSendResult({ success: true, message: replyThread ? 'Reply sent successfully!' : 'Email sent successfully!' })
        setSubject('')
        setMessageBody('')
        setReplyThread(null) // Clear thread info after sending
        // Refresh history
        loadEmailHistory()
      } else {
        setSendResult({ 
          success: false, 
          message: result.errors?.length ? result.errors[0] : 'Failed to send email.'
        })
      }
    } catch (error) {
      console.error('Failed to send email:', error)
      setSendResult({ success: false, message: 'Failed to send email. Please try again.' })
    } finally {
      setIsSending(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'opened': return 'bg-green-100 text-green-700'
      case 'sent': return 'bg-blue-100 text-blue-700'
      case 'delivered': return 'bg-blue-100 text-blue-700'
      case 'received': return 'bg-purple-100 text-purple-700'
      case 'bounced': return 'bg-red-100 text-red-700'
      case 'failed': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email_sent': return <Mail className="w-4 h-4 text-blue-500" />
      case 'email_opened': return <MailOpen className="w-4 h-4 text-green-500" />
      case 'email_clicked': return <Eye className="w-4 h-4 text-purple-500" />
      case 'status_change': return <Activity className="w-4 h-4 text-orange-500" />
      case 'review_added': return <FileText className="w-4 h-4 text-indigo-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  // Get available merge tags from application data
  const mergeTags = Object.entries(application.raw_data || {}).map(([key, value]) => ({
    label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    tag: `{{${key}}}`
  })).slice(0, 20) // Limit to 20 tags

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/30 transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Panel */}
      <div className="absolute right-2 top-2 bottom-2 w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Contact</h2>
              <p className="text-sm text-gray-500">{application.name}</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Applicant Info */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg">
              {application.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900">{application.name}</p>
              <p className="text-sm text-gray-500">{getApplicantEmail(application) || 'No email'}</p>
            </div>
            <Badge className={cn(
              "text-xs",
              application.status === 'approved' ? 'bg-green-100 text-green-700' :
              application.status === 'rejected' ? 'bg-red-100 text-red-700' :
              application.status === 'in_review' ? 'bg-blue-100 text-blue-700' :
              'bg-amber-100 text-amber-700'
            )}>
              {application.status}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center border-b border-gray-200">
          <button
            onClick={() => setActiveTab('compose')}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'compose'
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Send className="w-4 h-4" />
              Compose
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'history'
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Mail className="w-4 h-4" />
              Emails
              {emailHistory.length > 0 && (
                <span className="w-5 h-5 bg-gray-200 rounded-full text-xs flex items-center justify-center">
                  {emailHistory.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={cn(
              "flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'activity'
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <div className="flex items-center justify-center gap-2">
              <Activity className="w-4 h-4" />
              Activity
            </div>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Compose Tab */}
          {activeTab === 'compose' && (
            <div className="p-6 space-y-4">
              {/* Gmail Connection Status */}
              {isCheckingConnection ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Checking connection...
                </div>
              ) : !gmailConnection?.connected ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Gmail not connected</span>
                  </div>
                  <p className="text-sm text-amber-600 mt-1">
                    Connect your Gmail account in Communications settings to send emails.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Connected as {gmailConnection.email}
                </div>
              )}

              {/* Reply indicator */}
              {replyThread && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 text-blue-700 text-sm">
                    <Mail className="w-4 h-4" />
                    <span>Replying to thread</span>
                  </div>
                  <button
                    onClick={() => {
                      setReplyThread(null)
                      setSubject('')
                    }}
                    className="text-blue-500 hover:text-blue-700 text-xs"
                  >
                    Cancel reply
                  </button>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Message Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Message
                </label>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <RichTextEditor
                    value={messageBody}
                    onChange={setMessageBody}
                    placeholder="Write your message here..."
                    minHeight="200px"
                  />
                </div>
              </div>

              {/* Merge Tags */}
              {mergeTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Merge Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {mergeTags.slice(0, 10).map((tag) => (
                      <button
                        key={tag.tag}
                        onClick={() => setMessageBody(prev => prev + ` ${tag.tag}`)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Click to insert a merge tag into your message
                  </p>
                </div>
              )}

              {/* Send Result */}
              {sendResult && (
                <div className={cn(
                  "p-3 rounded-lg flex items-center gap-2",
                  sendResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                  {sendResult.success ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {sendResult.message}
                </div>
              )}

              {/* Send Button */}
              <Button
                onClick={handleSendEmail}
                disabled={isSending || !gmailConnection?.connected}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Email History Tab */}
          {activeTab === 'history' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Email History</h3>
                <button
                  onClick={loadEmailHistory}
                  disabled={isLoadingHistory}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <RefreshCw className={cn("w-4 h-4", isLoadingHistory && "animate-spin")} />
                </button>
              </div>

              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : emailHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No emails sent yet</p>
                  <p className="text-sm">Emails you send to this applicant will appear here.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {emailHistory.map((email) => (
                    <div
                      key={email.id}
                      className={cn(
                        "border rounded-lg transition-colors overflow-hidden",
                        email.status === 'received' 
                          ? "bg-blue-50 border-blue-200 hover:border-blue-300" 
                          : "bg-white border-gray-200 hover:border-gray-300"
                      )}
                    >
                      {/* Email Header - Clickable */}
                      <button
                        onClick={() => setExpandedEmailId(expandedEmailId === email.id ? null : email.id)}
                        className="w-full p-4 text-left hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <ChevronDown className={cn(
                                "w-4 h-4 text-gray-400 transition-transform",
                                expandedEmailId === email.id && "rotate-180"
                              )} />
                              <p className="font-medium text-gray-900 truncate">{email.subject}</p>
                            </div>
                            <p className="text-sm text-gray-500 mt-1 ml-6">
                              {email.status === 'received' ? (
                                <>From: {email.sender_email}</>
                              ) : (
                                <>To: {email.recipient_email}</>
                              )}
                            </p>
                          </div>
                          <Badge className={cn("text-xs ml-2 shrink-0", getStatusColor(email.status))}>
                            {email.status === 'received' ? 'received' : email.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-3 ml-6 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(email.sent_at)}
                          </span>
                          {email.opened_at && (
                            <span className="flex items-center gap-1 text-green-600">
                              <Eye className="w-3 h-3" />
                              Opened {email.open_count || 1}x
                            </span>
                          )}
                          {email.source === 'gmail' && (
                            <span className="text-gray-400 text-xs">via Gmail</span>
                          )}
                        </div>
                      </button>
                      
                      {/* Email Content - Expandable */}
                      {expandedEmailId === email.id && (
                        <div className="border-t border-gray-100 p-4 bg-gray-50/50">
                          <div className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">From:</span> {email.sender_email}
                          </div>
                          <div className="text-sm text-gray-600 mb-2">
                            <span className="font-medium">To:</span> {email.recipient_email}
                          </div>
                          <div className="text-sm text-gray-600 mb-3">
                            <span className="font-medium">Date:</span> {new Date(email.sent_at).toLocaleString()}
                          </div>
                          <div className="border-t border-gray-200 pt-3">
                            {(() => {
                              // Get the body content, preferring body_html
                              let content = email.body_html || email.body || 'No content available'
                              
                              // Remove tracking pixels
                              content = content.replace(/<img[^>]*email\/track[^>]*>/gi, '')
                              
                              // Check if content looks like HTML
                              const isHtml = /<[a-z][\s\S]*>/i.test(content)
                              
                              if (isHtml) {
                                return (
                                  <div 
                                    className="prose prose-sm max-w-none text-gray-700"
                                    dangerouslySetInnerHTML={{ __html: content }}
                                  />
                                )
                              } else {
                                return (
                                  <div className="text-sm text-gray-700 whitespace-pre-wrap">
                                    {content}
                                  </div>
                                )
                              }
                            })()}
                          </div>
                          {/* Reply button */}
                          <div className="border-t border-gray-200 pt-3 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                // Pre-fill reply with thread info
                                setSubject(`Re: ${email.subject.replace(/^Re:\s*/i, '')}`)
                                setMessageBody('')
                                // Store thread info for proper threading
                                const threadId = email.gmail_thread_id || ''
                                const messageId = (email as any).message_id || ''
                                setReplyThread({
                                  threadId,
                                  messageId,
                                  references: messageId // For RFC threading
                                })
                                setActiveTab('compose')
                              }}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Mail className="w-4 h-4 mr-2" />
                              Reply
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-gray-900">Activity Log</h3>
                <button
                  onClick={loadActivity}
                  disabled={isLoadingActivity}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <RefreshCw className={cn("w-4 h-4", isLoadingActivity && "animate-spin")} />
                </button>
              </div>

              {isLoadingActivity ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                  Loading...
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No activity yet</p>
                  <p className="text-sm">Activity related to this applicant will appear here.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                  
                  <div className="space-y-4">
                    {activities.map((activity, idx) => (
                      <div key={idx} className="relative flex items-start gap-4 pl-10">
                        {/* Icon */}
                        <div className="absolute left-0 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
                          {getActivityIcon(activity.type)}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900">{activity.title}</p>
                          <p className="text-sm text-gray-500 truncate">{activity.description}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
