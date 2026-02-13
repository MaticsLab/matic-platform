'use client'

import { useState, useEffect, useMemo } from 'react'
import { FileCheck, Settings, Layers } from 'lucide-react'
import { ReviewWorkspaceV2 } from './Review/v2'
import { ApplicationSettingsModal } from './Configuration/ApplicationSettingsModal'
import { useBreadcrumbs } from '@/hooks/useBreadcrumbs'
import { Button } from '@/ui-components/button'
import { goClient } from '@/lib/api/go-client'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { Form } from '@/types/forms'
import { useParams } from 'next/navigation'

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

  // Memoize breadcrumb items to prevent infinite loop
  const breadcrumbItems = useMemo(
    () => [
      {
        label: 'Forms',
        href: `/workspace/${workspaceSlug}/applications`,
        icon: Layers
      },
      {
        label: form?.name || 'Loading...',
        href: `/workspace/${workspaceSlug}/applications/${formId}`,
        icon: FileCheck
      }
    ],
    [workspaceSlug, form?.name, formId]
  )

  // Memoize breadcrumb actions to prevent infinite loop
  const breadcrumbActions = useMemo(
    () => (
      <>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAppSettingsModalOpen(true)}
          title="Form Settings"
        >
          <Settings className="w-4 h-4" />
        </Button>
      </>
    ),
    []
  )

  // Memoize options object to prevent infinite loop
  const breadcrumbOptions = useMemo(
    () => ({
      actions: breadcrumbActions
    }),
    [breadcrumbActions]
  )

  // Set breadcrumbs with page actions
  useBreadcrumbs(breadcrumbItems, breadcrumbOptions)

  if (!formId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">No form selected</p>
      </div>
    )
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
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
