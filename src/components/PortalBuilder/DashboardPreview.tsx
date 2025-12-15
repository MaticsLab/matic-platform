'use client'

import { UnifiedDashboard } from '@/components/Dashboard/UnifiedDashboard'
import type { DashboardSettings } from '@/types/dashboard'

interface DashboardPreviewProps {
  themeColor: string
  logoUrl?: string
  portalName: string
  dashboardSettings: DashboardSettings
}

/**
 * DashboardPreview - Wrapper for UnifiedDashboard in preview mode
 * Used in the Portal Builder to show how the applicant dashboard will look
 */
export function DashboardPreview({ 
  themeColor, 
  logoUrl, 
  portalName,
  dashboardSettings 
}: DashboardPreviewProps) {
  return (
    <UnifiedDashboard
      mode="preview"
      dashboardSettings={dashboardSettings}
      portalName={portalName}
      themeColor={themeColor}
      logoUrl={logoUrl}
    />
  )
}
