'use client'

import { Card } from '@/ui-components/card'
import { Calendar } from 'lucide-react'
import { PortalConfig } from '@/types/portal'

interface NextDeadlineProps {
  config: PortalConfig
  themeColor?: string
}

export function NextDeadline({
  config,
  themeColor = '#3B82F6'
}: NextDeadlineProps) {
  // TODO: Get actual deadline from config or backend
  const deadline = 'Document Submission - March 10, 2025'
  
  return (
    <Card 
      className="p-4 border bg-opacity-30"
      style={{ 
        borderColor: `${themeColor}33`,
        backgroundColor: `${themeColor}08`
      }}
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: themeColor }}
        >
          <Calendar className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 mb-0.5">Next Deadline</p>
          <p className="text-sm text-gray-900">{deadline}</p>
        </div>
      </div>
    </Card>
  )
}
