'use client'

import { useState } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { PortalEditor } from '@/components/PortalBuilder/PortalEditor'
import { useParams, useSearchParams } from 'next/navigation'

function PortalEditorPageContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const workspaceSlug = params.slug as string
  const formId = searchParams.get('formId')

  return (
    <div className="h-screen w-full overflow-hidden">
      <PortalEditor workspaceSlug={workspaceSlug} initialFormId={formId} />
    </div>
  )
}

export default function PortalEditorPage() {
  return (
    <ProtectedRoute>
      <PortalEditorPageContent />
    </ProtectedRoute>
  )
}
