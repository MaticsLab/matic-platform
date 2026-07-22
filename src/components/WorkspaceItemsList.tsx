'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Database, Star, LayoutGrid, List as ListIcon, Loader2 } from 'lucide-react'
import { formsClient } from '@/lib/api/forms-client'
import { tablesGoClient } from '@/lib/api/tables-go-client'
import { recentlyViewedClient } from '@/lib/api/recently-viewed-client'
import { starredItemsClient } from '@/lib/api/starred-items-client'
import type { Form } from '@/types/forms'
import type { DataTable } from '@/types/data-tables'
import { cn } from '@/lib/utils'

export type WorkspaceItem =
  | { kind: 'form'; id: string; name: string; updatedAt: string; status: Form['status'] }
  | { kind: 'table'; id: string; name: string; updatedAt: string; rowCount: number }

interface WorkspaceItemsListProps {
  workspaceId: string
  workspaceSlug: string
  filter: 'all' | 'starred' | 'trash'
  emptyMessage?: string
  /** Called once loaded items + starred ids are known, so a parent (e.g. Home's
   *  "Recently viewed" row) can resolve entity ids to display info. */
  onItemsLoaded?: (items: WorkspaceItem[], starredIds: Set<string>) => void
}

export function WorkspaceItemsList({
  workspaceId,
  workspaceSlug,
  filter,
  emptyMessage = 'Nothing here yet.',
  onItemsLoaded,
}: WorkspaceItemsListProps) {
  const router = useRouter()
  const [allItems, setAllItems] = useState<WorkspaceItem[]>([])
  const [trashItems, setTrashItems] = useState<WorkspaceItem[]>([])
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'updated' | 'name'>('updated')

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        setLoading(true)
        const [forms, tables, stars] = await Promise.all([
          formsClient.list(workspaceId).catch(() => [] as Form[]),
          tablesGoClient.getTablesByWorkspace(workspaceId).catch(() => [] as DataTable[]),
          starredItemsClient.list(workspaceId).catch(() => []),
        ])

        if (!isMounted) return

        const activeForms = forms.filter((f) => f.status !== 'archived')
        const archivedForms = forms.filter((f) => f.status === 'archived')
        const activeTables = tables.filter((t) => !t.is_archived && !t.is_hidden)
        const archivedTables = tables.filter((t) => t.is_archived)

        const toItems = (fs: Form[], ts: DataTable[]): WorkspaceItem[] => [
          ...fs.map((f) => ({
            kind: 'form' as const,
            id: f.id,
            name: f.name,
            updatedAt: (f as any).updated_at || f.created_at,
            status: f.status,
          })),
          ...ts.map((t) => ({
            kind: 'table' as const,
            id: t.id,
            name: t.name,
            updatedAt: (t as any).updated_at || '',
            rowCount: t.row_count,
          })),
        ]

        const nextAllItems = toItems(activeForms, activeTables)
        const nextTrashItems = toItems(archivedForms, archivedTables)
        const nextStarredIds = new Set(stars.map((s) => `${s.entity_type}:${s.entity_id}`))

        setAllItems(nextAllItems)
        setTrashItems(nextTrashItems)
        setStarredIds(nextStarredIds)
        onItemsLoaded?.([...nextAllItems, ...nextTrashItems], nextStarredIds)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const items = useMemo(() => {
    const source =
      filter === 'trash'
        ? trashItems
        : filter === 'starred'
          ? allItems.filter((i) => starredIds.has(`${i.kind}:${i.id}`))
          : allItems

    const sorted = [...source]
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      sorted.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
    }
    return sorted
  }, [filter, allItems, trashItems, starredIds, sortBy])

  const handleOpenItem = (item: WorkspaceItem) => {
    recentlyViewedClient.record(workspaceId, item.id, item.kind).catch(() => {})
    if (item.kind === 'form') {
      router.push(`/workspace/${workspaceSlug}/applications/${item.id}`)
    } else {
      // No dedicated table-viewer page exists yet — land back on Home, which
      // already lists every table.
      router.push(`/workspace/${workspaceSlug}`)
    }
  }

  const toggleStar = async (item: WorkspaceItem, e: React.MouseEvent) => {
    e.stopPropagation()
    const key = `${item.kind}:${item.id}`
    const wasStarred = starredIds.has(key)

    setStarredIds((prev) => {
      const next = new Set(prev)
      if (wasStarred) next.delete(key)
      else next.add(key)
      return next
    })

    try {
      if (wasStarred) {
        await starredItemsClient.unstar(workspaceId, item.id, item.kind)
      } else {
        await starredItemsClient.star(workspaceId, item.id, item.kind)
      }
    } catch {
      // Revert the optimistic update if the request failed.
      setStarredIds((prev) => {
        const next = new Set(prev)
        if (wasStarred) next.add(key)
        else next.delete(key)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-neutral-500 text-[14px] py-12 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-4">
        <div className="flex p-[3px] bg-[#f1f0ec] rounded-[9px]">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'flex h-7 w-8 items-center justify-center rounded-[7px] transition-colors',
              viewMode === 'grid' ? 'bg-white text-[#1b1b17] shadow-sm' : 'text-[#8a897f]'
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'flex h-7 w-8 items-center justify-center rounded-[7px] transition-colors',
              viewMode === 'list' ? 'bg-white text-[#1b1b17] shadow-sm' : 'text-[#8a897f]'
            )}
            aria-label="List view"
          >
            <ListIcon className="h-4 w-4" />
          </button>
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'updated' | 'name')}
          className="h-9 rounded-[10px] border border-[#e6e5df] bg-white px-3 text-[14px] font-medium text-[#3f3e35]"
        >
          <option value="updated">Sorted by: Updated</option>
          <option value="name">Sorted by: Name</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 bg-white py-16 text-center">
          <p className="text-[14px] text-neutral-500">{emptyMessage}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const key = `${item.kind}:${item.id}`
            const starred = starredIds.has(key)
            return (
              <button
                key={key}
                onClick={() => handleOpenItem(item)}
                className="group relative flex flex-col items-start rounded-[14px] border border-[#ecebe5] bg-white text-left overflow-hidden transition-all duration-150 hover:shadow-[0_10px_26px_-12px_rgba(30,26,20,0.22)] hover:-translate-y-0.5 hover:border-[#e0dfd7]"
              >
                <div
                  className={cn(
                    'flex h-[100px] w-full items-center justify-center border-b border-[#f0efe9]',
                    item.kind === 'form' ? 'bg-blue-50' : 'bg-emerald-50'
                  )}
                >
                  {item.kind === 'form' ? (
                    <FileText className="h-6 w-6 text-blue-500" />
                  ) : (
                    <Database className="h-6 w-6 text-emerald-500" />
                  )}
                </div>
                <div className="flex w-full items-center gap-3 p-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]',
                      item.kind === 'form' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                    )}
                  >
                    {item.kind === 'form' ? <FileText className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold text-[#25241d]">{item.name}</p>
                    <p className="text-[12.5px] text-[#98978c]">
                      {item.kind === 'form' ? item.status : `${item.rowCount} rows`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => toggleStar(item, e)}
                  aria-label={starred ? 'Unstar' : 'Star'}
                  className={cn(
                    'absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border border-[#eceae4] bg-white/90 shadow-sm transition-opacity',
                    starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                >
                  <Star className={cn('h-3.5 w-3.5', starred ? 'fill-amber-400 text-amber-400' : 'text-[#a8a79c]')} />
                </button>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rounded-[14px] border border-[#ecebe5] bg-white overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2.4fr)_1fr_1fr_1.3fr] gap-4 px-5 py-3 border-b border-[#f0efe9] text-[12.5px] font-bold text-[#98978c]">
            <span>Item</span>
            <span>Creator</span>
            <span>Created</span>
            <span>Details</span>
          </div>
          {items.map((item) => {
            const key = `${item.kind}:${item.id}`
            const starred = starredIds.has(key)
            return (
              <div
                key={key}
                onClick={() => handleOpenItem(item)}
                className="grid grid-cols-[minmax(0,2.4fr)_1fr_1fr_1.3fr] gap-4 items-center px-5 py-3.5 border-b border-[#f4f3ee] cursor-pointer transition-colors hover:bg-[#faf9f6] last:border-b-0"
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]',
                      item.kind === 'form' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                    )}
                  >
                    {item.kind === 'form' ? <FileText className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                  </span>
                  <span className="truncate text-[14.5px] font-semibold text-[#25241d]">{item.name}</span>
                  <button
                    onClick={(e) => toggleStar(item, e)}
                    aria-label={starred ? 'Unstar' : 'Star'}
                    className="ml-auto shrink-0"
                  >
                    <Star className={cn('h-4 w-4', starred ? 'fill-amber-400 text-amber-400' : 'text-[#c7c6bb]')} />
                  </button>
                </span>
                <span className="text-[14px] text-[#54534a]">—</span>
                <span className="text-[14px] text-[#54534a]">
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '—'}
                </span>
                <span className="text-[14px] text-[#54534a]">
                  {item.kind === 'form' ? item.status : `${item.rowCount} rows`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
