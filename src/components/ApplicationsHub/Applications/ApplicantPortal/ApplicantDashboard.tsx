'use client'

import { useState, useEffect } from 'react'
import { DashboardV2 } from '@/components/Dashboard/DashboardV2'
import { dashboardClient } from '@/lib/api/dashboard-client'
import { PortalConfig } from '@/types/portal'
import type { DashboardSettings } from '@/types/dashboard'

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
  onNameUpdate
}: ApplicantDashboardProps) {
  const [dashboardSettings, setDashboardSettings] = useState<DashboardSettings>({
    showStatus: true,
    showTimeline: true,
    showChat: true,
    showDocuments: true,
    welcomeTitle: '',
    welcomeText: ''
  })
  const [isLoading, setIsLoading] = useState(true)

  // Scroll to top when dashboard mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Fetch dashboard layout settings from backend
  useEffect(() => {
    const fetchDashboardLayout = async () => {
      if (!formId) {
        setIsLoading(false)
        return
      }
      
      try {
        const layout = await dashboardClient.getLayout(formId)
        if (layout?.settings) {
          setDashboardSettings({
            showStatus: layout.settings.showStatus ?? layout.settings.show_status ?? true,
            showTimeline: layout.settings.showTimeline ?? layout.settings.show_timeline ?? true,
            showChat: layout.settings.showChat ?? layout.settings.show_chat ?? true,
            showDocuments: layout.settings.showDocuments ?? layout.settings.show_documents ?? true,
            welcomeTitle: layout.settings.welcomeTitle ?? layout.settings.welcome_title ?? '',
            welcomeText: layout.settings.welcomeText ?? layout.settings.welcome_text ?? ''
          })
        }
      } catch (error) {
        console.error('Failed to fetch dashboard layout:', error)
        // Use defaults on error
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardLayout()
  }, [formId])

  // Show loading state while fetching settings
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
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
      applicantId={applicantId}
      applicantName={applicantName}
      onNameUpdate={onNameUpdate}
    />
  )
}
