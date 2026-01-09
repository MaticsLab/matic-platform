'use client'

import { useState, useEffect } from 'react'
import { ReviewWorkspaceV2 } from '@/components/ApplicationsHub/Applications/Review/v2'
import { goClient } from '@/lib/api/go-client'
import { Loader2 } from 'lucide-react'

export default function ExternalReviewPage({ params }: { params: { token: string } }) {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [formId, setFormId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchExternalReviewData = async () => {
      try {
        const data = await goClient.get(`/external-review/${params.token}`)
        if (data?.form) {
          setFormId(data.form.id)
          setWorkspaceId(data.form.workspace_id)
        } else {
          setError('Invalid review token')
        }
      } catch (err: any) {
        console.error('Failed to fetch external review data:', err)
        setError(err?.message || 'Failed to load review data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchExternalReviewData()
  }, [params.token])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading review workspace...</p>
        </div>
      </div>
    )
  }

  if (error || !workspaceId || !formId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Review Access Error</h1>
          <p className="text-gray-600">{error || 'Invalid review token or missing form data'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <ReviewWorkspaceV2 
        workspaceId={workspaceId}
        formId={formId}
      />
    </div>
  )
}
