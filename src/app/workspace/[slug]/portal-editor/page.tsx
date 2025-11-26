'use client'

import { useState } from 'react'
import { PortalEditor } from '@/components/PortalBuilder/PortalEditor'
import { useParams, useSearchParams } from 'next/navigation'

export default function PortalEditorPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const workspaceSlug = params.slug as string
  const formId = searchParams.get('formId')

  return (
    <div className="h-[calc(100vh-4rem)]">
      <PortalEditor workspaceSlug={workspaceSlug} initialFormId={formId} />
    </div>
  )
}
