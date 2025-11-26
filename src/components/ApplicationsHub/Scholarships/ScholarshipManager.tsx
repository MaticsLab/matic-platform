'use client'

import { useState, useEffect } from 'react'
import { LayoutDashboard, FileCheck, Mail, Settings, ChevronLeft, FileText, Users, GitMerge, Share2, Copy, Edit2, Check, ExternalLink } from 'lucide-react'
import { ScholarshipDashboard } from './Dashboard/ScholarshipDashboard'
import { ReviewWorkspace } from './Review/ReviewWorkspace'
import { CommunicationsCenter } from './Communications/CommunicationsCenter'
import { ReviewerManagement } from './Reviewers/ReviewerManagement'
import { WorkflowBuilder } from './Configuration/WorkflowBuilder'
import { SettingsModal } from './Configuration/SettingsModal'
import { useTabContext } from '@/components/WorkspaceTabProvider'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/ui-components/dialog'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { goClient } from '@/lib/api/go-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { Form } from '@/types/forms'
import { useParams } from 'next/navigation'

interface ScholarshipManagerProps {
  workspaceId: string
  formId: string | null
}

type Tab = 'dashboard' | 'review' | 'communications' | 'builder' | 'reviewers' | 'settings' | 'workflows'

export function ScholarshipManager({ workspaceId, formId }: ScholarshipManagerProps) {
  const { tabs, tabManager } = useTabContext()
  const hubUrl = `/workspace/${workspaceId}/applications`
  const hubTab = tabs.find(t => t.url === hubUrl)
  
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [isInitialized, setIsInitialized] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [workspaceSlug, setWorkspaceSlug] = useState<string>('')
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  
  const params = useParams()
  const slugFromUrl = params?.slug as string

  // Share Dialog State
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [applicationSlug, setApplicationSlug] = useState('')
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const [tempSlug, setTempSlug] = useState('')
  const [copied, setCopied] = useState(false)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://maticslab.com'
  const fullUrl = `${baseUrl}/apply/${applicationSlug}`

  // Fetch workspace details
  useEffect(() => {
    if (slugFromUrl) {
      setWorkspaceSlug(slugFromUrl)
      return
    }

    const fetchWorkspace = async () => {
      try {
        const workspace = await workspacesClient.get(workspaceId)
        setWorkspaceSlug(workspace.slug)
      } catch (error) {
        console.error('Failed to fetch workspace:', error)
      }
    }
    fetchWorkspace()
  }, [workspaceId, slugFromUrl])

  // Fetch form details
  useEffect(() => {
    const fetchForm = async () => {
      if (!formId) return
      try {
        const data = await goClient.get<Form>(`/forms/${formId}`)
        setForm(data)
        setApplicationSlug(data.slug)
      } catch (error) {
        console.error('Failed to fetch form:', error)
      }
    }
    fetchForm()
  }, [formId])

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveSlug = async () => {
    if (!form) return
    // Basic validation: slugify
    const cleanSlug = tempSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
    
    try {
      const updatedForm = await goClient.patch<Form>(`/forms/${form.id}`, { slug: cleanSlug })
      setForm(updatedForm)
      setApplicationSlug(updatedForm.slug)
      setIsEditingSlug(false)
    } catch (error) {
      console.error('Failed to update slug:', error)
    }
  }

  // Initialize state from metadata
  useEffect(() => {
    if (hubTab && !isInitialized) {
      const savedTab = (hubTab.metadata?.scholarshipActiveTab as Tab) || 'dashboard'
      setActiveTab(savedTab)
      setIsInitialized(true)
    }
  }, [hubTab, isInitialized])

  // Persist state changes to metadata
  useEffect(() => {
    if (isInitialized && hubTab && tabManager) {
      if (hubTab.metadata?.scholarshipActiveTab !== activeTab) {
        tabManager.updateTab(hubTab.id, {
          metadata: {
            ...hubTab.metadata,
            scholarshipActiveTab: activeTab
          }
        })
      }
    }
  }, [activeTab, hubTab, tabManager, isInitialized])

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 overflow-hidden">
          <h1 className="text-lg font-bold text-gray-900 shrink-0">{form?.name || 'Loading...'}</h1>
          <div className="h-6 w-px bg-gray-200 shrink-0" />
          
          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'review' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              Review
            </button>
            <button
              onClick={() => setActiveTab('communications')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'communications' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Mail className="w-4 h-4" />
              Communications
            </button>
            <button
              onClick={() => setActiveTab('reviewers')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'reviewers' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              Reviewers
            </button>
            <button
              onClick={() => setActiveTab('workflows')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === 'workflows' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <GitMerge className="w-4 h-4" />
              Workflows
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 bg-white"
          onClick={() => window.open(`/workspace/${workspaceSlug || workspaceId}/portal-editor?formId=${formId}`, '_blank')}
        >
          <FileText className="w-4 h-4" />
          Portal Editor
        </Button>

        <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 bg-white">
              <Share2 className="w-4 h-4" />
              Share
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Share Application</DialogTitle>
              <DialogDescription>
                Share this link with applicants to let them apply. You can customize the URL below.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Public Application Link</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    {isEditingSlug ? (
                      <div className="flex items-center border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                        <div className="bg-gray-50 px-3 py-2 text-sm text-gray-500 border-r border-gray-200 whitespace-nowrap">
                          .../apply/
                        </div>
                        <input 
                          value={tempSlug}
                          onChange={e => setTempSlug(e.target.value)}
                          className="flex-1 px-3 py-2 text-sm outline-none"
                          placeholder="enter-slug-here"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <Input 
                        value={fullUrl} 
                        readOnly
                        className="bg-gray-50 text-gray-600"
                      />
                    )}
                  </div>
                  
                  {!isEditingSlug ? (
                    <>
                      <Button variant="outline" size="icon" onClick={() => {
                        setTempSlug(applicationSlug)
                        setIsEditingSlug(true)
                      }}>
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleCopy}>
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={handleSaveSlug}>Save</Button>
                  )}
                </div>
              </div>
              
              {!isEditingSlug && (
                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm flex gap-2 items-start">
                  <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Ready to share?</p>
                    <a href={fullUrl} target="_blank" rel="noreferrer" className="hover:underline opacity-90">
                      Open public application page
                    </a>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        <Button 
          variant={activeTab === 'settings' ? 'secondary' : 'outline'} 
          size="sm" 
          className={`gap-2 ${activeTab === 'settings' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white'}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings className="w-4 h-4" />
          Settings
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && <ScholarshipDashboard workspaceId={workspaceId} formId={formId} />}
        {activeTab === 'review' && <ReviewWorkspace workspaceId={workspaceId} formId={formId} />}
        {activeTab === 'communications' && <CommunicationsCenter workspaceId={workspaceId} formId={formId} />}
        {activeTab === 'reviewers' && <ReviewerManagement formId={formId} />}
        {activeTab === 'workflows' && <WorkflowBuilder formId={formId} />}
        {activeTab === 'settings' && (
          <div className="p-8 text-center text-gray-500">
            <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">Settings</h3>
            <p className="mb-6">Configure application forms, phases, and team permissions.</p>
            <Button onClick={() => setIsSettingsModalOpen(true)}>
              Configure Data Mappings & Rubric
            </Button>
          </div>
        )}
      </div>

      {formId && (
        <SettingsModal 
          open={isSettingsModalOpen} 
          onOpenChange={setIsSettingsModalOpen} 
          formId={formId}
          onSave={() => {
            // Refresh form data
            goClient.get<Form>(`/forms/${formId}`).then(setForm)
          }}
        />
      )}
    </div>
  )
}
