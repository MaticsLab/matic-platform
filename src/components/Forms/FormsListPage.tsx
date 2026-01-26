"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus, Eye, Edit, Trash2, MoreVertical, Copy } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Card } from '@/ui-components/card'
import { Badge } from '@/ui-components/badge'
import { formsSupabase } from '@/lib/api/forms-supabase'
import type { Form } from '@/types/forms'
import { toast } from 'sonner'
import { LoadingOverlay } from '@/components/LoadingOverlay'

interface FormsListPageProps {
  workspaceId: string
}

export function FormsListPage({ workspaceId }: FormsListPageProps) {
  const router = useRouter()
  const [forms, setForms] = useState<Form[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadForms()
  }, [workspaceId])

    const loadForms = async () => {
    try {
      setLoading(true)
      console.log('🔍 Loading forms for workspace:', workspaceId)
      const data = await formsSupabase.getFormsByWorkspace(workspaceId)
      console.log('✅ Forms loaded:', data.length, data)
      setForms(data)
      if (data.length === 0) {
        toast.info('No forms found in this workspace. Create your first form!')
      }
    } catch (error: any) {
      console.error('❌ Error loading forms:', error)
      toast.error(`Failed to load forms: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateForm = () => {
    // TODO: Open create form dialog
    toast.info('Form builder coming soon!')
  }

  const handleDeleteForm = async (formId: string, formName: string) => {
    if (!confirm(`Are you sure you want to delete "${formName}"?`)) return

    try {
      await formsSupabase.deleteForm(formId)
      toast.success('Form deleted')
      loadForms()
    } catch (error) {
      console.error('Error deleting form:', error)
      toast.error('Failed to delete form')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      case 'archived':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <LoadingOverlay message="Loading forms..." fullScreen={false} />
  }

  if (forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <FileText className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No forms yet</h3>
        <p className="text-gray-600 mb-4">Create your first form to start collecting responses</p>
        <Button onClick={handleCreateForm} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Form
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
          <p className="text-gray-600">Create and manage forms for data collection</p>
        </div>
        <Button onClick={handleCreateForm} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Form
        </Button>
      </div>

      {/* Forms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map((form) => (
          <Card key={form.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{form.name}</h3>
                  {form.description && (
                    <p className="text-sm text-gray-600 line-clamp-2">{form.description}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Badge className={getStatusColor(form.status)}>
                {form.status}
              </Badge>
              {form.is_public && (
                <Badge variant="outline" className="text-xs">
                  Public
                </Badge>
              )}
            </div>

            <div className="text-sm text-gray-600 mb-4">
              <div className="flex items-center justify-between">
                <span>{form.fields?.length || 0} fields</span>
                <span className="text-xs">v{form.version}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => toast.info('Form preview coming soon!')}
              >
                <Eye className="h-4 w-4" />
                View
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-2"
                onClick={() => toast.info('Form editor coming soon!')}
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDeleteForm(form.id, form.name)}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>

            {form.published_at && (
              <div className="text-xs text-gray-500 mt-3 pt-3 border-t">
                Published {new Date(form.published_at).toLocaleDateString()}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
