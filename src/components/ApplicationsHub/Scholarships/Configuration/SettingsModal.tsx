'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/ui-components/dialog'
import { goClient } from '@/lib/api/go-client'
import { Form } from '@/types/forms'
import { WorkflowBuilder } from './WorkflowBuilder'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  onSave: () => void
}

export function SettingsModal({ open, onOpenChange, formId, onSave }: SettingsModalProps) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (open && formId) {
      fetchForm()
    }
  }, [open, formId])

  const fetchForm = async () => {
    setIsLoading(true)
    try {
      const form = await goClient.get<Form>(`/forms/${formId}`)
      if (form.workspace_id) {
        setWorkspaceId(form.workspace_id)
      }
    } catch (error) {
      console.error('Failed to fetch form:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden">
        {workspaceId ? (
          <WorkflowBuilder workspaceId={workspaceId} />
        ) : (
          <div className="p-6 text-center">
            {isLoading ? 'Loading...' : 'Failed to load workspace information.'}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
