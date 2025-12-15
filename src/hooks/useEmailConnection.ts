'use client'

import { useState, useEffect, useCallback } from 'react'
import { emailClient, GmailConnection, GmailAccount } from '@/lib/api/email-client'

export interface UseEmailConnectionResult {
  connection: GmailConnection | null
  accounts: GmailAccount[]
  isChecking: boolean
  selectedFromEmail: string
  setSelectedFromEmail: (email: string) => void
  refresh: () => Promise<void>
  canSendEmail: boolean
  sendBlockedReason: string | null
  handleOAuthError: (errorMessage: string) => void
}

/**
 * Unified hook for managing Gmail connection state.
 * Use this in any component that needs to check or display email connection status.
 */
export function useEmailConnection(workspaceId: string | undefined): UseEmailConnectionResult {
  const [connection, setConnection] = useState<GmailConnection | null>(null)
  const [accounts, setAccounts] = useState<GmailAccount[]>([])
  const [isChecking, setIsChecking] = useState(true)
  const [selectedFromEmail, setSelectedFromEmail] = useState('')

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setIsChecking(false)
      return
    }

    try {
      setIsChecking(true)
      const [conn, accts] = await Promise.all([
        emailClient.getConnection(workspaceId),
        emailClient.listAccounts(workspaceId).catch(() => [] as GmailAccount[])
      ])
      
      setConnection(conn)
      setAccounts(accts || [])
      
      // Set default from email if not already set
      if (conn?.email && !selectedFromEmail) {
        setSelectedFromEmail(conn.email)
      }
    } catch (error: any) {
      console.error('Failed to check Gmail connection:', error?.message || error)
      setConnection({ connected: false, email: '' })
    } finally {
      setIsChecking(false)
    }
  }, [workspaceId, selectedFromEmail])

  // Initial load
  useEffect(() => {
    refresh()
  }, [workspaceId]) // Only depend on workspaceId for initial load

  // Handle OAuth errors from send attempts
  const handleOAuthError = useCallback((errorMessage: string) => {
    const isOAuthError = 
      errorMessage.includes('invalid_grant') ||
      errorMessage.includes('Token has been expired or revoked') ||
      errorMessage.includes('token expired') ||
      errorMessage.includes('unauthorized')

    if (isOAuthError) {
      setConnection(prev => prev ? {
        ...prev,
        needs_reconnect: true,
        reconnect_reason: 'Your Gmail authorization has expired or been revoked. Please reconnect your account.'
      } : prev)
    }
  }, [])

  // Calculate if sending is allowed
  const canSendEmail = Boolean(
    connection?.connected && 
    !connection?.needs_reconnect
  )

  let sendBlockedReason: string | null = null
  if (!connection?.connected) {
    sendBlockedReason = 'Please connect your Gmail account first.'
  } else if (connection?.needs_reconnect) {
    sendBlockedReason = 'Your Gmail authorization has expired. Please reconnect your account in Settings → Communications.'
  }

  return {
    connection,
    accounts,
    isChecking,
    selectedFromEmail,
    setSelectedFromEmail,
    refresh,
    canSendEmail,
    sendBlockedReason,
    handleOAuthError
  }
}
