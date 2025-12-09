'use client'

import { Clock, History, Download } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Progress } from '@/ui-components/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu'
import { cn } from '@/lib/utils'

interface VersionEntry {
  date: Date
  data: any
}

interface ProgressHeaderProps {
  progress: number
  isSaving: boolean
  lastSaved: Date | null
  onSave: () => void
  onSaveAndExit: () => void
  versionHistory: VersionEntry[]
  onRestoreVersion: (version: VersionEntry) => void
  formName?: string
  isExternal?: boolean
}

export function ProgressHeader({
  progress,
  isSaving,
  lastSaved,
  onSave,
  onSaveAndExit,
  versionHistory,
  onRestoreVersion,
  formName = 'Application',
  isExternal = false
}: ProgressHeaderProps) {
  if (process.env.NODE_ENV === 'development') {
    console.log('🎯 ProgressHeader rendered with progress:', progress)
  }
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const estimatedTimeRemaining = Math.max(0, Math.ceil((100 - progress) / 10) * 2)

  return (
    <header className={cn(
      "border-b px-4 sm:px-6 lg:px-8 py-4",
      isExternal ? "bg-white/80 backdrop-blur-md border-gray-100" : "bg-white border-gray-200"
    )}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Progress Section */}
        <div className="flex-1 min-w-[200px] max-w-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className={cn(
              "text-sm font-semibold",
              progress >= 100 ? "text-green-600" : "text-blue-600"
            )}>
              {progress}% Complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          {progress < 100 && estimatedTimeRemaining > 0 && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>~{estimatedTimeRemaining} min remaining</span>
            </div>
          )}
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2">
          {/* Last Saved Status */}
          {lastSaved && (
            <div className="hidden sm:block text-xs text-gray-500 mr-2">
              {isSaving ? 'Saving...' : `Saved ${formatTime(lastSaved)}`}
            </div>
          )}

          {/* Version History - Hidden for external/public portal */}
          {!isExternal && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">History</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Version History</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {versionHistory.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-gray-500 text-center">
                    No saved versions yet
                  </div>
                ) : (
                  versionHistory
                    .slice()
                    .reverse()
                    .map((version, index) => (
                      <DropdownMenuItem
                        key={index}
                        onClick={() => onRestoreVersion(version)}
                        className="cursor-pointer"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            Version {versionHistory.length - index}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDateTime(version.date)}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Save & Exit */}
          <Button 
            size="sm"
            onClick={onSaveAndExit}
            disabled={isSaving}
            className={cn(isExternal && "bg-gray-900 hover:bg-gray-800")}
          >
            <Download className="h-4 w-4 mr-2" />
            Save & Exit
          </Button>
        </div>
      </div>

    </header>
  )
}
