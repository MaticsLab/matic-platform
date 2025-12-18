'use client'

import { DashboardV2 } from '@/components/Dashboard/DashboardV2'
import type { DashboardSettings } from '@/types/dashboard'
import type { PortalConfig } from '@/types/portal'

interface DashboardPreviewProps {
  themeColor: string
  logoUrl?: string
  portalName: string
  dashboardSettings: DashboardSettings
  config: PortalConfig
}

/**
 * DashboardPreview - Wrapper for DashboardV2 in preview mode
 * Used in the Portal Builder to show how the applicant dashboard will look
 */
export function DashboardPreview({ 
  themeColor, 
  logoUrl, 
  portalName,
  dashboardSettings,
  config
}: DashboardPreviewProps) {
  // Create mock data for preview
  const mockSubmissionData = {
    name: 'John Doe',
    email: 'john.doe@example.com'
  }

  return (
    <DashboardV2
      config={config}
      submissionData={mockSubmissionData}
      applicationStatus="submitted"
      email="john.doe@example.com"
      formId="preview"
      onLogout={() => {}}
      onContinueApplication={() => {}}
      themeColor={themeColor}
      isPreview={true}
      dashboardSettings={dashboardSettings}
      welcomeTitle={dashboardSettings.welcomeTitle}
      welcomeText={dashboardSettings.welcomeText}
    />
  )
}

