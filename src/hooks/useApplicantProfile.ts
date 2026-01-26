'use client'

import { useState } from 'react'
import { useUserProfile } from './useUserProfile'
import { portalAuthClient } from '@/lib/api/portal-auth-client'
import { toast } from 'sonner'

interface ApplicantProfileUpdates {
  // Better Auth fields
  name?: string
  email?: string
  image?: string
  
  // Portal-specific fields
  first_name?: string
  last_name?: string
}

interface UpdateResult {
  success: boolean
  error?: Error
}

/**
 * Hook for updating applicant profiles (dual Better Auth + Portal)
 * Handles both Better Auth user updates and portal applicant record updates
 * 
 * Use this hook for applicant portal users who need to update both:
 * 1. Better Auth user profile (name, email)
 * 2. Portal applicant profile (first_name, last_name, additional data)
 * 
 * @param applicantId - The portal applicant ID
 * @returns Object with updateProfile function and loading state
 * 
 * @example
 * ```tsx
 * const { updateProfile, loading } = useApplicantProfile(applicantId)
 * 
 * const handleSave = async () => {
 *   const result = await updateProfile({
 *     name: 'John Doe',
 *     first_name: 'John',
 *     last_name: 'Doe',
 *     email: 'john@example.com'
 *   })
 *   if (result.success) {
 *     toast.success('Profile updated!')
 *   }
 * }
 * ```
 */
export function useApplicantProfile(applicantId: string) {
  const { updateProfile: updateBetterAuth, loading: betterAuthLoading } = useUserProfile()
  const [portalLoading, setPortalLoading] = useState(false)

  const loading = betterAuthLoading || portalLoading

  /**
   * Update applicant profile (both Better Auth and Portal)
   * @param updates - Fields to update
   * @returns Promise<UpdateResult>
   */
  async function updateProfile(updates: ApplicantProfileUpdates): Promise<UpdateResult> {
    if (!applicantId) {
      toast.error('Applicant ID is required')
      return { success: false, error: new Error('Missing applicant ID') }
    }

    // Validate updates
    if (updates.email && !isValidEmail(updates.email)) {
      toast.error('Invalid email address')
      return { success: false, error: new Error('Invalid email') }
    }

    try {
      // Step 1: Update Better Auth user if name or email changed
      if (updates.name || updates.email) {
        const betterAuthResult = await updateBetterAuth({
          name: updates.name,
          email: updates.email,
          image: updates.image
        })

        if (!betterAuthResult.success) {
          return betterAuthResult
        }
      }

      // Step 2: Update portal applicant record if portal-specific fields changed
      if (updates.first_name || updates.last_name) {
        setPortalLoading(true)
        try {
          await portalAuthClient.updateProfile(applicantId, {
            first_name: updates.first_name,
            last_name: updates.last_name
          })
        } catch (error) {
          const err = error as Error
          console.error('Failed to update portal profile:', err)
          toast.error('Failed to update portal profile')
          return { success: false, error: err }
        } finally {
          setPortalLoading(false)
        }
      }

      toast.success('Profile updated successfully')
      return { success: true }
    } catch (error) {
      const err = error as Error
      console.error('Failed to update applicant profile:', err)
      toast.error(err.message || 'Failed to update profile')
      return { success: false, error: err }
    }
  }

  /**
   * Validate email format
   */
  function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Generate display name from first and last name
   */
  function generateDisplayName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`.trim()
  }

  return {
    updateProfile,
    generateDisplayName,
    loading
  }
}
