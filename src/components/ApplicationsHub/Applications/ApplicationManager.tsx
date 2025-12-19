'use client'

import { useState, useEffect, useMemo } from 'react'
import { FileCheck, Mail, Settings, FileText, Users, GitMerge, BarChart3, ChevronRight, TrendingUp, Clock, CheckCircle, AlertCircle, Search, Plus, Eye, MessageSquare, Workflow, UserPlus, X, Loader2 } from 'lucide-react'
import { ReviewWorkspaceV2 } from './Review/ReviewWorkspaceV2'
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
import { Form } from '@/types/forms'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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

  // Panel State
  const [showReviewersPanel, setShowReviewersPanel] = useState(false)
  const [showCommunicationsPanel, setShowCommunicationsPanel] = useState(false)

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

  // Fetch minimal form details for display
  useEffect(() => {
    const fetchFormBasic = async () => {
      if (!formId) return
      try {
        const data = await goClient.get<Form>(`/forms/${formId}`)
        setForm(data)
      } catch (error) {
        console.error('Failed to fetch form:', error)
      }
    }
    fetchFormBasic()
  }, [formId])

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
      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'review' && formId && (
          <ReviewWorkspaceV2 
            workspaceId={workspaceId}
            workspaceSlug={workspaceSlug}
            formId={formId} 
            onBack={() => window.history.back()}
            onViewChange={(view) => {
              if (view === 'workflows') setActiveTab('workflows')
              else if (view === 'analytics') setActiveTab('analytics')
              else if (view === 'team') setShowReviewersPanel(true)
            }}
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

      {/* Reviewers Slide-over Panel - Available on all tabs */}
      {showReviewersPanel && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 transition-opacity" 
            onClick={() => setShowReviewersPanel(false)} 
          />
          
          {/* Panel */}
          <div className="absolute right-2 top-2 bottom-2 w-full max-w-2xl bg-white border border-gray-200 rounded-xl shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Team & Reviewers</h2>
                  <p className="text-sm text-gray-500">Manage review team for this workflow</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowReviewersPanel(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <ReviewerManagement formId={formId} workspaceId={workspaceId} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
