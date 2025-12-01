'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Mail, Send, Clock, FileText, Users, ChevronRight, Plus, Tag, Link2, CheckCircle, AlertCircle, Eye, RefreshCw, Trash2, Settings, ChevronDown, Search, X, Layers, Folder, User } from 'lucide-react'
import { goClient } from '@/lib/api/go-client'
import { emailClient, GmailConnection, SentEmail, EmailTemplate, SendEmailRequest } from '@/lib/api/email-client'
import { Form, FormField, FormSubmission } from '@/types/forms'
import { EmailSettingsDialog } from './EmailSettingsDialog'
import { RichTextEditor } from '@/components/PortalBuilder/RichTextEditor'
import { workflowsClient, ApplicationStage, ReviewWorkflow } from '@/lib/api/workflows-client'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui-components/popover'
import { Input } from '@/ui-components/input'
import { Checkbox } from '@/ui-components/checkbox'

// Types for recipient selection
interface ApplicationGroup {
  id: string
  name: string
  description?: string
  color: string
  icon: string
}

interface StageGroup {
  id: string
  stage_id: string
  name: string
  description?: string
  color: string
}

interface Recipient {
  id: string
  name: string
  email: string
  stage_id?: string
  stage_name?: string
  group_id?: string
  group_name?: string
}

interface CommunicationsCenterProps {
  workspaceId: string
  formId: string | null
  workflowId?: string | null
}

type RecipientMode = 'filter' | 'individual'

