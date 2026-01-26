'use client'

import { useState } from 'react'
import { useSession } from '@/lib/better-auth-client'
import { toast } from 'sonner'

interface UpdateResult {
  success: boolean
  error?: Error
}

interface UserProfileUpdates {
  name?: string
  email?: string
  image?: string
}

/**
 * Hook for updating user profile information via Better Auth
 * Handles profile updates for authenticated staff users
 * 
 * @returns Object with user data, updateProfile function, and loading state
 * 
 * @example
 * ```tsx
 * const { user, updateProfile, loading } = useUserProfile()
 * 
 * const handleSave = async () => {
 *   const result = await updateProfile({ name: 'New Name' })
 *   if (result.success) {
 *     toast.success('Profile updated!')
 *   }
 * }
 * ```
 */
export function useUserProfile() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)

  /**
   * Update user profile
   * @param updates - Fields to update (name, email, image)
   * @returns Promise<UpdateResult>
   */
  async function updateProfile(updates: UserProfileUpdates): Promise<UpdateResult> {
    if (!session?.user) {
      toast.error('You must be logged in to update your profile')
      return { success: false, error: new Error('Not authenticated') }
    }

    // Validate updates
    if (updates.email && !isValidEmail(updates.email)) {
      toast.error('Invalid email address')
      return { success: false, error: new Error('Invalid email') }
    }

    if (updates.name && updates.name.trim().length === 0) {
      toast.error('Name cannot be empty')
      return { success: false, error: new Error('Empty name') }
    }

    setLoading(true)
    try {
      // Use Better Auth's native updateUser method via session
      // This method is type-safe and handles the API call internally
      await fetch('/api/auth/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
        credentials: 'include'
      }).then(res => {
        if (!res.ok) throw new Error('Failed to update profile')
        return res.json()
      })
      
      // Session will be refreshed automatically on next request
      
      toast.success('Profile updated successfully')
      return { success: true }
    } catch (error) {
      const err = error as Error
      console.error('Failed to update profile:', err)
      toast.error(err.message || 'Failed to update profile')
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Change user password
   * @param currentPassword - Current password for verification
   * @param newPassword - New password to set
   * @param revokeOtherSessions - Whether to revoke all other sessions
   * @returns Promise<UpdateResult>
   */
  async function changePassword(
    currentPassword: string,
    newPassword: string,
    revokeOtherSessions: boolean = false
  ): Promise<UpdateResult> {
    if (!session?.user) {
      toast.error('You must be logged in to change your password')
      return { success: false, error: new Error('Not authenticated') }
    }

    // Validate password strength
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return { success: false, error: new Error('Password too short') }
    }

    if (currentPassword === newPassword) {
      toast.error('New password must be different from current password')
      return { success: false, error: new Error('Same password') }
    }

    setLoading(true)
    try {
      await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          revokeOtherSessions
        }),
        credentials: 'include'
      }).then(res => {
        if (!res.ok) throw new Error('Failed to change password')
        return res.json()
      })
      
      toast.success('Password changed successfully')
      return { success: true }
    } catch (error) {
      const err = error as Error
      console.error('Failed to change password:', err)
      toast.error(err.message || 'Failed to change password')
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Validate email format
   */
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  return {
    user: session?.user,
    session,
    updateProfile,
    changePassword,
    loading
  }
}
