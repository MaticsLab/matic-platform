'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Plus, Loader2 } from 'lucide-react'
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { Button } from '@/ui-components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui-components/dialog"
import { Label } from "@/ui-components/label"
import { Textarea } from "@/ui-components/textarea"
import { Input } from '@/ui-components/input'
import { toast } from "sonner"
import { goClient } from '@/lib/api/go-client'
import { formsClient } from '@/lib/api/forms-client'
import { Form } from '@/types/forms'
import { cn } from '@/lib/utils'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { useSession } from '@/auth/client/main'

interface ApplicationsHubProps {
  workspaceId: string
}

export function ApplicationsHub({ workspaceId }: ApplicationsHubProps) {
  const router = useRouter()
  const params = useParams()
  const workspaceSlug = params?.slug as string
  const { data: session } = useSession()

  const [forms, setForms] = useState<Form[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all')

  // Create Form State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newAppName, setNewAppName] = useState('')
  const [newAppDescription, setNewAppDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Memoize breadcrumb items to prevent infinite loop
  const breadcrumbItems = useMemo(() => [
    { label: 'Forms', href: `/workspace/${workspaceSlug}/applications` }
  ], [workspaceSlug])

  // Memoize breadcrumb actions to prevent infinite loop
  const breadcrumbActions = useMemo(() => (
    <Button onClick={() => setIsCreateDialogOpen(true)}>
      <Plus className="w-4 h-4 mr-2" />
      New Form
    </Button>
  ), [])

  // Memoize options object to prevent infinite loop
  const breadcrumbOptions = useMemo(() => ({
    actions: breadcrumbActions
  }), [breadcrumbActions])

  // Set breadcrumbs for forms list
  useBreadcrumbs(breadcrumbItems, breadcrumbOptions)

  // Fetch forms
  useEffect(() => {
    const fetchForms = async () => {
      if (!workspaceId) return

      try {
        setIsLoading(true)
        const formsArray = await formsClient.list(workspaceId)
        setForms(formsArray)
      } catch (error: any) {
        console.error('Failed to fetch forms:', error)
        toast.error('Failed to load forms')
        setForms([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchForms()
  }, [workspaceId])

  const handleCreateApplication = async () => {
    if (!newAppName.trim()) {
      toast.error('Form name is required')
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
      toast.success('Form created successfully')

      // Navigate to the new form
      handleFormClick(newForm.id)
    } catch (error) {
      console.error('Failed to create form:', error)
      toast.error('Failed to create form')
    } finally {
      setIsCreating(false)
    }
  }

  const handleFormClick = (formId: string) => {
    // Use router navigation instead of tab manager
    const targetPath = `/workspace/${workspaceSlug}/applications/${formId}`
    console.log('[ApplicationsHub] Navigating to:', targetPath)
    console.log('[ApplicationsHub] FormId:', formId, 'WorkspaceSlug:', workspaceSlug)
    router.push(targetPath)
  }

  // Filter forms list
  const filteredForms = forms.filter(form => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'active') return form.status === 'published'
    if (filterStatus === 'draft') return form.status === 'draft'
    return true
  })

  return (
    <div className="flex-1 overflow-auto p-6">
      {isLoading ? (
        <LoadingOverlay message="Loading forms..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => (
            <button
              key={form.id}
              onClick={() => handleFormClick(form.id)}
              className={cn(
                "group relative p-6 text-left rounded-lg border-2 transition-all",
                "hover:border-blue-500 hover:shadow-lg",
                "focus:outline-none focus:ring-2 focus:ring-blue-500"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-blue-600">
                    {form.name}
                  </h3>
                  {form.description && (
                    <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                      {form.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className={cn(
                  "px-2 py-1 rounded-full font-medium",
                  form.status === 'published' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                )}>
                  {form.status}
                </span>
                <span>{new Date(form.created_at).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Form Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Form</DialogTitle>
            <DialogDescription>
              Create a new form for your workspace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Form Name*</Label>
              <Input
                id="name"
                placeholder="Summer Program 2024"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this application..."
                value={newAppDescription}
                onChange={(e) => setNewAppDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateApplication} disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Form'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
