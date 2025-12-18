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
  // Create mock data for preview with field values that can be used for @ mentions
  const mockSubmissionData = {
    firstName: 'John',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    name: 'John Doe',
    // Add mock data for any signup fields
    ...config.settings.signupFields.reduce((acc, field) => {
      if (field.type === 'email') acc[field.id] = 'john.doe@example.com'
      else if (field.type === 'text' && field.label.toLowerCase().includes('name')) {
        if (field.label.toLowerCase().includes('first')) acc[field.id] = 'John'
        else if (field.label.toLowerCase().includes('last')) acc[field.id] = 'Doe'
        else acc[field.id] = 'John Doe'
      }
      else if (field.type === 'phone') acc[field.id] = '(555) 123-4567'
      else if (field.type === 'number') acc[field.id] = '123'
      else if (field.type === 'text') acc[field.id] = `Sample ${field.label}`
      return acc
    }, {} as Record<string, any>)
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

