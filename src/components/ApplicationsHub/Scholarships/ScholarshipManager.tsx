'use client'

import { useState, useEffect, useMemo } from 'react'
import { FileCheck, Mail, Settings, FileText, Users, GitMerge, Share2, Copy, Edit2, Check, ExternalLink, LayoutDashboard, ChevronRight, TrendingUp, Clock, CheckCircle, AlertCircle } from 'lucide-react'
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
import { workflowsClient } from '@/lib/api/workflows-client'
import { Form } from '@/types/forms'
import { useParams } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ScholarshipManagerProps {
  workspaceId: string
  formId: string | null
}

type Tab = 'overview' | 'review' | 'communications' | 'builder' | 'reviewers' | 'settings' | 'workflows'

interface Stats {
  totalSubmissions: number
  pendingReview: number
  inProgress: number
  completed: number
  workflowsConfigured: number
  reviewersActive: number
}

const tabConfig = [
  { id: 'overview' as Tab, label: 'Overview', icon: LayoutDashboard, color: 'purple' },
  { id: 'review' as Tab, label: 'Review', icon: FileCheck, color: 'blue' },
  { id: 'communications' as Tab, label: 'Communications', icon: Mail, color: 'green' },
  { id: 'reviewers' as Tab, label: 'Reviewers', icon: Users, color: 'orange' },
  { id: 'workflows' as Tab, label: 'Workflows', icon: GitMerge, color: 'indigo' },
]

export function ScholarshipManager({ workspaceId, formId }: ScholarshipManagerProps) {
  const { tabs, tabManager, setTabActions } = useTabContext()
  const hubUrl = `/workspace/${workspaceId}/applications`
  const hubTab = tabs.find(t => t.url === hubUrl)
  
  const [activeTab, setActiveTab] = useState<Tab>('overview')
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

  // Register tab actions
  useEffect(() => {
    setTabActions([
      {
        label: 'Portal Editor',
        icon: FileText,
        onClick: () => window.open(`/workspace/${workspaceSlug || workspaceId}/portal-editor?formId=${formId}`, '_blank'),
        variant: 'outline'
      },
      {
        label: 'Share',
        icon: Share2,
        onClick: () => setIsShareOpen(true),
        variant: 'outline'
      }
    ])

    return () => setTabActions([])
  }, [workspaceId, workspaceSlug, formId, setTabActions])

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

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Modern Header with Gradient Navigation */}
      <div className="bg-white border-b border-gray-200">
        {/* Top Bar */}
        <div className="px-6 py-3 flex items-center justify-between gap-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
              {form?.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{form?.name || 'Loading...'}</h1>
              <p className="text-xs text-gray-500">{stats.totalSubmissions} submissions • {stats.workflowsConfigured} workflow{stats.workflowsConfigured !== 1 ? 's' : ''}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(`/workspace/${workspaceSlug || workspaceId}/portal-editor?formId=${formId}`, '_blank')}>
              <FileText className="w-4 h-4 mr-2" />
              Portal Editor
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsShareOpen(true)}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsSettingsModalOpen(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 py-2 flex items-center gap-1">
          {tabConfig.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all",
                  isActive 
                    ? "bg-gray-900 text-white shadow-sm" 
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'review' && stats.pendingReview > 0 && (
                  <span className={cn(
                    "ml-1 px-1.5 py-0.5 text-xs rounded-full font-medium",
                    isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                  )}>
                    {stats.pendingReview}
                  </span>
                )}
                {tab.id === 'reviewers' && stats.reviewersActive > 0 && (
                  <span className={cn(
                    "ml-1 px-1.5 py-0.5 text-xs rounded-full font-medium",
                    isActive ? "bg-white/20 text-white" : "bg-green-100 text-green-700"
                  )}>
                    {stats.reviewersActive}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

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
        {activeTab === 'overview' && (
          <div className="h-full overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div 
                  onClick={() => setActiveTab('review')}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Total Submissions</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalSubmissions}</p>
                    </div>
                    <div className="p-2.5 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <FileCheck className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <span className="text-blue-600 font-medium">{stats.pendingReview} pending</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div 
                  onClick={() => setActiveTab('review')}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Completed Reviews</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{stats.completed}</p>
                    </div>
                    <div className="p-2.5 bg-green-100 rounded-lg text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <span className="text-green-600 font-medium">
                      {stats.totalSubmissions > 0 ? Math.round((stats.completed / stats.totalSubmissions) * 100) : 0}% complete
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div 
                  onClick={() => setActiveTab('reviewers')}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Active Reviewers</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{stats.reviewersActive}</p>
                    </div>
                    <div className="p-2.5 bg-orange-100 rounded-lg text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <span className="text-orange-600 font-medium">Manage team</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                <div 
                  onClick={() => setActiveTab('workflows')}
                  className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">Workflows</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{stats.workflowsConfigured}</p>
                    </div>
                    <div className="p-2.5 bg-indigo-100 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <GitMerge className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 text-sm">
                    <span className="text-indigo-600 font-medium">Configure</span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button 
                    onClick={() => setActiveTab('review')}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div className="p-3 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <FileCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Start Reviewing</p>
                      <p className="text-sm text-gray-500">{stats.pendingReview} applications waiting</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setActiveTab('reviewers')}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-orange-300 hover:bg-orange-50 transition-all text-left group"
                  >
                    <div className="p-3 bg-orange-100 rounded-lg text-orange-600 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Invite Reviewers</p>
                      <p className="text-sm text-gray-500">Add committee members</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => setActiveTab('workflows')}
                    className="flex items-center gap-4 p-4 border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left group"
                  >
                    <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <GitMerge className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Configure Workflow</p>
                      <p className="text-sm text-gray-500">Set up review stages & rubrics</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Getting Started Guide (if no workflows) */}
              {stats.workflowsConfigured === 0 && (
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-white rounded-xl shadow-sm">
                      <AlertCircle className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">Get Started with Workflows</h3>
                      <p className="text-gray-600 mt-1 mb-4">
                        Create a review workflow to define stages, assign reviewer types, and set up scoring rubrics for your scholarship applications.
                      </p>
                      <Button onClick={() => setActiveTab('workflows')}>
                        <GitMerge className="w-4 h-4 mr-2" />
                        Create First Workflow
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === 'review' && <ReviewWorkspace workspaceId={workspaceId} formId={formId} />}
        {activeTab === 'communications' && <CommunicationsCenter workspaceId={workspaceId} formId={formId} />}
        {activeTab === 'reviewers' && <ReviewerManagement formId={formId} workspaceId={workspaceId} />}
        {activeTab === 'workflows' && <WorkflowBuilder workspaceId={workspaceId} />}
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
