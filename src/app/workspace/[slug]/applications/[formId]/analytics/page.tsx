'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { NavigationLayout } from '@/components/NavigationLayout'
import { ApplicationManager } from '@/components/ApplicationsHub/Applications/ApplicationManager'
import { workspacesClient } from '@/lib/api/workspaces-client'
import type { Workspace } from '@/lib/api/workspaces-client'
import { LoadingOverlay } from '@/components/LoadingOverlay'

function FormAnalyticsPageContent() {
  const params = useParams()
  const slug = params.slug as string
  const formId = params.formId as string
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadWorkspace() {
      if (!slug) return
      try {
        setLoading(true)
        const ws = await workspacesClient.getBySlug(slug)
        if (!ws) throw new Error('Workspace not found')
        setWorkspace(ws)
      } catch (error) {
        console.error('[ReviewWorkspacePage] Failed to load workspace:', error)
      } finally {
        setLoading(false)
      }
    }
    loadWorkspace()
  }, [slug])

  if (loading) return <LoadingOverlay message="Loading submissions..." />

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Workspace not found</p>
      </div>
    )
  }

  return (
    <NavigationLayout workspaceSlug={workspace.slug}>
      <div className="flex flex-col h-full">
        <ApplicationManager formId={formId} workspaceId={workspace.id} />
      </div>
    </NavigationLayout>
  )
}

export default function FormAnalyticsRoute() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <ProtectedRoute>
        <FormAnalyticsPageContent />
      </ProtectedRoute>
    </Suspense>
  )
}
