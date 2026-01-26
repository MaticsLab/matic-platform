'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingOverlayProps {
  message?: string
  fullScreen?: boolean
  className?: string
}

export function LoadingOverlay({ 
  message = 'Loading...', 
  fullScreen = true,
  className 
}: LoadingOverlayProps) {
  return (
    <div className={cn(
      "flex items-center justify-center bg-gray-50",
      fullScreen ? "fixed inset-0 z-50" : "absolute inset-0",
      className
    )}>
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        {message && (
          <p className="text-sm text-gray-600 animate-pulse">{message}</p>
        )}
      </div>
    </div>
  )
}
