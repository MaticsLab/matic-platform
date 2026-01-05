'use client'

import { Card } from '@/ui-components/card'
import { Calendar } from 'lucide-react'
import { PortalConfig } from '@/types/portal'

interface NextDeadlineProps {
  config: PortalConfig
  themeColor?: string
  applicationDeadline?: string | null
}

export function NextDeadline({
  config,
  themeColor = '#3B82F6',
  applicationDeadline
}: NextDeadlineProps) {
  // Format the deadline date if available
  const formatDeadline = (dateString: string | null | undefined): string | null => {
    if (!dateString) return null
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
      return null
    }
  }

  const formattedDeadline = formatDeadline(applicationDeadline)
  
  // Don't show the card if no deadline is set
  if (!formattedDeadline) {
    return null
  }

  // Check if deadline has passed
  const isDeadlinePassed = applicationDeadline ? new Date(applicationDeadline) < new Date() : false
  
  return (
    <Card 
      className="p-4 border bg-opacity-30"
      style={{ 
        borderColor: isDeadlinePassed ? '#ef444433' : `${themeColor}33`,
        backgroundColor: isDeadlinePassed ? '#ef444408' : `${themeColor}08`
      }}
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: isDeadlinePassed ? '#ef4444' : themeColor }}
        >
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 mb-0.5">
            {isDeadlinePassed ? 'Deadline Passed' : 'Application Deadline'}
          </p>
          <p className={`text-sm ${isDeadlinePassed ? 'text-red-600' : 'text-gray-900'}`}>
            {formattedDeadline}
          </p>
        </div>
      </div>
    </Card>
  )
}
