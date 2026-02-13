'use client'

import { useEffect, useState, Suspense } from 'react'
import { useParams } from 'next/navigation'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { NavigationLayout } from '@/components/NavigationLayout'
import { BreadcrumbProvider } from '@/components/BreadcrumbProvider'
import { BreadcrumbBar } from '@/components/BreadcrumbBar'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import type { Workspace } from '@/types/workspaces'
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
      const ws = await workspacesSupabase.getWorkspaceBySlug(slug)
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
    <BreadcrumbProvider workspaceSlug={slug}>
      <NavigationLayout workspaceSlug={workspace.slug}>
        <BreadcrumbBar />
        <ApplicantCRMPage workspaceId={workspace.id} workspaceSlug={workspace.slug} />
      </NavigationLayout>
    </BreadcrumbProvider>
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
