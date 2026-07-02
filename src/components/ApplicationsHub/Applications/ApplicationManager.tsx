'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Settings, BarChart2, PencilLine } from 'lucide-react'
import { ReviewWorkspaceV2 } from './Review/v2'
import { ApplicationSettingsModal } from './Configuration/ApplicationSettingsModal'
import { Button } from '@/ui-components/button'
import { goClient } from '@/lib/api/go-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { Form } from '@/types/forms'

interface ApplicationManagerProps {
  workspaceId: string
  formId: string | null
}

interface Stats {
  totalSubmissions: number
  pendingReview: number
  inProgress: number
  completed: number
}

export function ApplicationManager({ workspaceId, formId }: ApplicationManagerProps) {
  const router = useRouter()
  const params = useParams()
  const slugFromUrl = params?.slug as string

  const [form, setForm] = useState<Form | null>(null)
  const [workspaceSlug, setWorkspaceSlug] = useState<string>('')
  const [isAppSettingsModalOpen, setIsAppSettingsModalOpen] = useState(false)
  const [stats, setStats] = useState<Stats>({
    totalSubmissions: 0,
    pendingReview: 0,
    inProgress: 0,
    completed: 0,
  })

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

  if (!formId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No form selected</p>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* Form toolbar */}
      <div className="flex items-center justify-end gap-1 border-b border-gray-200 bg-white px-4 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (workspaceSlug && formId) {
              router.push(`/workspace/${workspaceSlug}/applications/${formId}`)
            }
          }}
          title="View Analytics"
        >
          <BarChart2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (workspaceSlug && formId) {
              router.push(`/workspace/${workspaceSlug}/portal-editor?formId=${formId}`)
            }
          }}
          title="Form Editor"
        >
          <PencilLine className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsAppSettingsModalOpen(true)} title="Form Settings">
          <Settings className="w-4 h-4" />
        </Button>
      </div>

      {/* Main Review Content */}
      <ReviewWorkspaceV2
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        formId={formId}
      />

      {/* Settings Modal */}
      {isAppSettingsModalOpen && form && (
        <ApplicationSettingsModal
          open={isAppSettingsModalOpen}
          onOpenChange={setIsAppSettingsModalOpen}
          workspaceId={workspaceId}
          formId={form.id}
          onSave={() => {
            // Optionally refresh the form data after save
            setIsAppSettingsModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
