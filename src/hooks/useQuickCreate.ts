'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/auth/provider'
import { goClient } from '@/lib/api/go-client'
import { tablesGoClient } from '@/lib/api/tables-go-client'
import type { Form } from '@/types/forms'
import { toast } from 'sonner'

interface UseQuickCreateArgs {
  workspaceId: string
  workspaceSlug: string
}

/**
 * Shared "create a form" / "create a table" logic used by both the home page
 * and the sidebar's "+ Create" button, so the two never drift apart.
 */
export function useQuickCreate({ workspaceId, workspaceSlug }: UseQuickCreateArgs) {
  const router = useRouter()
  const { data } = useSession()
  const [creatingForm, setCreatingForm] = useState(false)
  const [creatingTable, setCreatingTable] = useState(false)

  const handleCreateForm = async () => {
    setCreatingForm(true)
    try {
      const form = await goClient.post<Form>('/forms', {
        workspace_id: workspaceId,
        name: 'Untitled form',
        description: '',
        status: 'draft',
        is_public: false,
        settings: {},
        submit_settings: {},
      })
      router.push(`/workspace/${workspaceSlug}/applications/${form.id}`)
    } catch (err) {
      console.error('Failed to create form:', err)
      toast.error('Failed to create form')
      setCreatingForm(false)
    }
  }

  const handleCreateTable = async () => {
    setCreatingTable(true)
    try {
      const userId = data?.user?.id || ''
      await tablesGoClient.createTable({ workspace_id: workspaceId, name: 'Untitled table' }, userId)
      toast.success('Table created')
      // No dedicated table-viewer page exists yet — land back on Home, which
      // already lists every table.
      router.push(`/workspace/${workspaceSlug}`)
    } catch (err) {
      console.error('Failed to create table:', err)
      toast.error('Failed to create table')
    } finally {
      setCreatingTable(false)
    }
  }

  return { handleCreateForm, creatingForm, handleCreateTable, creatingTable }
}
