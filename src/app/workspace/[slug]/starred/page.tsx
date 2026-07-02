'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { NavigationLayout } from '@/components/NavigationLayout'
import { BreadcrumbProvider } from '@/components/BreadcrumbProvider'
import { BreadcrumbBar } from '@/components/BreadcrumbBar'
import { WorkspaceItemsList } from '@/components/WorkspaceItemsList'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { saveLastWorkspace } from '@/lib/utils'
import type { Workspace } from '@/lib/api/workspaces-client'
import { LoadingOverlay } from '@/components/LoadingOverlay'

function StarredPageContent() {
  const params = useParams()
  const slug = params.slug as string
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    saveLastWorkspace(slug)

    async function loadWorkspace() {
      try {
        setLoading(true)
        const ws = await workspacesClient.getBySlug(slug)
        if (!ws) throw new Error('Workspace not found')
        setWorkspace(ws)
      } catch (error) {
        console.error('Failed to load workspace:', error)
      } finally {
        setLoading(false)
      }
    }

    loadWorkspace()
  }, [slug])

  if (loading) {
    return <LoadingOverlay message="Loading workspace..." />
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Workspace not found</p>
      </div>
    )
  }

  return (
    <BreadcrumbProvider workspaceSlug={slug}>
      <NavigationLayout workspaceSlug={workspace.slug}>
        <div className="flex flex-col h-full bg-[#faf9f7]">
          <BreadcrumbBar />
          <div className="px-10 py-8">
            <h1 className="mb-6 text-[26px] font-extrabold tracking-tight text-[#1b1b17]">Starred</h1>
            <WorkspaceItemsList
              workspaceId={workspace.id}
              workspaceSlug={slug}
              filter="starred"
              emptyMessage="Nothing starred yet — star a form or table to find it here."
            />
          </div>
        </div>
      </NavigationLayout>
    </BreadcrumbProvider>
  )
}

export default function StarredPage() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <ProtectedRoute>
        <StarredPageContent />
      </ProtectedRoute>
    </Suspense>
  )
}
