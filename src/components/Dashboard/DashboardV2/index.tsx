'use client'

import { DashboardHeader } from '@/components/Dashboard/DashboardV2/DashboardHeader'
import { WelcomeSection } from '@/components/Dashboard/DashboardV2/WelcomeSection'
import { PriorityActions } from '@/components/Dashboard/DashboardV2/PriorityActions'
import { QuickContact } from '@/components/Dashboard/DashboardV2/QuickContact'
import { NextDeadline } from '@/components/Dashboard/DashboardV2/NextDeadline'
import { CompactDocuments } from '@/components/Dashboard/DashboardV2/CompactDocuments'
import { CompactRecommendations } from '@/components/Dashboard/DashboardV2/CompactRecommendations'
import { PortalConfig } from '@/types/portal'
import type { DashboardSettings } from '@/types/dashboard'

interface DashboardV2Props {
  config: PortalConfig
  submissionData: Record<string, any>
  applicationStatus: string
  email: string
  formId: string
  rowId?: string
  onLogout: () => void
  onContinueApplication?: () => void
  themeColor?: string
  isPreview?: boolean
  dashboardSettings?: DashboardSettings
  welcomeTitle?: string
  welcomeText?: string
}

export function DashboardV2({
  config,
  submissionData,
  applicationStatus,
  email,
  formId,
  rowId,
  onLogout,
  onContinueApplication,
  themeColor = '#3B82F6',
  isPreview = false,
  dashboardSettings,
  welcomeTitle,
  welcomeText
}: DashboardV2Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader 
        config={config}
        onLogout={onLogout}
        onContinueApplication={onContinueApplication}
        themeColor={themeColor}
        applicationStatus={applicationStatus}
        isPreview={isPreview}
      />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <WelcomeSection 
          email={email}
          applicationStatus={applicationStatus}
          welcomeTitle={welcomeTitle}
          welcomeText={welcomeText}
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <PriorityActions 
              config={config}
              submissionData={submissionData}
              formId={formId}
              rowId={rowId}
              isPreview={isPreview}
            />
            <QuickContact 
              formId={formId}
              isPreview={isPreview}
              themeColor={themeColor}
            />
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-4 sm:space-y-6">
            <NextDeadline 
              config={config}
              themeColor={themeColor}
            />
            <CompactDocuments 
              formId={formId}
              rowId={rowId}
              isPreview={isPreview}
            />
            <CompactRecommendations 
              formId={formId}
              isPreview={isPreview}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
