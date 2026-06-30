'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { NavigationLayout } from '@/components/NavigationLayout'
import { BreadcrumbProvider } from '@/components/BreadcrumbProvider'
import { BreadcrumbBar } from '@/components/BreadcrumbBar'
import { ApplicationsHub } from '@/components/ApplicationsHub/ApplicationsHub'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { saveLastWorkspace } from '@/lib/utils'
import type { Workspace } from '@/lib/api/workspaces-client'
import { LoadingOverlay } from '@/components/LoadingOverlay'

function ApplicationsPageContent() {
  const params = useParams()
  const slug = params.slug as string
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug || typeof window === 'undefined') return

    // Persist slug immediately so top-level CTA can route correctly even if data fetch is slow.
    saveLastWorkspace(slug)
    localStorage.setItem('lastWorkspace', JSON.stringify({ slug }))
  }, [slug])

  useEffect(() => {
    async function loadWorkspace() {
      if (!slug) return

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
        <div className="flex flex-col h-full">
          <BreadcrumbBar />
          <ApplicationsHub workspaceId={workspace.id} workspaceSlug={slug} />
        </div>
      </NavigationLayout>
    </BreadcrumbProvider>
  )
}

export default function ApplicationsPage() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <ProtectedRoute>
        <ApplicationsPageContent />
      </ProtectedRoute>
    </Suspense>
  )
}
