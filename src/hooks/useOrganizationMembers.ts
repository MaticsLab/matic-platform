'use client'

import { useState, useEffect, useCallback } from 'react'
import { organizationAPI } from '@/lib/better-auth-client'
import { toast } from 'sonner'

export interface OrganizationMember {
  id: string
  user_id: string
  organization_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
  updated_at: string
  user?: {
    id: string
    email: string
    name: string | null
    image: string | null
  }
}

export interface OrganizationInvitation {
  id: string
  organization_id: string
  email: string
  role: 'owner' | 'admin' | 'member'
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expires_at: string
  inviter_id: string | null
  created_at: string
  updated_at: string
}

interface UseOrganizationMembersOptions {
  autoLoad?: boolean
}

/**
 * Hook for loading and managing organization members and invitations
 * Provides real-time data about who has access to the organization
 * 
 * @param organizationId - The ID of the organization
 * @param options - Configuration options
 * @returns Object with members, invitations, loading state, and reload function
 * 
 * @example
 * ```tsx
 * const { members, invitations, loading, reload } = useOrganizationMembers(orgId)
 * 
 * useEffect(() => {
 *   // Members and invitations are auto-loaded
 *   console.log(`${members.length} members, ${pending.length} pending invitations`)
 * }, [members, pending])
 * ```
 */
export function useOrganizationMembers(
  organizationId: string,
  options: UseOrganizationMembersOptions = {}
) {
  const { autoLoad = true } = options
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  /**
   * Load members and invitations from API
   */
  const reload = useCallback(async () => {
    if (!organizationId) {
      setError(new Error('No organization ID provided'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Load members and invitations in parallel
      const [membersData, invitationsData] = await Promise.all([
        organizationAPI.listMembers({ query: { organizationId } }),
        organizationAPI.listInvitations({ query: { organizationId } })
      ])

      setMembers((membersData.data as any)?.members || [])
      setInvitations((invitationsData.data as any) || [])
    } catch (err) {
      const error = err as Error
      console.error('Failed to load members:', error)
      setError(error)
      toast.error('Failed to load organization members')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  // Auto-load on mount and when organization changes
  useEffect(() => {
    if (autoLoad && organizationId) {
      reload()
    }
  }, [autoLoad, organizationId, reload])

  // Computed values
  const pending = invitations.filter(i => i.status === 'pending')
  const expired = invitations.filter(i => i.status === 'expired')
  const owners = members.filter(m => m.role === 'owner')
  const admins = members.filter(m => m.role === 'admin')
  const regularMembers = members.filter(m => m.role === 'member')

  /**
   * Statistics about the organization
   */
  const stats = {
    totalMembers: members.length,
    pendingInvitations: pending.length,
    expiredInvitations: expired.length,
    owners: owners.length,
    admins: admins.length,
    members: regularMembers.length,
    acceptanceRate: invitations.length > 0 
      ? (invitations.filter(i => i.status === 'accepted').length / invitations.length) * 100
      : 0
  }

  return {
    members,
    invitations,
    pending,
    expired,
    owners,
    admins,
    regularMembers,
    stats,
    loading,
    error,
    reload
  }
}
