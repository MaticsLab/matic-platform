'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText, Database, Plus, Mic, ArrowUp, UserPlus, Sparkles } from 'lucide-react'
import { useSession } from '@/components/auth/provider'
import { useQuickCreate } from '@/hooks/useQuickCreate'
import { recentlyViewedClient, type RecentlyViewedEntry } from '@/lib/api/recently-viewed-client'
import { WorkspaceItemsList, type WorkspaceItem } from './WorkspaceItemsList'
import { InviteToWorkspaceSidebarV2 } from './InviteToWorkspaceSidebarV2'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { cn } from '@/lib/utils'

interface WorkspaceHomeProps {
  workspaceId: string
  workspaceSlug: string
  workspaceName?: string
}

const CREATE_TABS = [
  { key: 'app', label: 'App', icon: Sparkles },
  { key: 'database', label: 'Database', icon: Database },
  { key: 'form', label: 'Form', icon: FileText },
] as const

export function WorkspaceHome({ workspaceId, workspaceSlug, workspaceName }: WorkspaceHomeProps) {
  const { data } = useSession()
  const displayName = data?.user?.name?.split(' ')[0] || data?.user?.email?.split('@')[0] || 'there'

  const { handleCreateForm, creatingForm, handleCreateTable, creatingTable } = useQuickCreate({
    workspaceId,
    workspaceSlug,
  })

  const [activeCreateTab, setActiveCreateTab] = useState<(typeof CREATE_TABS)[number]['key']>('app')
  const [showInvite, setShowInvite] = useState(false)
  const [recentViews, setRecentViews] = useState<RecentlyViewedEntry[]>([])
  const [resolvedItems, setResolvedItems] = useState<WorkspaceItem[]>([])

  useEffect(() => {
    recentlyViewedClient.list(workspaceId, 8).then(setRecentViews).catch(() => {})
  }, [workspaceId])

  const recentItems = useMemo(() => {
    const itemMap = new Map(resolvedItems.map((item) => [`${item.kind}:${item.id}`, item]))
    return recentViews
      .map((view) => itemMap.get(`${view.entity_type}:${view.entity_id}`))
      .filter((item): item is WorkspaceItem => !!item)
      .slice(0, 4)
  }, [recentViews, resolvedItems])

  return (
    <div className="flex-1 overflow-y-auto bg-[#faf9f7] font-hanken-grotesk">
      {/* Hero — decorative only, no NL-driven creation backend exists yet */}
      <div className="relative overflow-hidden px-10 pt-9 pb-[78px] bg-[linear-gradient(120deg,#4f46c9_0%,#5b5bd6_42%,#6d7ff0_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_85%_-20%,rgba(255,255,255,0.28),transparent_55%)]" />

        <div className="relative mx-auto flex max-w-[760px] flex-col items-center gap-3.5">
          <h2 className="m-0 text-[20px] font-bold tracking-tight text-white">What do you want to create?</h2>

          <div className="inline-flex gap-1 rounded-[11px] border border-white/20 bg-white/[0.14] p-1">
            {CREATE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveCreateTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors',
                  activeCreateTab === tab.key
                    ? 'bg-white text-[#3f3e35] shadow-[0_1px_3px_rgba(0,0,0,0.15)]'
                    : 'text-white/90 hover:bg-white/10'
                )}
              >
                <tab.icon className="h-[15px] w-[15px]" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Decorative prompt card — no backend exists for natural-language creation yet */}
          <div className="w-full rounded-2xl bg-white px-4 pb-3 pt-4 shadow-[0_14px_40px_-12px_rgba(30,26,90,0.45)]">
            <div className="min-h-[44px] px-1 pb-3 pt-1 text-[15.5px] text-[#a5a49a]">
              Describe what you want to build…
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <button className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-[#ececE7] bg-[#f6f5f2] text-[#6c6b61]">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[#8a897f]">
                  <Mic className="h-[18px] w-[18px]" />
                </button>
                <button className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#f5b301] text-[#3a2e00] shadow-[0_2px_6px_rgba(245,179,1,0.4)]">
                  <ArrowUp className="h-[19px] w-[19px]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content sheet */}
      <div className="relative -mt-11 rounded-t-[24px] bg-[#faf9f7] px-10 pb-[60px] pt-8">
        <div className="mb-7 flex items-center justify-between">
          <h1 className="m-0 text-[30px] font-extrabold tracking-tight text-[#1b1b17]">Welcome, {displayName}</h1>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 rounded-[10px] border border-[#e6e5df] bg-white px-3.5 py-2 text-[14px] font-semibold text-[#3f3e35] hover:bg-[#f6f5f2]"
          >
            <UserPlus className="h-[15px] w-[15px] text-[#8a897f]" />
            Invite members
          </button>
        </div>

        {recentItems.length > 0 && (
          <div className="mb-9">
            <h3 className="mb-3.5 text-[15px] font-bold text-[#54534a]">Recently viewed</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recentItems.map((item) => (
                <div
                  key={`${item.kind}:${item.id}`}
                  className="flex items-center gap-3 rounded-[14px] border border-[#ecebe5] bg-white p-3"
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px]',
                      item.kind === 'form' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                    )}
                  >
                    {item.kind === 'form' ? <FileText className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#25241d]">{item.name}</p>
                    <p className="text-[12.5px] text-[#98978c]">
                      {item.kind === 'form' ? item.status : `${item.rowCount} rows`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3.5 flex items-center gap-2">
          <h3 className="m-0 text-[15px] font-bold text-[#54534a]">My workspace</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={creatingForm || creatingTable}
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#8a897f] hover:bg-[#e6e5df] hover:text-[#54534a] disabled:opacity-50"
                aria-label="Create new"
              >
                <Plus className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={handleCreateForm} disabled={creatingForm}>
                <FileText className="h-4 w-4 text-blue-600" />
                New form
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCreateTable} disabled={creatingTable}>
                <Database className="h-4 w-4 text-emerald-600" />
                New table
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <WorkspaceItemsList
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          filter="all"
          emptyMessage="Nothing here yet — create your first form or table above."
          onItemsLoaded={(items) => setResolvedItems(items)}
        />
      </div>

      <InviteToWorkspaceSidebarV2
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        workspaceId={workspaceId}
        workspaceName={workspaceName || 'Workspace'}
      />
    </div>
  )
}
