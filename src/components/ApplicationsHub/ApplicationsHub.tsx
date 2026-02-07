'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { GraduationCap, FileText, Layout, Plus, Search, MoreVertical, ArrowRight, Loader2, Filter, CheckCircle, Clock, Trash2, Database, Star, MessageSquare, ChevronDown, UserPlus } from 'lucide-react'
import { ApplicationManager } from './Applications/ApplicationManager'
import { FormPreview } from './FormPreview'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui-components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui-components/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui-components/alert-dialog"
import { Label } from "@/ui-components/label"
import { Textarea } from "@/ui-components/textarea"
import { toast } from "sonner"
import { useTabContext } from '@/components/WorkspaceTabProvider'
import { goClient } from '@/lib/api/go-client'
import { formsClient } from '@/lib/api/forms-client'
import { Form } from '@/types/forms'
import { useSearch, HubSearchContext } from '@/components/Search'
import { cn } from '@/lib/utils'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { useSession } from '@/auth/client/main'

interface ApplicationsHubProps {
  workspaceId: string
}

type View = 'home' | 'scholarships' | 'create'

export function ApplicationsHub({ workspaceId }: ApplicationsHubProps) {
  const { registerNavigationHandler, tabs, tabManager, setTabActions, setTabHeaderContent } = useTabContext()
  const { setHubContext, query: searchQuery } = useSearch()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const hubUrl = `/workspace/${workspaceId}/applications`
  const hubTab = tabs.find(t => t.url === hubUrl)
  
  const [currentView, setCurrentView] = useState<View>('home')
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [forms, setForms] = useState<Form[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all')

  // Check URL parameters for formId - always sync with URL
  useEffect(() => {
    const formIdFromUrl = searchParams.get('formId')
    console.log('🔍 ApplicationsHub URL check:', { formIdFromUrl, currentView, selectedFormId })
    if (formIdFromUrl) {
      console.log('✅ Setting formId and switching to scholarships view')
      setSelectedFormId(formIdFromUrl)
      setCurrentView('scholarships')
    } else {
      // If no formId in URL, ensure we're in home view
      console.log('🏠 No formId in URL, showing home view')
      setCurrentView('home')
      setSelectedFormId(null)
    }
  }, [searchParams])

  // Delete Application State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [formToDelete, setFormToDelete] = useState<Form | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Create Application State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newAppName, setNewAppName] = useState('')
  const [newAppDescription, setNewAppDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Initialize state from metadata - but respect URL parameters first
  useEffect(() => {
    if (hubTab && !isInitialized) {
      const formIdFromUrl = searchParams.get('formId')
      if (formIdFromUrl) {
        // URL has formId, use it
        setSelectedFormId(formIdFromUrl)
        setCurrentView('scholarships')
      } else {
        // No formId in URL, show home
        setCurrentView('home')
        setSelectedFormId(null)
      }
      setIsInitialized(true)
    }
  }, [hubTab, isInitialized, searchParams])

  // Fetch forms
  useEffect(() => {
    const fetchForms = async () => {
      if (!workspaceId) {
        console.warn('ApplicationsHub: No workspaceId provided')
        setForms([])
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        console.log('ApplicationsHub: Fetching forms for workspace:', workspaceId)
        const formsArray = await formsClient.list(workspaceId)
        console.log('ApplicationsHub: Received forms array with length:', formsArray.length)
        setForms(formsArray)
      } catch (error: any) {
        console.error('ApplicationsHub: Failed to fetch forms:', error)
        console.error('ApplicationsHub: Error details:', {
          message: error?.message,
          status: error?.status,
          response: error?.response,
          workspaceId
        })
        
        // Provide more helpful error messages
        let errorMessage = error?.message || 'Unknown error'
        if (error?.status === 401 || error?.status === 403) {
          errorMessage = 'Authentication required. Please log in again.'
        } else if (error?.status === 404) {
          errorMessage = 'Workspace not found or you do not have access.'
        } else if (error?.status === 500) {
          errorMessage = 'Server error. Please try again later.'
        } else if (!error?.status && error?.message?.includes('fetch')) {
          errorMessage = 'Unable to connect to server. Please check your connection.'
        }
        
        toast.error(`Failed to load applications: ${errorMessage}`)
        setForms([])
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchForms()
  }, [workspaceId])

  // Persist state changes to metadata
  useEffect(() => {
    if (isInitialized && hubTab && tabManager) {
      // Only update if changed to avoid loops
      if (hubTab.metadata?.currentView !== currentView || hubTab.metadata?.selectedFormId !== selectedFormId) {
        tabManager.updateTab(hubTab.id, {
          metadata: {
            ...hubTab.metadata,
            currentView,
            selectedFormId
          }
        })
      }
    }
  }, [currentView, selectedFormId, hubTab, tabManager, isInitialized])

  // Set tab header and actions for home view
  useEffect(() => {
    if (currentView !== 'home') return

    setTabHeaderContent({
      title: 'Home'
    })

    setTabActions([])

    return () => {
      setTabHeaderContent(null)
      setTabActions([])
    }
  }, [currentView, setTabHeaderContent, setTabActions])

  // Register search context for home view
  useEffect(() => {
    if (currentView !== 'home') return

    const context: HubSearchContext = {
      hubType: 'applications',
      hubId: workspaceId,
      hubName: 'Portals',
      placeholder: 'Search applications...',
      actions: [
        { id: 'new-app', label: 'New Application', icon: Plus, action: () => setIsCreateDialogOpen(true) }
      ]
    }

    setHubContext(context)
    return () => setHubContext(null)
  }, [currentView, workspaceId, setHubContext])

  // Register navigation handler
  useEffect(() => {
    if (currentView === 'home') {
      registerNavigationHandler(null)
    } else {
      registerNavigationHandler((direction) => {
        if (direction === 'back') {
          setCurrentView('home')
          setSelectedFormId(null)
          return true // Handled
        }
        return false // Not handled
      })
    }

    return () => {
      // Cleanup on unmount
      registerNavigationHandler(null)
    }
  }, [currentView, registerNavigationHandler])

  const handleCreateApplication = async () => {
    if (!newAppName.trim()) {
      toast.error('Application name is required')
      return
    }

    try {
      setIsCreating(true)
      const newForm = await goClient.post<Form>('/forms', {
        workspace_id: workspaceId,
        name: newAppName,
        description: newAppDescription,
        status: 'draft',
        is_public: false,
        settings: {},
        submit_settings: {}
      })

      setForms([newForm, ...forms])
      setIsCreateDialogOpen(false)
      setNewAppName('')
      setNewAppDescription('')
      toast.success('Application created successfully')
      
      // Open the new form immediately
      handleFormClick(newForm.id)
    } catch (error) {
      console.error('Failed to create application:', error)
      toast.error('Failed to create application')
    } finally {
      setIsCreating(false)
    }
  }

  const handleFormClick = (formId: string) => {
    const form = forms.find(f => f.id === formId)
    if (!form || !tabManager) return
    
    console.log('📂 Opening portal:', form.name, formId)
    // Use the new openPortal method for cleaner tab management
    tabManager.openPortal(formId, form.name)
  }

  const handleDeleteApplication = async () => {
    if (!formToDelete) return

    try {
      setIsDeleting(true)
      await formsClient.delete(formToDelete.id)
      setForms((Array.isArray(forms) ? forms : []).filter(f => f.id !== formToDelete.id))
      toast.success('Application deleted successfully')
      setDeleteDialogOpen(false)
      setFormToDelete(null)
    } catch (error) {
      console.error('Failed to delete application:', error)
      toast.error('Failed to delete application')
    } finally {
      setIsDeleting(false)
    }
  }

  // If we are in the scholarships module, render the manager
  if (currentView === 'scholarships') {
    console.log('🎯 Rendering ApplicationManager with:', { workspaceId, formId: selectedFormId })
    return (
      <ApplicationManager 
        workspaceId={workspaceId}
        formId={selectedFormId}
      />
    )
  }

  const filteredForms = (Array.isArray(forms) ? forms : []).filter(form => {
    const matchesSearch = !searchQuery || 
      form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (form.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'active' && form.status === 'published') ||
      (filterStatus === 'draft' && form.status === 'draft')
    return matchesSearch && matchesFilter
  })

  // Get recently viewed forms (mock for now - we'd track this properly later)
  const recentForms = filteredForms.slice(0, 4)
  
  // Get starred forms (mock for now - we'd track this properly later)  
  const starredForms = filteredForms.slice(0, 1)

  // Get user's first name
  const userName = session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'there'

  return (
    <div className="h-full flex bg-white">
      {/* Main Content - No sidebar, full width */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {userName}</h1>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                className="text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
              >
                <FileText className="w-4 h-4 mr-2" />
                Forms
                <ChevronDown className="ml-2 w-4 h-4" />
              </Button>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-gray-900 hover:bg-gray-800 gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Invite members
              </Button>
            </div>
          </div>

          {isLoading ? (
            <LoadingOverlay message="Loading..." fullScreen={false} />
          ) : (
            <>
              {/* Quick Start Section */}
              <div className="mb-8">
                <h2 className="text-sm font-medium text-gray-700 mb-4">Quick start</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button className="flex items-center gap-4 p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left">
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Form</h3>
                      <p className="text-sm text-gray-500">Forms, Scheduling</p>
                    </div>
                  </button>
                  <button 
                    className="flex items-center gap-4 p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all text-left relative"
                    onClick={() => tabManager?.addTab({
                      id: `tables-${workspaceId}-${Date.now()}`,
                      title: 'Database',
                      type: 'table',
                      url: `/workspace/${workspaceId}/tables`,
                      workspaceId,
                      metadata: { hub: 'data' }
                    })}
                  >
                    <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Database className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">Database</h3>
                      <p className="text-sm text-gray-500">Storage for apps and forms</p>
                    </div>
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded">
                      New
                    </span>
                  </button>
                </div>
              </div>

              {/* Starred Section */}
              {starredForms.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-sm font-medium text-gray-700 mb-4">Starred</h2>
                  <div className="grid grid-cols-1 gap-4">
                    {starredForms.map((form) => (
                      <button
                        key={form.id}
                        onClick={() => handleFormClick(form.id)}
                        className="relative bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all text-left group"
                      >
                        <div className="flex items-center gap-4 p-4">
                          {/* Preview with submission count */}
                          <div className="relative">
                            <FormPreview form={form} size="medium" />
                            {/* Submission count badge */}
                            <div className="absolute top-2 right-2 px-2 py-1 bg-white/95 backdrop-blur-sm rounded-md shadow-sm flex items-center gap-1">
                              <MessageSquare className="w-3 h-3 text-gray-600" />
                              <span className="text-xs font-semibold text-gray-900">12</span>
                            </div>
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-3">
                              <div className="mt-1">
                                <FileText className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 mb-1">
                                  {form.name}
                                </h3>
                                <p className="text-sm text-gray-500">
                                  Viewed 7 minutes ago
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Recently Viewed Section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-gray-700">Recently viewed</h2>
                  <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    View all
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {recentForms.map((form, index) => (
                    <button
                      key={form.id}
                      onClick={() => handleFormClick(form.id)}
                      className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-md transition-all text-left group"
                    >
                      {/* Preview with submission count */}
                      <div className="relative">
                        <FormPreview form={form} size="small" />
                        {/* Submission count badge */}
                        <div className="absolute top-2 right-2 px-2 py-1 bg-white/95 backdrop-blur-sm rounded-md shadow-sm flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-gray-600" />
                          <span className="text-xs font-semibold text-gray-900">
                            {[12, 5, 8, 15][index % 4]}
                          </span>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <h3 className="font-medium text-gray-900 text-sm group-hover:text-blue-600 line-clamp-2 flex-1">
                            {form.name}
                          </h3>
                        </div>
                        <p className="text-xs text-gray-500">
                          Viewed {['a minute ago', '2 hours ago', 'a month ago', '3 days ago'][index % 4]}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Application Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Application</DialogTitle>
            <DialogDescription>
              Create a new application form to start collecting submissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Application Name</Label>
              <Input
                id="name"
                placeholder="e.g., 2024 Scholarship Application"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this application..."
                value={newAppDescription}
                onChange={(e) => setNewAppDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateApplication} disabled={isCreating}>
              {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{formToDelete?.name}"? This will permanently remove the application and all its submissions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteApplication}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
