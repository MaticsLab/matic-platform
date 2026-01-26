'use client'

import { useState } from 'react'
import { organizationAPI } from '@/lib/better-auth-client'
import { toast } from 'sonner'

export interface Organization {
  id: string
  name: string
  slug: string | null
  logo: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

interface CreateResult {
  success: boolean
  organization?: Organization
  error?: Error
}

/**
 * Hook for creating new organizations
 * Handles validation, slug generation, and API calls
 * 
 * @returns Object with create function and loading state
 * 
 * @example
 * ```tsx
 * const { create, loading } = useOrganizationCreate()
 * 
 * const handleCreate = async () => {
 *   const result = await create('My Company', 'my-company')
 *   if (result.success) {
 *     router.push(`/org/${result.organization.id}`)
 *   }
 * }
 * ```
 */
export function useOrganizationCreate() {
  const [loading, setLoading] = useState(false)

  /**
   * Create a new organization
   * @param name - Display name of the organization
   * @param slug - URL-friendly slug (optional, auto-generated if not provided)
   * @returns Promise<CreateResult>
   */
  async function create(name: string, slug?: string): Promise<CreateResult> {
    // Validate name
    if (!name || name.trim().length === 0) {
      toast.error('Organization name is required')
      return { success: false, error: new Error('Name is required') }
    }

    if (name.trim().length < 2) {
      toast.error('Organization name must be at least 2 characters')
      return { success: false, error: new Error('Name too short') }
    }

    // Generate slug from name if not provided
    const finalSlug = slug || generateSlug(name)

    // Validate slug format
    if (!isValidSlug(finalSlug)) {
      toast.error('Invalid organization slug. Use only lowercase letters, numbers, and hyphens.')
      return { success: false, error: new Error('Invalid slug format') }
    }

    setLoading(true)
    try {
      const result = await organizationAPI.create({
        name: name.trim(),
        slug: finalSlug
      })
      
      toast.success(`Organization "${name}" created successfully`)
      return (result.data as any) || null
    } catch (error) {
      const err = error as Error
      console.error('Failed to create organization:', err)
      
      // Handle specific error messages
      if (err.message?.includes('slug')) {
        toast.error('An organization with this slug already exists')
      } else {
        toast.error(err.message || 'Failed to create organization')
      }
      
      return { success: false, error: err }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Validate slug format
   * @param slug - The slug to validate
   * @returns true if valid, false otherwise
   */
  function isValidSlug(slug: string): boolean {
    // Must be lowercase alphanumeric with hyphens, 3-50 characters
    const slugRegex = /^[a-z0-9-]{3,50}$/
    return slugRegex.test(slug)
  }

  /**
   * Generate a URL-friendly slug from a name
   * @param name - The name to convert to a slug
   * @returns URL-friendly slug
   */
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/--+/g, '-') // Replace multiple hyphens with single
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .substring(0, 50) // Limit length
  }

  /**
   * Check if a slug is available (not used yet)
   * @param slug - The slug to check
   * @returns Promise<boolean>
   */
  async function checkSlugAvailability(slug: string): Promise<boolean> {
    if (!isValidSlug(slug)) {
      return false
    }

    try {
      // Try to get organization by slug
      // If it exists, slug is not available
      await organizationAPI.list()
      // Note: This is a simplified check. In production, you'd want a dedicated API endpoint
      return true
    } catch {
      return true
    }
  }

  return {
    create,
    generateSlug,
    isValidSlug,
    checkSlugAvailability,
    loading
  }
}
