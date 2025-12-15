'use client'

import { AlertCircle, CheckCircle, RefreshCw, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GmailConnection } from '@/lib/api/email-client'

export interface EmailConnectionStatusProps {
  connection: GmailConnection | null
  isChecking: boolean
  variant?: 'inline' | 'banner'
  onConfigureClick?: () => void
  className?: string
}

/**
 * Unified email connection status component.
 * Shows the current Gmail connection state with appropriate messaging.
 */
export function EmailConnectionStatus({
  connection,
  isChecking,
  variant = 'banner',
  onConfigureClick,
  className
}: EmailConnectionStatusProps) {
  // Loading state
  if (isChecking) {
    return (
      <div className={cn(
        "flex items-center gap-2 text-gray-500 text-sm",
        variant === 'banner' && "p-4",
        className
      )}>
        <RefreshCw className="w-4 h-4 animate-spin" />
        Checking email connection...
      </div>
    )
  }

  // Not connected
  if (!connection?.connected) {
    if (variant === 'inline') {
      return (
        <div className={cn(
          "py-2 mb-2 text-sm text-amber-600 bg-amber-50 rounded-lg px-3 flex items-center justify-between",
          className
        )}>
          <span>Gmail not connected.</span>
          {onConfigureClick && (
            <button 
              onClick={onConfigureClick}
              className="text-amber-700 hover:text-amber-800 font-medium underline text-xs"
            >
              Connect Email
            </button>
          )}
        </div>
      )
    }
    
    return (
      <div className={cn("p-4 bg-amber-50 border border-amber-200 rounded-lg", className)}>
        <div className="flex items-center gap-2 text-amber-700">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Gmail not connected</span>
        </div>
        <p className="text-sm text-amber-600 mt-1">
          Connect your Gmail account in Communications settings to send emails.
        </p>
        {onConfigureClick && (
          <button 
            onClick={onConfigureClick}
            className="mt-2 text-sm text-amber-700 hover:text-amber-800 font-medium underline"
          >
            Connect Email
          </button>
        )}
      </div>
    )
  }

  // Needs reconnection
  if (connection?.needs_reconnect) {
    if (variant === 'inline') {
      return (
        <div className={cn(
          "py-2 mb-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 flex items-center justify-between",
          className
        )}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Gmail reconnection required</span>
          </div>
          {onConfigureClick && (
            <button 
              onClick={onConfigureClick}
              className="text-red-700 hover:text-red-800 font-medium underline text-xs"
            >
              Reconnect
            </button>
          )}
        </div>
      )
    }

    return (
      <div className={cn("p-4 bg-red-50 border border-red-200 rounded-lg", className)}>
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">Gmail reconnection required</span>
        </div>
        <p className="text-sm text-red-600 mt-1">
          {connection.reconnect_reason || 'Your Gmail authorization has expired or been revoked. Please reconnect your account.'}
        </p>
        <p className="text-sm text-red-600 mt-2">
          Go to <strong>Settings → Communications</strong> to reconnect your Gmail account.
        </p>
        {onConfigureClick && (
          <button 
            onClick={onConfigureClick}
            className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium underline"
          >
            Reconnect Now
          </button>
        )}
      </div>
    )
  }

  // Connected successfully
  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2 text-green-600 text-sm py-2", className)}>
        <CheckCircle className="w-4 h-4" />
        Connected as {connection.email}
        {onConfigureClick && (
          <button 
            onClick={onConfigureClick}
            className="ml-auto text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-2 text-green-600 text-sm", className)}>
      <CheckCircle className="w-4 h-4" />
      Connected as {connection.email}
    </div>
  )
}
