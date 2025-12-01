'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Send, Clock, FileText, Users, ChevronRight, Plus, Tag, Link2, CheckCircle, AlertCircle, Eye, RefreshCw, Trash2, Settings } from 'lucide-react'
import { goClient } from '@/lib/api/go-client'
import { emailClient, GmailConnection, SentEmail, EmailTemplate, SendEmailRequest } from '@/lib/api/email-client'
import { Form, FormField, FormSubmission } from '@/types/forms'
import { EmailSettingsDialog } from './EmailSettingsDialog'

interface CommunicationsCenterProps {
  workspaceId: string
  formId: string | null
}

export function CommunicationsCenter({ workspaceId, formId }: CommunicationsCenterProps) {
  const [activeView, setActiveView] = useState<'compose' | 'templates' | 'history'>('compose')
  const [fields, setFields] = useState<FormField[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('all')
  const [messageBody, setMessageBody] = useState('')
  const [subject, setSubject] = useState('')
  const [trackOpens, setTrackOpens] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)

  // Gmail connection state
  const [gmailConnection, setGmailConnection] = useState<GmailConnection | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isCheckingConnection, setIsCheckingConnection] = useState(true)

  // Email history
  const [emailHistory, setEmailHistory] = useState<SentEmail[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [showTemplateDialog, setShowTemplateDialog] = useState(false)
  const [templateName, setTemplateName] = useState('')
  
  // Settings dialog
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  // Check Gmail connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      setIsCheckingConnection(true)
      try {
        const connection = await emailClient.getConnection(workspaceId)
        setGmailConnection(connection)
      } catch (error) {
        console.error('Failed to check Gmail connection:', error)
        setGmailConnection({ connected: false })
      } finally {
        setIsCheckingConnection(false)
      }
    }
    checkConnection()
  }, [workspaceId])

  // Fetch form data
  useEffect(() => {
    const fetchData = async () => {
      if (!formId) return
      try {
        const form = await goClient.get<Form>(`/forms/${formId}`)
        setFields(form.fields || [])
        
        const subs = await goClient.get<FormSubmission[]>(`/forms/${formId}/submissions`)
        setSubmissions(subs || [])
      } catch (error) {
        console.error('Failed to fetch form data:', error)
      }
    }
    fetchData()
  }, [formId])

  // Fetch email history when tab is active
  useEffect(() => {
    if (activeView === 'history' && gmailConnection?.connected) {
      loadEmailHistory()
    }
  }, [activeView, gmailConnection?.connected, workspaceId, formId])

  // Fetch templates when tab is active
  useEffect(() => {
    if (activeView === 'templates' && gmailConnection?.connected) {
      loadTemplates()
    }
  }, [activeView, gmailConnection?.connected, workspaceId, formId])

  const loadEmailHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const history = await emailClient.getHistory(workspaceId, formId || undefined)
      setEmailHistory(history)
    } catch (error) {
      console.error('Failed to load email history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const loadTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const temps = await emailClient.getTemplates(workspaceId, formId || undefined)
      setTemplates(temps)
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const handleConnectGmail = async () => {
    setIsConnecting(true)
    setSendResult(null)
    try {
      console.log('Requesting Gmail auth URL for workspace:', workspaceId)
      const { auth_url } = await emailClient.getAuthUrl(workspaceId)
      console.log('Got auth URL, redirecting...')
      // Open in popup or redirect
      window.location.href = auth_url
    } catch (error: any) {
      console.error('Failed to get Gmail auth URL:', error)
      setSendResult({ 
        success: false, 
        message: error?.message || 'Failed to connect Gmail. Please make sure you are logged in.' 
      })
      setIsConnecting(false)
    }
  }

  const handleDisconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect your Gmail account?')) return
    try {
      await emailClient.disconnect(workspaceId)
      setGmailConnection({ connected: false })
    } catch (error) {
      console.error('Failed to disconnect Gmail:', error)
    }
  }

  const getRecipientCount = () => {
    if (recipientFilter === 'all') return submissions.length
    return submissions.filter(s => s.status === recipientFilter).length
  }

  const insertMergeTag = (tagName: string) => {
    setMessageBody(prev => prev + `{{${tagName}}} `)
  }

  const handleSend = async () => {
    if (!gmailConnection?.connected) {
      setSendResult({ success: false, message: 'Please connect your Gmail account first.' })
      return
    }

    if (!subject.trim() || !messageBody.trim()) {
      setSendResult({ success: false, message: 'Please enter a subject and message body.' })
      return
    }

    const recipientCount = getRecipientCount()
    if (recipientCount === 0) {
      setSendResult({ success: false, message: 'No recipients found for the selected filter.' })
      return
    }

    setIsSending(true)
    setSendResult(null)

    try {
      const request: SendEmailRequest = {
        form_id: formId || undefined,
        recipients: [recipientFilter],
        subject: subject,
        body: messageBody,
        merge_tags: true,
        track_opens: trackOpens,
      }

      const result = await emailClient.send(workspaceId, request)

      if (result.success) {
        setSendResult({ success: true, message: `Successfully sent ${result.sent_count} emails!` })
        setSubject('')
        setMessageBody('')
      } else {
        setSendResult({ 
          success: false, 
          message: `Sent ${result.sent_count} of ${result.total} emails. ${result.errors?.length ? result.errors[0] : ''}`
        })
      }
    } catch (error) {
      console.error('Failed to send emails:', error)
      setSendResult({ success: false, message: 'Failed to send emails. Please try again.' })
    } finally {
      setIsSending(false)
    }
  }

  const handleSaveTemplate = async () => {
    if (!templateName.trim() || !subject.trim() || !messageBody.trim()) {
      alert('Please fill in template name, subject, and message body.')
      return
    }

    try {
      await emailClient.createTemplate({
        workspace_id: workspaceId,
        form_id: formId || undefined,
        name: templateName,
        subject: subject,
        body: messageBody,
        type: 'manual',
        is_active: true,
        share_with: 'everyone',
      })
      setShowTemplateDialog(false)
      setTemplateName('')
      alert('Template saved successfully!')
      if (activeView === 'templates') {
        loadTemplates()
      }
    } catch (error) {
      console.error('Failed to save template:', error)
      alert('Failed to save template. Please try again.')
    }
  }

  const handleUseTemplate = (template: EmailTemplate) => {
    setSubject(template.subject || '')
    setMessageBody(template.body)
    setActiveView('compose')
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      await emailClient.deleteTemplate(templateId)
      setTemplates(templates.filter(t => t.id !== templateId))
    } catch (error) {
      console.error('Failed to delete template:', error)
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
    return date.toLocaleDateString()
  }

  const getStatusBadge = (status: string, openCount: number) => {
    const colors: Record<string, string> = {
      sent: 'bg-blue-100 text-blue-700',
      delivered: 'bg-green-100 text-green-700',
      opened: 'bg-purple-100 text-purple-700',
      clicked: 'bg-indigo-100 text-indigo-700',
      bounced: 'bg-red-100 text-red-700',
      failed: 'bg-red-100 text-red-700',
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status === 'opened' && openCount > 1 ? `Opened ${openCount}x` : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  // Gmail Connection Banner
  const renderConnectionBanner = () => {
    if (isCheckingConnection) {
      return (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center gap-3">
          <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
          <span className="text-sm text-gray-600">Checking Gmail connection...</span>
        </div>
      )
    }

    if (!gmailConnection?.connected) {
      return (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              Connect your Gmail account to send emails directly from this platform.
            </span>
          </div>
          <button
            onClick={handleConnectGmail}
            disabled={isConnecting}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4" />
                Connect Gmail
              </>
            )}
          </button>
        </div>
      )
    }

    return (
      <div className="bg-green-50 border-b border-green-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-sm text-green-800">
            Connected as <strong>{gmailConnection.email}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettingsDialog(true)}
            className="px-3 py-1 text-sm text-green-700 hover:bg-green-100 rounded-lg flex items-center gap-1"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button
            onClick={handleDisconnectGmail}
            className="px-3 py-1 text-sm text-green-700 hover:bg-green-100 rounded-lg"
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Gmail Connection Banner */}
      {renderConnectionBanner()}

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
          <div className="p-4">
            <button 
              onClick={() => setActiveView('compose')}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={!gmailConnection?.connected}
            >
              <Plus className="w-4 h-4" />
              New Message
            </button>
          </div>

          <nav className="flex-1 px-2 space-y-1">
            <button
              onClick={() => setActiveView('compose')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'compose' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Send className="w-4 h-4" />
              Compose
            </button>
            <button
              onClick={() => setActiveView('templates')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'templates' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              Templates
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeView === 'history' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              History
            </button>
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeView === 'compose' && (
            <div className="h-full flex flex-col">
              <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">New Message</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowTemplateDialog(true)}
                    disabled={!subject.trim() || !messageBody.trim()}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    Save as Template
                  </button>
                  <button 
                    onClick={handleSend}
                    disabled={!gmailConnection?.connected || isSending || !subject.trim() || !messageBody.trim()}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send to {getRecipientCount()}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Send Result Alert */}
              {sendResult && (
                <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center gap-2 ${
                  sendResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {sendResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="text-sm">{sendResult.message}</span>
                  <button 
                    onClick={() => setSendResult(null)}
                    className="ml-auto text-sm underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* Recipients */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => setRecipientFilter('all')}
                        className={`px-3 py-1 rounded-full text-sm font-medium border flex items-center gap-1 transition-colors ${
                          recipientFilter === 'all' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Users className="w-3 h-3" />
                        All Applicants
                      </button>
                      <button 
                        onClick={() => setRecipientFilter('submitted')}
                        className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                          recipientFilter === 'submitted' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        Submitted Only
                      </button>
                      <button 
                        onClick={() => setRecipientFilter('approved')}
                        className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                          recipientFilter === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        Finalists (Approved)
                      </button>
                      <button 
                        onClick={() => setRecipientFilter('rejected')}
                        className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                          recipientFilter === 'rejected' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        Rejected
                      </button>
                      <div className="ml-auto text-sm text-gray-500 font-medium self-center">
                        Targeting {getRecipientCount()} recipients
                      </div>
                    </div>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter email subject..."
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  {/* Editor */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">Message</label>
                      <label className="flex items-center gap-2 text-sm">
                        <input 
                          type="checkbox" 
                          checked={trackOpens}
                          onChange={(e) => setTrackOpens(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-600 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Track Opens
                        </span>
                      </label>
                    </div>
                    <div className="border border-gray-300 rounded-lg overflow-hidden flex-1 min-h-[300px] flex flex-col">
                      <div className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex flex-wrap gap-2 items-center">
                        <button className="p-1 hover:bg-gray-200 rounded text-sm font-bold w-8">B</button>
                        <button className="p-1 hover:bg-gray-200 rounded text-sm italic w-8">I</button>
                        <button className="p-1 hover:bg-gray-200 rounded text-sm underline w-8">U</button>
                        <div className="w-px h-4 bg-gray-300 mx-1 self-center"></div>
                        <span className="text-xs font-medium text-gray-500 mr-1">Merge Tags:</span>
                        <div className="flex gap-2 overflow-x-auto max-w-[400px] pb-1">
                          <button 
                            onClick={() => insertMergeTag('First Name')}
                            className="px-2 py-1 hover:bg-gray-200 rounded text-xs bg-white border border-gray-300 whitespace-nowrap flex items-center gap-1"
                          >
                            <Tag className="w-3 h-3 text-blue-500" />
                            {'{{First Name}}'}
                          </button>
                          {fields.slice(0, 5).map(field => (
                            <button 
                              key={field.id}
                              onClick={() => insertMergeTag(field.label)}
                              className="px-2 py-1 hover:bg-gray-200 rounded text-xs bg-white border border-gray-300 whitespace-nowrap flex items-center gap-1"
                            >
                              <Tag className="w-3 h-3 text-gray-400" />
                              {`{{${field.label}}}`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea 
                        className="flex-1 p-4 focus:outline-none resize-none font-mono text-sm"
                        placeholder="Type your message here... Use {{field_name}} for merge tags."
                        value={messageBody}
                        onChange={(e) => setMessageBody(e.target.value)}
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'templates' && (
            <div className="h-full flex flex-col">
              <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Email Templates</h2>
                <button 
                  onClick={loadTemplates}
                  disabled={isLoadingTemplates}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingTemplates ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {isLoadingTemplates ? (
                  <div className="flex items-center justify-center h-40">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No templates yet</p>
                    <p className="text-sm mt-1">Save a template from the compose view</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((template) => (
                      <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all group">
                        <div className="flex justify-between items-start mb-2">
                          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              {template.type}
                            </span>
                            <button
                              onClick={() => handleDeleteTemplate(template.id)}
                              className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                        <p className="text-sm text-gray-500 truncate mb-3">{template.subject}</p>
                        <button
                          onClick={() => handleUseTemplate(template)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Use Template →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'history' && (
            <div className="h-full flex flex-col">
              <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Sent History</h2>
                <button 
                  onClick={loadEmailHistory}
                  disabled={isLoadingHistory}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {isLoadingHistory ? (
                  <div className="flex items-center justify-center h-40">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : emailHistory.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No emails sent yet</p>
                    <p className="text-sm mt-1">Sent emails will appear here</p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">To</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Subject</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Sent</th>
                        <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {emailHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="font-medium">{item.recipient_name || 'Unknown'}</div>
                            <div className="text-gray-500 text-xs">{item.recipient_email}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{item.subject}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{formatDate(item.sent_at)}</td>
                          <td className="px-6 py-4 text-sm">
                            {getStatusBadge(item.status, item.open_count)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Template Dialog */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save as Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Application Received"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="text-sm text-gray-500">
                <p><strong>Subject:</strong> {subject}</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowTemplateDialog(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Settings Dialog */}
      <EmailSettingsDialog
        workspaceId={workspaceId}
        open={showSettingsDialog}
        onOpenChange={setShowSettingsDialog}
        onAccountsUpdated={() => {
          // Refresh connection state when accounts are updated
          emailClient.getConnection(workspaceId).then(setGmailConnection).catch(console.error)
        }}
      />
    </div>
  )
}
