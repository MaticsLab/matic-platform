'use client'

import { useState, useEffect } from 'react'
import { DashboardV2 } from '@/components/Dashboard/DashboardV2'
import { dashboardClient } from '@/lib/api/dashboard-client'
import { recommendationsClient } from '@/lib/api/recommendations-client'
import { PortalConfig } from '@/types/portal'
import type { DashboardSettings } from '@/types/dashboard'
import type { Recommender } from '@/components/Dashboard/DashboardV2/CompactRecommendations'

interface ApplicantDashboardProps {
  config: PortalConfig
  submissionData: Record<string, any>
  applicationStatus?: string
  email: string
  formId: string
  rowId?: string
  onLogout: () => void
  onContinueApplication?: () => void
  themeColor?: string
  applicantId?: string
  applicantName?: string
  onNameUpdate?: (newName: string) => void
  hideHeader?: boolean
}

/**
 * ApplicantDashboard - Wrapper for UnifiedDashboard in live mode
 * Used in the public portal for applicants to view their application status
 */
export function ApplicantDashboard({
  config,
  submissionData,
  applicationStatus = 'submitted',
  email,
  formId,
  rowId,
  onLogout,
  onContinueApplication,
  themeColor = '#3B82F6',
  applicantId,
  applicantName,
  onNameUpdate,
  hideHeader = false
}: ApplicantDashboardProps) {
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({
    showStatus: true,
    showTimeline: true,
    showChat: true,
    showDocuments: true,
    welcomeTitle: '',
    welcomeText: ''
  })
  const [recommendations, setRecommendations] = useState<Recommender[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Scroll to top when dashboard mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Fetch everything the dashboard needs up front, in parallel, behind a single
  // loading state — avoids each child widget popping its own spinner in sequence.
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!formId) {
        setIsLoading(false)
        return
      }

      const [layoutResult, recommendationsResult] = await Promise.allSettled([
        dashboardClient.getLayout(formId),
        rowId ? recommendationsClient.listFromPortal(rowId) : Promise.resolve([]),
      ])

      if (layoutResult.status === 'fulfilled' && layoutResult.value?.settings) {
        const { settings } = layoutResult.value
        setDashboardSettings({
          showStatus: settings.showStatus ?? settings.show_status ?? true,
          showTimeline: settings.showTimeline ?? settings.show_timeline ?? true,
          showChat: settings.showChat ?? settings.show_chat ?? true,
          showDocuments: settings.showDocuments ?? settings.show_documents ?? true,
          welcomeTitle: settings.welcomeTitle ?? settings.welcome_title ?? '',
          welcomeText: settings.welcomeText ?? settings.welcome_text ?? ''
        })
      } else if (layoutResult.status === 'rejected') {
        console.error('Failed to fetch dashboard layout:', layoutResult.reason)
        // Use defaults on error
      }

      if (recommendationsResult.status === 'fulfilled') {
        const transformed: Recommender[] = recommendationsResult.value.map(req => ({
          id: req.id,
          name: req.recommender_name,
          status: req.status === 'submitted' ? 'submitted' :
                  req.status === 'pending' ? 'pending' : 'not-sent',
          submittedDate: req.submitted_at
            ? new Date(req.submitted_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })
            : undefined
        }))
        setRecommendations(transformed)
      } else {
        // Silently handle 404s/network errors - endpoint may not exist for every form
        const reason = recommendationsResult.reason
        if (reason?.status && reason.status !== 404 && reason.status !== 401) {
          console.error('Failed to fetch recommendations:', reason)
        }
      }

      setIsLoading(false)
    }

    fetchDashboardData()
  }, [formId, rowId])

  // Show loading state while fetching settings
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    )
  }

  return (
    <DashboardV2
      config={config}
      submissionData={submissionData}
      applicationStatus={applicationStatus}
      email={email}
      formId={formId}
      rowId={rowId}
      onLogout={onLogout}
      onContinueApplication={onContinueApplication}
      themeColor={themeColor}
      isPreview={false}
      dashboardSettings={dashboardSettings}
      welcomeTitle={dashboardSettings.welcomeTitle}
      welcomeText={dashboardSettings.welcomeText}
      recommendations={recommendations}
      applicantId={applicantId}
      applicantName={applicantName}
      onNameUpdate={onNameUpdate}
      hideHeader={hideHeader}
    />
  )
}
