'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, FileText, Layout, Plus, Search, MoreVertical, ArrowRight, Loader2, Filter, CheckCircle, Clock } from 'lucide-react'
import { ScholarshipManager } from './Scholarships/ScholarshipManager'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { useTabContext } from '@/components/WorkspaceTabProvider'
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'
import { useSearch, HubSearchContext } from '@/components/Search'
import { cn } from '@/lib/utils'

interface ApplicationsHubProps {
  workspaceId: string
}

type View = 'home' | 'scholarships' | 'create'

export function ApplicationsHub({ workspaceId }: ApplicationsHubProps) {
  const { registerNavigationHandler, tabs, tabManager, setTabActions, setTabHeaderContent } = useTabContext()
  const { setHubContext, query: searchQuery } = useSearch()
  const hubUrl = `/workspace/${workspaceId}/applications`
  const hubTab = tabs.find(t => t.url === hubUrl)
  
  const [currentView, setCurrentView] = useState<View>('home')
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [forms, setForms] = useState<Form[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all')

  // Initialize state from metadata
  useEffect(() => {
    if (hubTab && !isInitialized) {
      const savedView = (hubTab.metadata?.currentView as View) || 'home'
      const savedFormId = hubTab.metadata?.selectedFormId as string
      setCurrentView(savedView)
      if (savedFormId) setSelectedFormId(savedFormId)
      setIsInitialized(true)
    }
  }, [hubTab, isInitialized])

  // Fetch forms
  useEffect(() => {
    const fetchForms = async () => {
      try {
        setIsLoading(true)
        const data = await goClient.get<Form[]>('/forms', { workspace_id: workspaceId })
        setForms(data || [])
      } catch (error) {
        console.error('Failed to fetch forms:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    if (workspaceId) {
      fetchForms()
    }
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
      title: 'Applications Hub'
    })

    setTabActions([
      {
        label: 'New Application',
        icon: Plus,
        onClick: () => {},
        variant: 'default'
      }
    ])

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
      hubName: 'Applications Hub',
      placeholder: 'Search applications...',
      actions: [
        { id: 'new-app', label: 'New Application', icon: Plus, action: () => {} }
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

  const handleFormClick = (formId: string) => {
    setSelectedFormId(formId)
    setCurrentView('scholarships')
  }

  // If we are in the scholarships module, render the manager
  if (currentView === 'scholarships') {
    return (
      <ScholarshipManager 
        workspaceId={workspaceId}
        formId={selectedFormId}
      />
    )
  }

  const filteredForms = forms.filter(form => {
    const matchesSearch = !searchQuery || 
      form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (form.description || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = filterStatus === 'all' || 
      (filterStatus === 'active' && form.is_public) ||
      (filterStatus === 'draft' && !form.is_public)
    return matchesSearch && matchesFilter
  })

  return (
    <div className="h-full flex bg-gray-50/50">
      {/* Left Sidebar */}
      <div className="w-56 flex-shrink-0 bg-white border-r border-gray-200 p-3 flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <Input 
            placeholder="Filter applications..." 
            className="pl-8 h-8 text-sm bg-gray-50/50 border-gray-200"
          />
        </div>

        {/* Stats */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total</span>
            <span className="font-semibold text-gray-900">{forms.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              Active
            </span>
            <span className="font-semibold text-green-600">{forms.filter(f => f.is_public).length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              Draft
            </span>
            <span className="font-semibold text-gray-600">{forms.filter(f => !f.is_public).length}</span>
          </div>
        </div>

        {/* Status Filter */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide px-1">Status</span>
          <div className="space-y-0.5">
            {[
              { value: 'all', label: 'All Applications' },
              { value: 'active', label: 'Active' },
              { value: 'draft', label: 'Draft' }
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setFilterStatus(option.value as 'all' | 'active' | 'draft')}
                className={cn(
                  "w-full text-left px-2.5 py-1.5 rounded-md text-sm transition-colors",
                  filterStatus === option.value
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white rounded-tl-xl rounded-bl-xl border-l border-gray-200">
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="text-center py-16">
              <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery || filterStatus !== 'all' ? 'No matching applications' : 'No applications yet'}
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                {searchQuery || filterStatus !== 'all' 
                  ? 'Try adjusting your search or filters'
                  : 'Create your first application to get started'}
              </p>
              {!searchQuery && filterStatus === 'all' && (
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Application
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredForms.map((form) => (
                <div 
                  key={form.id}
                  onClick={() => handleFormClick(form.id)}
                  className="group bg-gray-50 rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                          <GraduationCap className="w-5 h-5 text-blue-600" />
                        </div>
                        <button 
                          className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <h3 className="text-base font-semibold text-gray-900 mb-1 group-hover:text-blue-600 line-clamp-1">
                        {form.name}
                      </h3>
                      <p className="text-gray-500 text-sm mb-3 line-clamp-2 min-h-[2.5rem]">
                        {form.description || 'No description provided.'}
                      </p>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${form.is_public ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs font-medium text-gray-600">
                            {form.is_public ? 'Active' : 'Draft'}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                          Open <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Create New Card */}
                  <button 
                    className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all min-h-[180px]"
                    onClick={() => {}}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <Plus className="w-5 h-5" />
                    </div>
                    <h3 className="font-medium text-sm mb-1">Create Application</h3>
                    <p className="text-xs text-center max-w-[160px]">
                      Start a new application process
                    </p>
                  </button>
                </div>
              )}
        </div>
      </div>
    </div>
  )
}
