'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { NavigationLayout } from '@/components/NavigationLayout'
import { workspacesClient } from '@/lib/api/workspaces-client'
import type { Workspace } from '@/lib/api/workspaces-client'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { ApplicantCRMPage } from '@/components/CRM/ApplicantCRMPage'

function CRMPageContent() {
  const params = useParams()
  const slug = params.slug as string
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (slug) {
      loadWorkspace()
    }
  }, [slug])

  async function loadWorkspace() {
    try {
      setLoading(true)
      const ws = await workspacesClient.getBySlug(slug)
      if (!ws) throw new Error('Workspace not found')
      setWorkspace(ws)
    } catch (err: any) {
      console.error('Failed to load workspace:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingOverlay message="Loading applicants..." />
  }

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Workspace not found</p>
      </div>
    )
  }

  return (
    <NavigationLayout workspaceSlug={workspace.slug}>
      <ApplicantCRMPage workspaceId={workspace.id} workspaceSlug={workspace.slug} />
    </NavigationLayout>
  )
}

export default function CRMPage() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <ProtectedRoute>
        <CRMPageContent />
      </ProtectedRoute>
    </Suspense>
  )
}
