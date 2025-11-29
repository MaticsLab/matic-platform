'use client'

import { useState, useEffect, useMemo } from 'react'
import { FileCheck, Mail, Settings, FileText, Users, GitMerge, Share2, Copy, Edit2, Check, ExternalLink, BarChart3, ChevronRight, TrendingUp, Clock, CheckCircle, AlertCircle, Search, Plus, Eye, MessageSquare, Workflow, UserPlus } from 'lucide-react'
import { ReviewWorkspace } from './Review/ReviewWorkspace'
import { CommunicationsCenter } from './Communications/CommunicationsCenter'
import { ReviewerManagement } from './Reviewers/ReviewerManagement'
import { WorkflowBuilder } from './Configuration/WorkflowBuilder'
import { ApplicationDashboard } from './Dashboard/ApplicationDashboard'
import { SettingsModal } from './Configuration/SettingsModal'
import { useTabContext } from '@/components/WorkspaceTabProvider'
import { useSearch, HubSearchContext } from '@/components/Search'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/ui-components/dialog'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { goClient } from '@/lib/api/go-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { workflowsClient } from '@/lib/api/workflows-client'
import { Form } from '@/types/forms'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ApplicationManagerProps {
  workspaceId: string
  formId: string | null
}

type Tab = 'review' | 'workflows' | 'analytics' | 'builder' | 'settings' | 'reviewers'

interface Stats {
  totalSubmissions: number
  pendingReview: number
  inProgress: number
  completed: number
  workflowsConfigured: number
  reviewersActive: number
}

const tabConfig = [
  { id: 'review' as Tab, label: 'Review', icon: FileCheck, color: 'blue', subModule: 'Review Center' },
  { id: 'workflows' as Tab, label: 'Workflows', icon: GitMerge, color: 'indigo', subModule: 'Workflow Builder' },
  { id: 'analytics' as Tab, label: 'Analytics', icon: BarChart3, color: 'purple', subModule: 'Analytics' },
]

