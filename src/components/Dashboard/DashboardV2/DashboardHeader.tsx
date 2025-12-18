'use client'

import { Bell, FileText, LogOut } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { PortalConfig } from '@/types/portal'

interface DashboardHeaderProps {
  config: PortalConfig
  onLogout: () => void
  onContinueApplication?: () => void
  themeColor?: string
  applicationStatus: string
  isPreview?: boolean
}

export function DashboardHeader({
  config,
  onLogout,
  onContinueApplication,
  themeColor = '#3B82F6',
  applicationStatus,
  isPreview = false
}: DashboardHeaderProps) {
  const portalName = config.settings.name || 'Application Portal'
  
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ 
                background: `linear-gradient(135deg, ${themeColor} 0%, ${themeColor}dd 100%)` 
              }}
            >
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base text-gray-900">{portalName}</h2>
              <p className="text-xs text-gray-500">Application Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {onContinueApplication && ['draft', 'pending', 'in_progress', 'revision_requested'].includes(applicationStatus) && (
              <Button 
                variant="outline" 
                className="gap-2 text-xs sm:text-sm px-2 sm:px-4 h-8 sm:h-9"
                onClick={onContinueApplication}
              >
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">My Application</span>
                <span className="xs:hidden">Application</span>
              </Button>
            )}
            
            {!isPreview && (
              <>
                <Button variant="ghost" size="icon" className="relative hover:bg-gray-100 h-8 w-8 sm:h-9 sm:w-9">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                </Button>
                
                <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-gray-200">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 text-xs h-8 px-2 sm:px-3"
                    onClick={onLogout}
                  >
                    <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
