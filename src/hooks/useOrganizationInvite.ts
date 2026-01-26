'use client'

import { useState } from 'react'
import { organizationAPI } from '@/lib/better-auth-client'
import { toast } from 'sonner'

export type InviteRole = 'member' | 'admin' | 'owner'

interface InviteResult {
  success: boolean
  error?: Error
}

/**
 * Hook for inviting users to an organization
 * Handles validation, API calls, and user feedback
 * 
 * @param organizationId - The ID of the organization to invite to
 * @returns Object with inviteMember function and loading state
 * 
 * @example
 * ```tsx
 * const { inviteMember, loading } = useOrganizationInvite(activeOrgId)
 * 
 * const handleInvite = async () => {
 *   const result = await inviteMember('user@example.com', 'member')
 *   if (result.success) {
 *     onInviteSuccess()
 *   }
 * }
 * ```
 */
export function useOrganizationInvite(organizationId: string) {
  const [loading, setLoading] = useState(false)

  /**
   * Invite a member to the organization
   * @param email - Email address of the user to invite
   * @param role - Role to assign ('member' | 'admin' | 'owner')
   * @returns Promise<InviteResult>
   */
  async function inviteMember(email: string, role: InviteRole = 'member'): Promise<InviteResult> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Invalid email address')
      return { success: false, error: new Error('Invalid email format') }
    }

    // Validate organization ID
    if (!organizationId) {
      toast.error('No organization selected')
      return { success: false, error: new Error('Missing organization ID') }
    }

    setLoading(true)
    try {
      await organizationAPI.inviteMember({
        organizationId,
        email: email.trim(),
        role
      })
      
      toast.success(`Invitation sent to ${email}`)
      return { success: true }
    } catch (error) {
      const err = error as Error
      console.error('Failed to send invitation:', err)
      toast.error(err.message || 'Failed to send invitation')
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Invite multiple members at once
   * @param invitations - Array of {email, role} objects
   * @returns Promise with results for each invitation
   */
  async function inviteMultiple(invitations: Array<{ email: string; role: InviteRole }>) {
    setLoading(true)
    const results: InviteResult[] = []

    try {
      for (const inv of invitations) {
        const result = await inviteMember(inv.email, inv.role)
        results.push(result)
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.length - successCount

      if (failCount === 0) {
        toast.success(`Successfully invited ${successCount} ${successCount === 1 ? 'person' : 'people'}`)
      } else {
        toast.warning(`Invited ${successCount}, failed ${failCount}`)
      }

      return results
    } finally {
      setLoading(false)
    }
  }

  return {
    inviteMember,
    inviteMultiple,
    loading
  }
}