export function ApplicationManager({ workspaceId, formId }: ApplicationManagerProps) {
  const { tabs, tabManager, setTabActions, setTabHeaderContent } = useTabContext()
  const { setHubContext } = useSearch()
  const hubUrl = `/workspace/${workspaceId}/applications`
  const hubTab = tabs.find(t => t.url === hubUrl)
  
  const [activeTab, setActiveTab] = useState<Tab>('review')
  const [isInitialized, setIsInitialized] = useState(false)
  const [form, setForm] = useState<Form | null>(null)
  const [workspaceSlug, setWorkspaceSlug] = useState<string>('')
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [stats, setStats] = useState<Stats>({
    totalSubmissions: 0,
    pendingReview: 0,
    inProgress: 0,
    completed: 0,
    workflowsConfigured: 0,
    reviewersActive: 0
  })
  
  const params = useParams()
  const slugFromUrl = params?.slug as string

  // Share Dialog State
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [applicationSlug, setApplicationSlug] = useState('')
  const [isEditingSlug, setIsEditingSlug] = useState(false)
  const [tempSlug, setTempSlug] = useState('')
  const [copied, setCopied] = useState(false)
  const [showReviewersPanel, setShowReviewersPanel] = useState(false)
  const [showCommunicationsPanel, setShowCommunicationsPanel] = useState(false)

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

  // Fetch stats for overview
  useEffect(() => {
    const fetchStats = async () => {
      if (!formId || !workspaceId) return
      try {
        // Fetch submissions
        const submissions = await goClient.get<any[]>(`/forms/${formId}/submissions`)
        
        // Fetch workflows
        const workflows = await workflowsClient.listWorkflows(workspaceId)
        
        // Fetch form settings for reviewers
        const formData = await goClient.get<Form>(`/forms/${formId}`)
        const reviewers = formData.settings?.reviewers as any[] || []
        
        setStats({
          totalSubmissions: submissions.length,
          pendingReview: submissions.filter((s: any) => !s.status || s.status === 'pending').length,
          inProgress: submissions.filter((s: any) => s.status === 'in_progress').length,
          completed: submissions.filter((s: any) => s.status === 'completed' || s.status === 'approved' || s.status === 'rejected').length,
          workflowsConfigured: workflows.length,
          reviewersActive: reviewers.filter((r: any) => r.status === 'active').length
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }
    fetchStats()
  }, [formId, workspaceId])

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

  // Register tab actions - Team button shown for all sub modules
  useEffect(() => {
    const actions = []
    
    // Add Team button for all tabs
    actions.push({
      label: 'Team',
      icon: Users,
      onClick: () => setShowReviewersPanel(!showReviewersPanel),
      variant: 'outline' as const
    })
    
    actions.push(
      {
        label: 'Portal Editor',
        icon: FileText,
        onClick: () => window.open(`/workspace/${workspaceSlug || workspaceId}/portal-editor?formId=${formId}`, '_blank'),
        variant: 'outline' as const
      },
      {
        label: 'Share',
        icon: Share2,
        onClick: () => setIsShareOpen(true),
        variant: 'outline' as const
      }
    )
    
    setTabActions(actions)

    return () => setTabActions([])
  }, [workspaceId, workspaceSlug, formId, setTabActions, activeTab, showReviewersPanel, showCommunicationsPanel])

  // Register tab header content with navigation
  useEffect(() => {
    const currentTab = tabConfig.find(t => t.id === activeTab)
    
    setTabHeaderContent({
      title: form?.name || 'Loading...',
      subModule: currentTab?.subModule,
      navItems: tabConfig.map(tab => ({
        id: tab.id,
        label: tab.label,
        icon: tab.icon,
        badge: tab.id === 'review' ? stats.pendingReview : undefined,
        badgeColor: tab.id === 'review' ? 'blue' : undefined
      })),
      activeNavId: activeTab,
      onNavChange: (id) => setActiveTab(id as Tab)
    })

    return () => setTabHeaderContent(null)
  }, [form?.name, stats, activeTab, setTabHeaderContent])

  // Initialize state from metadata
  useEffect(() => {
    if (hubTab && !isInitialized) {
      const savedTab = (hubTab.metadata?.scholarshipActiveTab as Tab) || 'review'
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

  // Register search context based on active tab
  // Note: 'review' tab handles its own search context in ReviewWorkspace
  useEffect(() => {
    if (activeTab === 'review') {
      // Let ReviewWorkspace handle its own search context
      return
    }

    const searchContextByTab: Record<string, HubSearchContext> = {
      analytics: {
        hubType: 'applications',
        hubId: formId || '',
        hubName: form?.name || 'Application',
        placeholder: 'Search analytics, stats...',
        actions: [
          { id: 'view-all', label: 'View All Applications', icon: Eye, action: () => setActiveTab('review') },
          { id: 'config-workflows', label: 'Configure Workflows', icon: Workflow, action: () => setActiveTab('workflows') }
        ]
      },
      workflows: {
        hubType: 'applications',
        hubId: formId || '',
        hubName: form?.name || 'Application',
        placeholder: 'Search workflows, stages...',
        actions: [
          { id: 'new-workflow', label: 'New Workflow', icon: Plus, action: () => {} },
          { id: 'new-stage', label: 'New Stage', icon: Plus, action: () => {} }
        ]
      },
      reviewers: {
        hubType: 'applications',
        hubId: formId || '',
        hubName: form?.name || 'Application',
        placeholder: 'Search reviewers...',
        actions: [
          { id: 'add-reviewer', label: 'Add Reviewer', icon: UserPlus, action: () => setShowReviewersPanel(true) }
        ]
      }
    }

    const context = searchContextByTab[activeTab]
    if (context) {
      setHubContext(context)
    }

    return () => setHubContext(null)
  }, [activeTab, formId, form?.name, setHubContext])

  return (
    <div className="h-full flex flex-col bg-gray-50">

      {/* Share Dialog */}
      <Dialog open={isShareOpen} onOpenChange={setIsShareOpen}>
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

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'review' && (
          <ReviewWorkspace 
            workspaceId={workspaceId} 
            formId={formId} 
            showReviewersPanel={showReviewersPanel}
            onToggleReviewersPanel={() => setShowReviewersPanel(!showReviewersPanel)}
            showCommunicationsPanel={showCommunicationsPanel}
            onToggleCommunicationsPanel={() => setShowCommunicationsPanel(!showCommunicationsPanel)}
          />
        )}
        {activeTab === 'workflows' && <WorkflowBuilder workspaceId={workspaceId} formId={formId} />}
        {activeTab === 'analytics' && <ApplicationDashboard workspaceId={workspaceId} formId={formId} />}
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
