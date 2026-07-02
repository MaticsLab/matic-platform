'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Database, Plus, Loader2 } from 'lucide-react'
import { useSession } from '@/components/auth/provider'
import { goClient } from '@/lib/api/go-client'
import { formsClient } from '@/lib/api/forms-client'
import { tablesGoClient } from '@/lib/api/tables-go-client'
import type { Form } from '@/types/forms'
import type { DataTable } from '@/types/data-tables'
import { toast } from 'sonner'

interface WorkspaceHomeProps {
  workspaceId: string
  workspaceSlug: string
}

type WorkspaceItem =
  | { kind: 'form'; id: string; name: string; updatedAt: string; status: Form['status'] }
  | { kind: 'table'; id: string; name: string; updatedAt: string; rowCount: number }

export function WorkspaceHome({ workspaceId, workspaceSlug }: WorkspaceHomeProps) {
  const router = useRouter()
  const { data } = useSession()
  const displayName = data?.user?.name?.split(' ')[0] || data?.user?.email?.split('@')[0] || 'there'

  const [items, setItems] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingForm, setCreatingForm] = useState(false)
  const [creatingTable, setCreatingTable] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        setLoading(true)
        const [forms, tables] = await Promise.all([
          formsClient.list(workspaceId).catch(() => [] as Form[]),
          tablesGoClient.getTablesByWorkspace(workspaceId).catch(() => [] as DataTable[]),
        ])

        if (!isMounted) return

        const formItems: WorkspaceItem[] = forms.map((f) => ({
          kind: 'form',
          id: f.id,
          name: f.name,
          updatedAt: (f as any).updated_at || f.created_at,
          status: f.status,
        }))
        const tableItems: WorkspaceItem[] = tables
          .filter((t) => !t.is_archived && !t.is_hidden)
          .map((t) => ({
            kind: 'table',
            id: t.id,
            name: t.name,
            updatedAt: (t as any).updated_at || '',
            rowCount: t.row_count,
          }))

        const combined = [...formItems, ...tableItems].sort(
          (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
        )
        setItems(combined)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [workspaceId])

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
      router.push(`/workspace/${workspaceSlug}/applications`)
    } catch (err) {
      console.error('Failed to create table:', err)
      toast.error('Failed to create table')
    } finally {
      setCreatingTable(false)
    }
  }

  const handleOpenItem = (item: WorkspaceItem) => {
    if (item.kind === 'form') {
      router.push(`/workspace/${workspaceSlug}/applications/${item.id}`)
    } else {
      router.push(`/workspace/${workspaceSlug}/applications`)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#fafafa]">
      {/* Hero */}
      <div className="border-b border-neutral-200 bg-white px-8 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-[26px] font-semibold tracking-tight text-neutral-900 mb-8">
            What do you want to create?
          </h1>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleCreateForm}
              disabled={creatingForm}
              className="group flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-[14px] font-medium text-neutral-800 shadow-sm transition-all duration-150 hover:border-neutral-300 hover:shadow-md disabled:opacity-60"
            >
              {creatingForm ? (
                <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
              ) : (
                <FileText className="h-4 w-4 text-blue-600" />
              )}
              Form
            </button>
            <button
              onClick={handleCreateTable}
              disabled={creatingTable}
              className="group flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white px-5 py-3 text-[14px] font-medium text-neutral-800 shadow-sm transition-all duration-150 hover:border-neutral-300 hover:shadow-md disabled:opacity-60"
            >
              {creatingTable ? (
                <Loader2 className="h-4 w-4 animate-spin text-neutral-500" />
              ) : (
                <Database className="h-4 w-4 text-emerald-600" />
              )}
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Welcome + grid */}
      <div className="mx-auto max-w-5xl px-8 py-10">
        <h2 className="text-[22px] font-semibold tracking-tight text-neutral-900 mb-6">
          Welcome, {displayName}
        </h2>

        {loading ? (
          <div className="flex items-center gap-2 text-neutral-500 text-[14px] py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your workspace...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center">
            <p className="text-[14px] text-neutral-500">
              Nothing here yet — create your first form or table above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <button
                key={`${item.kind}-${item.id}`}
                onClick={() => handleOpenItem(item)}
                className="flex flex-col items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-all duration-150 hover:border-neutral-300 hover:shadow-md"
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    item.kind === 'form' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                  }`}
                >
                  {item.kind === 'form' ? <FileText className="h-4.5 w-4.5" /> : <Database className="h-4.5 w-4.5" />}
                </div>
                <div className="min-w-0 w-full">
                  <p className="truncate text-[14px] font-medium text-neutral-900">{item.name}</p>
                  <p className="text-[12px] text-neutral-500">
                    {item.kind === 'form' ? item.status : `${item.rowCount} rows`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
