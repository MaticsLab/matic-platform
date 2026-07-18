'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Plus, Loader2, Inbox, Link2 } from 'lucide-react'
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
  workspaceSlug?: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? 's' : ''} ago`
}

export function ApplicationsHub({ workspaceId, workspaceSlug: workspaceSlugProp }: ApplicationsHubProps) {
  const router = useRouter()
  const params = useParams()
  const workspaceSlug = workspaceSlugProp || (params?.slug as string)
  const { data: session } = useSession()

  const firstName = (session?.user as any)?.name?.split(' ')[0]
    || (session?.user as any)?.user_metadata?.full_name?.split(' ')[0]
    || (session?.user as any)?.email?.split('@')[0]
    || 'there'

  const [forms, setForms] = useState<Form[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Create Form State
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newAppName, setNewAppName] = useState('')
  const [newAppDescription, setNewAppDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

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
      handleFormClick(newForm.id)
    } catch (error) {
      console.error('Failed to create form:', error)
      toast.error('Failed to create form')
    } finally {
      setIsCreating(false)
    }
  }

  const handleFormClick = (formId: string) => {
    router.push(`/workspace/${workspaceSlug}/applications/${formId}`)
  }

  const handleCopyLink = (e: React.MouseEvent, form: Form) => {
    e.stopPropagation()
    // Use custom_slug if set, otherwise fall back to form UUID
    // In dev/Vercel preview: /apply/{slug}  — in prod middleware rewrites subdomain traffic
    const applySlug = (form as any).custom_slug || form.id
    const url = `${window.location.origin}/apply/${applySlug}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied'))
  }

  if (isLoading) return <LoadingOverlay message="Loading forms..." />

  return (
    <div className="flex-1 overflow-auto bg-white">
      {/* Hero banner */}
      <div className="relative mx-4 mt-4 h-[220px] rounded-2xl overflow-hidden">
        <img
          src="/hero/city.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-[center_30%]"
        />
        {/* subtle darkening gradient on left side for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent" />

        <div className="relative z-10 p-8 h-full flex flex-col justify-center">
          <h1 className="text-3xl font-bold text-white mb-3">
            Welcome, {firstName}
          </h1>
          <p className="text-white/80 text-sm font-medium mb-4">Quick start</p>
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-medium hover:bg-white/30 transition-colors w-fit"
          >
            <Plus className="w-3.5 h-3.5" />
            Create new form
          </button>
        </div>
      </div>

      {/* Forms grid */}
      <div className="px-6 py-6">
        {forms.length > 0 && (
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All forms</h2>
        )}

        {forms.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm mb-4">No forms yet</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create your first form
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {forms.map((form) => (
              <button
                key={form.id}
                onClick={() => handleFormClick(form.id)}
                className="group relative p-5 text-left rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                {/* Top row: inbox icon + submission count */}
                <div className="flex items-center justify-between mb-6">
                  <div />
                  <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <Inbox className="w-4 h-4" />
                    {(form.submission_count ?? 0) > 0 && (
                      <span className="font-medium">{form.submission_count}</span>
                    )}
                  </div>
                </div>

                {/* Form name */}
                <div className="mb-1">
                  <h3 className="text-[15px] font-semibold text-gray-900 leading-snug group-hover:text-gray-700 line-clamp-2">
                    {form.name}
                  </h3>
                </div>

                {/* Last updated */}
                <p className="text-xs text-gray-400 mb-4">
                  Updated {timeAgo(form.updated_at)}
                </p>

                {/* Bottom row: link icon */}
                <div className="flex justify-end">
                  <button
                    onClick={(e) => handleCopyLink(e, form)}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                    title="Copy public link"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
                placeholder="2026 Application Cycle"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateApplication()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this form..."
                value={newAppDescription}
                onChange={(e) => setNewAppDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>
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
