'use client'

import { ReviewWorkspace } from '@/components/ApplicationsHub/Applications/Review/ReviewWorkspace'

export default function ExternalReviewPage({ params }: { params: { token: string } }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <ReviewWorkspace 
        mode="external"
        token={params.token}
      />
    </div>
  )
}
