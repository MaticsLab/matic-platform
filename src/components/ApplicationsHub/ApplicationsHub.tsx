'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, FileText, Layout, Plus, Search, MoreVertical, ArrowRight, Loader2 } from 'lucide-react'
import { ScholarshipManager } from './Scholarships/ScholarshipManager'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { useTabContext } from '@/components/WorkspaceTabProvider'
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'

interface ApplicationsHubProps {
  workspaceId: string
}

type View = 'home' | 'scholarships' | 'create'

export function ApplicationsHub({ workspaceId }: ApplicationsHubProps) {
  const { registerNavigationHandler, tabs, tabManager } = useTabContext()
  const hubUrl = `/workspace/${workspaceId}/applications`
  const hubTab = tabs.find(t => t.url === hubUrl)
  
  const [currentView, setCurrentView] = useState<View>('home')
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [forms, setForms] = useState<Form[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all')

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
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 via-white to-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-blue-600" />
              Applications Hub
            </h1>
            <p className="text-gray-600 mt-2">Manage your application programs and review processes</p>
          </div>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all">
            <Plus className="w-4 h-4" />
            New Application
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Search applications..." 
              className="pl-9 bg-gray-50 border-gray-200 focus:bg-white focus:border-blue-300 transition-colors"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
              className={filterStatus === 'all' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('active')}
              className={filterStatus === 'active' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              Active
            </Button>
            <Button
              variant={filterStatus === 'draft' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('draft')}
              className={filterStatus === 'draft' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              Draft
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
            {filteredForms.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredForms.map((form) => (
                  <div 
                    key={form.id}
                    onClick={() => handleFormClick(form.id)}
                    className="group bg-white rounded-xl border-2 border-gray-200 p-6 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer flex flex-col transform hover:-translate-y-1"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                        <GraduationCap className="w-7 h-7 text-blue-600" />
                      </div>
                      <button 
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          // TODO: Add context menu
                        }}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {form.name}
                    </h3>
                    <p className="text-gray-600 text-sm mb-6 flex-1 line-clamp-3 min-h-[3.75rem]">
                      {form.description || 'No description provided.'}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${form.is_public ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                        <span className="text-sm font-medium text-gray-700">
                          {form.is_public ? 'Active' : 'Draft'}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                ))}

                {/* Create New Card */}
                <button 
                  className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all min-h-[280px] group"
                  onClick={() => {
                    // TODO: Open create form dialog
                  }}
                >
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-blue-100 group-hover:scale-110 transition-all">
                    <Plus className="w-7 h-7" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">Create Application</h3>
                  <p className="text-sm text-center max-w-[200px]">
                    Start a new application process from scratch or a template
                  </p>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
