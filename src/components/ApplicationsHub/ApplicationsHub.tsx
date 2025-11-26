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

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Applications Hub</h1>
            <p className="text-gray-600">Manage your application programs and forms</p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New Application
          </Button>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search applications..." className="pl-9 bg-gray-50 border-gray-200" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {forms.map((form) => (
              <div 
                key={form.id}
                onClick={() => handleFormClick(form.id)}
                className="group bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all cursor-pointer flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <GraduationCap className="w-6 h-6 text-blue-600" />
                  </div>
                  <button className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                  {form.name}
                </h3>
                <p className="text-gray-600 text-sm mb-6 flex-1 line-clamp-2">
                  {form.description || 'No description provided.'}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className={`w-2 h-2 rounded-full ${form.is_public ? 'bg-green-500' : 'bg-gray-300'}`} />
                    {form.is_public ? 'Active' : 'Draft'}
                  </div>
                  <span className="text-sm font-medium text-blue-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </div>
            ))}

            {/* Create New Card */}
            <button className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all min-h-[240px]">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-blue-100">
                <Plus className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg mb-1">Create Application</h3>
              <p className="text-sm text-center max-w-[200px]">
                Start a new application process from scratch or a template
              </p>
            </button>

          </div>
        )}
      </div>
    </div>
  )
}
