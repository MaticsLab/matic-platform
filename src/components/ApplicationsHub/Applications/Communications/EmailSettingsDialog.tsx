'use client'

import { useState, useEffect } from 'react'
import { X, Mail, ChevronDown, Plus, Trash2, Edit2, Check, Settings, Users, User, Shield, Globe } from 'lucide-react'
import { emailClient, GmailAccount, EmailSignature, EmailTemplate } from '@/lib/api/email-client'
import { supabase } from '@/lib/supabase'

interface EmailSettingsDialogProps {
  workspaceId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccountsUpdated?: () => void
  defaultTab?: 'accounts' | 'signatures' | 'templates'
}

export function EmailSettingsDialog({ workspaceId, open, onOpenChange, onAccountsUpdated, defaultTab = 'accounts' }: EmailSettingsDialogProps) {
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'accounts' | 'signatures' | 'templates'>(defaultTab)
  
  // Accounts state
  const [accounts, setAccounts] = useState<GmailAccount[]>([])
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null)
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [editingDisplayNames, setEditingDisplayNames] = useState<Record<string, string>>({})
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({})
  
  // Signatures state
  const [signatures, setSignatures] = useState<EmailSignature[]>([])
  const [selectedSignature, setSelectedSignature] = useState<EmailSignature | null>(null)
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false)
  const [signatureEditMode, setSignatureEditMode] = useState<'richtext' | 'html'>('richtext')
  const [editingSignatureName, setEditingSignatureName] = useState('')
  const [editingSignatureContent, setEditingSignatureContent] = useState('')
  const [editingSignatureHTML, setEditingSignatureHTML] = useState('')
  
  // Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [showNewTemplateDialog, setShowNewTemplateDialog] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateSubject, setNewTemplateSubject] = useState('')
  const [newTemplateBody, setNewTemplateBody] = useState('')
  const [newTemplateShareWith, setNewTemplateShareWith] = useState<'only_me' | 'everyone' | 'admins' | 'specific'>('everyone')

  // Get user ID on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id || null)
    }
    getUser()
  }, [])

  useEffect(() => {
    if (open && userId) {
      loadAccounts()
      loadSignatures()
      loadTemplates()
    }
  }, [open, workspaceId, userId])

  const loadAccounts = async () => {
    setIsLoadingAccounts(true)
    try {
      const data = await emailClient.listAccounts(workspaceId)
      setAccounts(data || [])
    } catch (error) {
      console.error('Failed to load accounts:', error)
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  const loadSignatures = async () => {
    setIsLoadingSignatures(true)
    try {
      const data = await emailClient.listSignatures(workspaceId, userId || undefined)
      setSignatures(data || [])
      if (data && data.length > 0 && !selectedSignature) {
        selectSignature(data[0])
      }
    } catch (error) {
      console.error('Failed to load signatures:', error)
    } finally {
      setIsLoadingSignatures(false)
    }
  }

  const loadTemplates = async () => {
    setIsLoadingTemplates(true)
    try {
      const data = await emailClient.getTemplates(workspaceId)
      setTemplates(data || [])
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  const handleConnectAccount = async () => {
    setIsConnecting(true)
    try {
      const { auth_url } = await emailClient.getAuthUrl(workspaceId, userId || undefined)
      window.location.href = auth_url
    } catch (error) {
      console.error('Failed to get auth URL:', error)
      setIsConnecting(false)
    }
  }

  const handleUpdateAccount = async (accountId: string, updates: Partial<GmailAccount>) => {
    try {
      setIsSaving(prev => ({ ...prev, [accountId]: true }))
      await emailClient.updateAccount(accountId, updates)
      setPendingChanges(prev => ({ ...prev, [accountId]: false }))
      loadAccounts()
    } catch (error) {
      console.error('Failed to update account:', error)
    } finally {
      setIsSaving(prev => ({ ...prev, [accountId]: false }))
    }
  }

  const getDisplayName = (account: GmailAccount) => {
    return editingDisplayNames[account.id] ?? account.display_name ?? ''
  }

  const handleDisplayNameChange = (accountId: string, value: string) => {
    setEditingDisplayNames(prev => ({ ...prev, [accountId]: value }))
    setPendingChanges(prev => ({ ...prev, [accountId]: true }))
  }

  const handleSaveAccount = async (account: GmailAccount) => {
    const displayName = editingDisplayNames[account.id]
    if (displayName !== undefined && displayName !== account.display_name) {
      await handleUpdateAccount(account.id, { display_name: displayName })
    }
  }

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this email account?')) return
    try {
      await emailClient.deleteAccount(accountId)
      loadAccounts()
    } catch (error) {
      console.error('Failed to delete account:', error)
    }
  }

  const selectSignature = (sig: EmailSignature) => {
    setSelectedSignature(sig)
    setEditingSignatureName(sig.name)
    setEditingSignatureContent(sig.content)
    setEditingSignatureHTML(sig.content_html || sig.content)
    setSignatureEditMode(sig.is_html ? 'html' : 'richtext')
  }

  const handleCreateSignature = async () => {
    try {
      const newSig = await emailClient.createSignature({
        workspace_id: workspaceId,
        user_id: userId || '',
        name: 'New Signature',
        content: '',
        is_html: false,
        is_default: signatures.length === 0,
      })
      setSignatures([...signatures, newSig])
      selectSignature(newSig)
    } catch (error) {
      console.error('Failed to create signature:', error)
    }
  }

  const handleSaveSignature = async () => {
    if (!selectedSignature) return
    try {
      await emailClient.updateSignature(selectedSignature.id, {
        name: editingSignatureName,
        content: signatureEditMode === 'html' ? editingSignatureHTML : editingSignatureContent,
        content_html: signatureEditMode === 'html' ? editingSignatureHTML : undefined,
        is_html: signatureEditMode === 'html',
      })
      loadSignatures()
    } catch (error) {
      console.error('Failed to save signature:', error)
    }
  }

  const handleDeleteSignature = async (sigId: string) => {
    if (!confirm('Are you sure you want to delete this signature?')) return
    try {
      await emailClient.deleteSignature(sigId)
      if (selectedSignature?.id === sigId) {
        setSelectedSignature(null)
      }
      loadSignatures()
    } catch (error) {
      console.error('Failed to delete signature:', error)
    }
  }

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateBody.trim()) {
      alert('Please fill in the template name and content.')
      return
    }
    try {
      await emailClient.createTemplate({
        workspace_id: workspaceId,
        created_by_id: userId || undefined,
        name: newTemplateName,
        subject: newTemplateSubject || undefined,
        body: newTemplateBody,
        type: 'manual',
        is_active: true,
        share_with: newTemplateShareWith,
      })
      setShowNewTemplateDialog(false)
      setNewTemplateName('')
      setNewTemplateSubject('')
      setNewTemplateBody('')
      setNewTemplateShareWith('everyone')
      loadTemplates()
    } catch (error) {
      console.error('Failed to create template:', error)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      await emailClient.deleteTemplate(templateId)
      loadTemplates()
    } catch (error) {
      console.error('Failed to delete template:', error)
    }
  }

  if (!open) return null

  const permissionOptions: { value: 'myself' | 'admins' | 'members' | 'everyone'; label: string; icon: typeof User }[] = [
    { value: 'myself', label: 'Myself', icon: User },
    { value: 'admins', label: 'Admins', icon: Shield },
    { value: 'members', label: 'Limited Members, Members, and Admins', icon: Users },
    { value: 'everyone', label: 'Choose people', icon: Globe },
  ]

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Email Settings</h2>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'accounts'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Email Accounts
          </button>
          <button
            onClick={() => setActiveTab('signatures')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'signatures'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Signatures
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'templates'
                ? 'border-violet-600 text-violet-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Templates
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Email Accounts Tab */}
          {activeTab === 'accounts' && (
            <div className="p-6">
              {accounts.map((account) => (
                <div key={account.id} className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                  {/* Account Header */}
                  <button
                    onClick={() => setExpandedAccount(expandedAccount === account.id ? null : account.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedAccount === account.id ? 'rotate-180' : ''}`} />
                      <span className="font-medium text-gray-900">{account.display_name || account.email}</span>
                      <span className="text-sm text-gray-500">&lt;{account.email}&gt;</span>
                      {account.is_default && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Default</span>
                      )}
                    </div>
                  </button>

                  {/* Account Details (Expanded) */}
                  {expandedAccount === account.id && (
                    <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-200">
                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Send Email As</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={getDisplayName(account)}
                            onChange={(e) => handleDisplayNameChange(account.id, e.target.value)}
                            onBlur={() => handleSaveAccount(account)}
                            placeholder="Display name"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                          />
                          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600">
                            {account.email}
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
                          People that can send from this account
                        </label>
                        <div className="space-y-2">
                          {permissionOptions.map((option) => (
                            <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="radio"
                                name={`permission-${account.id}`}
                                checked={account.send_permission === option.value}
                                onChange={() => handleUpdateAccount(account.id, { send_permission: option.value })}
                                className="w-4 h-4 text-violet-600 border-gray-300 focus:ring-violet-500"
                              />
                              <span className="text-sm text-gray-700">{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => handleDeleteAccount(account.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove Account
                        </button>
                        <button
                          onClick={() => handleSaveAccount(account)}
                          disabled={!pendingChanges[account.id] || isSaving[account.id]}
                          className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSaving[account.id] ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={handleConnectAccount}
                disabled={isConnecting}
                className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
              >
                <Plus className="w-4 h-4" />
                Add new ({accounts.length}/2 accounts linked)
              </button>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Signatures Tab */}
          {activeTab === 'signatures' && (
            <div className="flex h-[500px]">
              {/* Signature List */}
              <div className="w-48 border-r border-gray-200 flex flex-col">
                <div className="p-3 border-b border-gray-200">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
                    People <span className="text-gray-400 cursor-help">ⓘ</span>
                  </label>
                  <select className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg">
                    <option>Me</option>
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 uppercase px-2 mb-2">Signatures</div>
                    {signatures.map((sig) => (
                      <button
                        key={sig.id}
                        onClick={() => selectSignature(sig)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedSignature?.id === sig.id
                            ? 'bg-violet-600 text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {sig.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 border-t border-gray-200">
                  <button
                    onClick={handleCreateSignature}
                    className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add signature
                  </button>
                </div>
              </div>

              {/* Signature Editor */}
              <div className="flex-1 flex flex-col">
                {selectedSignature ? (
                  <>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                      <button className="text-sm text-gray-600 hover:text-gray-900">Edit</button>
                      <div className="flex rounded-lg overflow-hidden border border-gray-300">
                        <button
                          onClick={() => setSignatureEditMode('richtext')}
                          className={`px-3 py-1 text-sm ${
                            signatureEditMode === 'richtext'
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Use rich text
                        </button>
                        <button
                          onClick={() => setSignatureEditMode('html')}
                          className={`px-3 py-1 text-sm ${
                            signatureEditMode === 'html'
                              ? 'bg-violet-600 text-white'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          Use HTML
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto">
                      <div className="mb-4">
                        <input
                          type="text"
                          value={editingSignatureName}
                          onChange={(e) => setEditingSignatureName(e.target.value)}
                          placeholder="Signature name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                      </div>

                      {signatureEditMode === 'richtext' ? (
                        <div className="border border-gray-300 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 border-b border-gray-300 px-3 py-2 flex gap-2">
                            <button className="p-1 hover:bg-gray-200 rounded text-sm font-bold">B</button>
                            <button className="p-1 hover:bg-gray-200 rounded text-sm italic">I</button>
                            <button className="p-1 hover:bg-gray-200 rounded text-sm underline">U</button>
                          </div>
                          <textarea
                            value={editingSignatureContent}
                            onChange={(e) => setEditingSignatureContent(e.target.value)}
                            placeholder="Type your signature here..."
                            className="w-full p-4 min-h-[200px] text-sm focus:outline-none resize-none"
                          />
                        </div>
                      ) : (
                        <div className="border border-gray-300 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 border-b border-gray-300 px-3 py-2 flex justify-between">
                            <span className="text-sm text-gray-600">HTML Editor</span>
                            <button className="text-sm text-violet-600">Preview</button>
                          </div>
                          <textarea
                            value={editingSignatureHTML}
                            onChange={(e) => setEditingSignatureHTML(e.target.value)}
                            placeholder="<table>...</table>"
                            className="w-full p-4 min-h-[200px] text-sm font-mono focus:outline-none resize-none"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                      <button
                        onClick={() => handleDeleteSignature(selectedSignature.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                      <button
                        onClick={handleSaveSignature}
                        className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700"
                      >
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <p>Select or create a signature</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <div key={template.id} className="border border-gray-200 rounded-lg p-4 hover:border-violet-300 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-medium text-gray-900">{template.name}</div>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {template.subject && (
                      <p className="text-sm text-gray-500 truncate mb-2">{template.subject}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="px-2 py-0.5 bg-gray-100 rounded-full">{template.share_with}</span>
                      <span>{template.type}</span>
                    </div>
                  </div>
                ))}

                {/* Add Template Button */}
                <button
                  onClick={() => setShowNewTemplateDialog(true)}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-violet-400 hover:bg-violet-50 transition-all flex flex-col items-center justify-center text-gray-500 hover:text-violet-600"
                >
                  <Plus className="w-8 h-8 mb-2" />
                  <span className="font-medium">Create New Template</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer for templates tab */}
        {activeTab === 'templates' && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* New Template Dialog */}
      {showNewTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">New Email Template</h3>
              <button onClick={() => setShowNewTemplateDialog(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Template name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject (optional)</label>
                <input
                  type="text"
                  value={newTemplateSubject}
                  onChange={(e) => setNewTemplateSubject(e.target.value)}
                  placeholder="Subject (leave blank to use different subject lines)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email content</label>
                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 border-b border-gray-300 px-3 py-2 flex gap-2 text-sm">
                    <button className="px-2 py-1 text-gray-500 hover:bg-gray-200 rounded">Improve</button>
                    <button className="px-2 py-1 text-violet-600 hover:bg-violet-50 rounded">Edit</button>
                    <span className="border-l border-gray-300 mx-1"></span>
                    <button className="p-1 hover:bg-gray-200 rounded font-bold">B</button>
                    <button className="p-1 hover:bg-gray-200 rounded italic">I</button>
                    <button className="p-1 hover:bg-gray-200 rounded underline">U</button>
                  </div>
                  <textarea
                    value={newTemplateBody}
                    onChange={(e) => setNewTemplateBody(e.target.value)}
                    placeholder="Email content"
                    rows={4}
                    className="w-full p-4 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Share with:</label>
                <div className="space-y-2">
                  {[
                    { value: 'only_me' as const, label: 'Only Me' },
                    { value: 'everyone' as const, label: 'Everyone' },
                    { value: 'admins' as const, label: 'Admins' },
                    { value: 'specific' as const, label: 'Select people:' },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="shareWith"
                        checked={newTemplateShareWith === option.value}
                        onChange={() => setNewTemplateShareWith(option.value)}
                        className="w-4 h-4 text-violet-600 border-gray-300 focus:ring-violet-500"
                      />
                      <span className="text-sm text-gray-700">{option.label}</span>
                      {option.value === 'specific' && newTemplateShareWith === 'specific' && (
                        <button className="ml-2 p-1 bg-gray-100 rounded-full hover:bg-gray-200">
                          <Plus className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNewTemplateDialog(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
              >
                Close
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim() || !newTemplateBody.trim()}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