export function CommunicationsCenter({ workspaceId, formId, workflowId }: CommunicationsCenterProps) {
  const [activeView, setActiveView] = useState<'compose' | 'templates' | 'history'>('compose')
  const [fields, setFields] = useState<FormField[]>([])
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [messageBody, setMessageBody] = useState('')
  const [subject, setSubject] = useState('')
  const [trackOpens, setTrackOpens] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)

  // Recipient selection state
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('filter')
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([])
  const [recipientSearch, setRecipientSearch] = useState('')

  // Email field selection - which field contains the recipient's email
  const [selectedEmailField, setSelectedEmailField] = useState<string>('')
  const [emailFieldOptions, setEmailFieldOptions] = useState<{ value: string; label: string }[]>([])

  // Workflow data
  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [groups, setGroups] = useState<ApplicationGroup[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false)

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

  // Fetch form data and build recipients
  useEffect(() => {
    const fetchData = async () => {
      if (!formId) return
      try {
        const form = await goClient.get<Form>(`/forms/${formId}`)
        setFields(form.fields || [])
        
        const subs = await goClient.get<FormSubmission[]>(`/forms/${formId}/submissions`)
        setSubmissions(subs || [])

        // Build email field options from form fields
        const emailFields: { value: string; label: string }[] = []
        const addedKeys = new Set<string>() // Track keys we've already added
        
        // Add auto-detect option
        emailFields.push({ value: '', label: 'Auto-detect email field' })
        
        // Check submission data for email fields (use actual data keys)
        if (subs && subs.length > 0) {
          const sampleData = subs[0].data || {}
          Object.keys(sampleData).forEach(key => {
            const value = String(sampleData[key] || '')
            const keyLower = key.toLowerCase()
            // Include if it contains @ or the key name suggests it's an email
            if ((value.includes('@') || keyLower.includes('email')) && !addedKeys.has(key)) {
              // Find matching form field for a nicer label
              const matchingField = form.fields?.find(f => 
                f.id === key || 
                f.label?.toLowerCase().replace(/\s+/g, '_') === keyLower ||
                f.label?.toLowerCase().replace(/\s+/g, '') === keyLower.replace(/_/g, '')
              )
              const label = matchingField?.label || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              emailFields.push({ value: key, label })
              addedKeys.add(key)
            }
          })
        }
        
        setEmailFieldOptions(emailFields)

        // Build recipient list from submissions using selected email field
        const recipientList: Recipient[] = (subs || []).map(sub => {
          const data = sub.data || {}
          const nameField = Object.keys(data).find(k => 
            k.toLowerCase().includes('name') || 
            k.toLowerCase() === 'full name' ||
            k.toLowerCase() === 'first name'
          )
          const emailFieldKey = Object.keys(data).find(k => 
            k.toLowerCase().includes('email')
          )
          
          return {
            id: sub.id,
            name: nameField ? String(data[nameField]) : 'Unknown',
            email: emailFieldKey ? String(data[emailFieldKey]) : sub.email || 'No email',
            stage_id: (sub as any).stage_id,
            stage_name: (sub as any).stage_name,
            group_id: (sub as any).group_id,
            group_name: (sub as any).group_name,
          }
        })
        setRecipients(recipientList)
      } catch (error) {
        console.error('Failed to fetch form data:', error)
      }
    }
    fetchData()
  }, [formId])

  // Fetch workflow stages and groups
  useEffect(() => {
    const fetchWorkflowData = async () => {
      if (!workspaceId) return
      setIsLoadingWorkflow(true)
      try {
        // Fetch stages
        const stagesData = await workflowsClient.listStages(workspaceId, workflowId || undefined)
        setStages(stagesData || [])

        // Fetch groups (application groups)
        if (workflowId) {
          const groupsData = await workflowsClient.listGroups(workflowId)
          setGroups(groupsData || [])
        }
      } catch (error) {
        console.error('Failed to fetch workflow data:', error)
      } finally {
        setIsLoadingWorkflow(false)
      }
    }
    fetchWorkflowData()
  }, [workspaceId, workflowId])

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

  // Filter recipients based on search and selection
  const filteredRecipients = useMemo(() => {
    let filtered = recipients

    // Apply search filter
    if (recipientSearch) {
      const search = recipientSearch.toLowerCase()
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(search) || 
        r.email.toLowerCase().includes(search)
      )
    }

    // Apply stage filter
    if (selectedStageIds.length > 0) {
      filtered = filtered.filter(r => r.stage_id && selectedStageIds.includes(r.stage_id))
    }

    // Apply group filter
    if (selectedGroupIds.length > 0) {
      filtered = filtered.filter(r => r.group_id && selectedGroupIds.includes(r.group_id))
    }

    return filtered
  }, [recipients, recipientSearch, selectedStageIds, selectedGroupIds])

  // Get count of selected recipients
  const getRecipientCount = () => {
    if (recipientMode === 'individual') {
      return selectedRecipientIds.length
    }
    // Filter mode - count based on stage/group filters
    if (selectedStageIds.length === 0 && selectedGroupIds.length === 0) {
      return recipients.length // All recipients
    }
    return filteredRecipients.length
  }

  // Get actual recipient emails for sending
  const getSelectedRecipients = () => {
    if (recipientMode === 'individual') {
      return recipients.filter(r => selectedRecipientIds.includes(r.id))
    }
    if (selectedStageIds.length === 0 && selectedGroupIds.length === 0) {
      return recipients
    }
    return filteredRecipients
  }

  const toggleRecipient = (id: string) => {
    setSelectedRecipientIds(prev => 
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  const selectAllRecipients = () => {
    setSelectedRecipientIds(filteredRecipients.map(r => r.id))
  }

  const clearAllRecipients = () => {
    setSelectedRecipientIds([])
  }

  const toggleStage = (stageId: string) => {
    setSelectedStageIds(prev => 
      prev.includes(stageId) ? prev.filter(s => s !== stageId) : [...prev, stageId]
    )
  }

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
    )
  }

  const insertMergeTag = (tagName: string) => {
    // For HTML editor, we insert the merge tag as text
    // The RichTextEditor will handle it properly
    setMessageBody(prev => prev + `{{${tagName}}}`)
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
      setSendResult({ success: false, message: 'No recipients selected.' })
      return
    }

    setIsSending(true)
    setSendResult(null)

    try {
      // Get selected recipients - we only send their IDs (secure)
      const selectedRecipientsList = getSelectedRecipients()
      const submissionIds = selectedRecipientsList.map(r => r.id)
      
      console.log('[CommunicationsCenter] Sending email with:', {
        formId,
        submissionIds,
        emailField: selectedEmailField,
        recipientCount: submissionIds.length,
        mergeTags: true,
      })
      
      const request: SendEmailRequest = {
        form_id: formId || undefined,
        submission_ids: submissionIds, // Send only IDs - backend looks up data securely
        email_field: selectedEmailField || undefined, // Which field to use for email
        subject: subject,
        body: messageBody,
        is_html: true, // RichTextEditor produces HTML
        merge_tags: true,
        track_opens: trackOpens,
      }

      const result = await emailClient.send(workspaceId, request)

      if (result.success) {
        setSendResult({ success: true, message: `Successfully sent ${result.sent_count} emails!` })
        setSubject('')
        setMessageBody('')
        // Clear recipient selections
        setSelectedRecipientIds([])
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

  // Gmail Connection Banner (only shown when not connected)
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

    // When connected, don't show a banner - Settings is in the sidebar
    return null
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
            {gmailConnection?.connected && gmailConnection.email && (
              <div className="mt-2 text-xs text-gray-500 text-center truncate">
                Sending as {gmailConnection.email}
              </div>
            )}
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

          {/* Settings at bottom of sidebar */}
          {gmailConnection?.connected && (
            <div className="p-2 border-t border-gray-200">
              <button
                onClick={() => setShowSettingsDialog(true)}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <Settings className="w-4 h-4" />
                Email Settings
              </button>
            </div>
          )}
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
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Recipients</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setRecipientMode('filter')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            recipientMode === 'filter' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <Layers className="w-3 h-3 inline mr-1" />
                          Filter by Stage/Group
                        </button>
                        <button
                          onClick={() => setRecipientMode('individual')}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                            recipientMode === 'individual' 
                              ? 'bg-blue-100 text-blue-700' 
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <User className="w-3 h-3 inline mr-1" />
                          Select Individuals
                        </button>
                      </div>
                    </div>

                    {recipientMode === 'filter' ? (
                      <div className="p-4 space-y-4">
                        {/* Stages */}
                        {stages.length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                              Application Stages
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {stages.map(stage => (
                                <button
                                  key={stage.id}
                                  onClick={() => toggleStage(stage.id)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                                    selectedStageIds.includes(stage.id)
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <div 
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: stage.color || '#6b7280' }}
                                  />
                                  {stage.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Groups */}
                        {groups.length > 0 && (
                          <div>
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
                              Application Groups
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {groups.map(group => (
                                <button
                                  key={group.id}
                                  onClick={() => toggleGroup(group.id)}
                                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 ${
                                    selectedGroupIds.includes(group.id)
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  }`}
                                >
                                  <Folder className="w-3 h-3" />
                                  {group.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {stages.length === 0 && groups.length === 0 && (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No stages or groups available. All {recipients.length} applicants will be selected.
                          </p>
                        )}

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                          <span className="text-sm text-gray-600">
                            {selectedStageIds.length === 0 && selectedGroupIds.length === 0 
                              ? `All ${recipients.length} applicants`
                              : `${getRecipientCount()} applicants matching filters`
                            }
                          </span>
                          {(selectedStageIds.length > 0 || selectedGroupIds.length > 0) && (
                            <button
                              onClick={() => {
                                setSelectedStageIds([])
                                setSelectedGroupIds([])
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              Clear filters
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 space-y-3">
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            type="text"
                            placeholder="Search by name or email..."
                            value={recipientSearch}
                            onChange={(e) => setRecipientSearch(e.target.value)}
                            className="pl-9"
                          />
                        </div>

                        {/* Select All / Clear */}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">
                            {selectedRecipientIds.length} of {filteredRecipients.length} selected
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={selectAllRecipients}
                              className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                            >
                              Select All
                            </button>
                            <button
                              onClick={clearAllRecipients}
                              className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        {/* Recipient List */}
                        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                          {filteredRecipients.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-6">
                              No recipients found
                            </p>
                          ) : (
                            filteredRecipients.map(recipient => (
                              <label
                                key={recipient.id}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                              >
                                <Checkbox
                                  checked={selectedRecipientIds.includes(recipient.id)}
                                  onCheckedChange={() => toggleRecipient(recipient.id)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {recipient.name}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {recipient.email}
                                  </p>
                                </div>
                                {recipient.stage_name && (
                                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                                    {recipient.stage_name}
                                  </span>
                                )}
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Email Field Selection */}
                  {emailFieldOptions.length > 1 && (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                          Email Field
                        </label>
                        <select
                          value={selectedEmailField}
                          onChange={(e) => setSelectedEmailField(e.target.value)}
                          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {emailFieldOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="px-4 pb-3">
                        <p className="text-xs text-gray-500">
                          Select which field from the application contains the recipient's email address.
                        </p>
                      </div>
                    </div>
                  )}

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
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Message</label>
                      <div className="flex items-center gap-4">
                        {/* Merge Tags Dropdown */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium">
                              <Tag className="w-4 h-4" />
                              Insert Merge Tag
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-2" align="end">
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500 px-2 pb-1 border-b border-gray-100 mb-1">Click to insert field placeholder</p>
                              {fields.length > 0 ? (
                                fields.map(field => (
                                  <button
                                    key={field.id}
                                    onClick={() => {
                                      insertMergeTag(field.label)
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
                                  >
                                    <Tag className="w-3 h-3 text-gray-400" />
                                    <span className="truncate">{field.label}</span>
                                  </button>
                                ))
                              ) : (
                                <p className="text-sm text-gray-500 px-2 py-2">No form fields available</p>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>

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
                    </div>
                    <RichTextEditor
                      value={messageBody}
                      onChange={setMessageBody}
                      placeholder="Type your message here... Use the 'Insert Merge Tag' button above to add personalized fields like {{First Name}}"
                      minHeight="300px"
                      className="flex-1"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Merge tags like <code className="bg-gray-100 px-1 rounded">{'{{Field Name}}'}</code> will be replaced with each recipient's actual data.
                    </p>
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
