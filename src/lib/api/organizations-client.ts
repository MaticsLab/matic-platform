/**
 * Organizations API Client
 * Uses Better Auth organizations (ba_organizations) for multi-tenant support
 */

import { goClient } from './go-client'

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  settings: Record<string, any>
  subscription_tier?: string
  created_at: string
  updated_at: string
  // Relations
  members?: OrganizationMember[]
  workspaces?: any[] // Workspaces belong to this organization
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id?: string | null // Legacy UUID (nullable)
  ba_user_id?: string | null // Better Auth user ID (TEXT)
  role: 'owner' | 'admin' | 'member' | 'viewer'
  permissions?: Record<string, any>
  joined_at: string
  updated_at: string
}

export interface CreateOrganizationInput {
  name: string
  slug: string
  description?: string
  settings?: Record<string, any>
}

export interface UpdateOrganizationInput {
  name?: string
  slug?: string
  description?: string
  settings?: Record<string, any>
}

export const organizationsClient = {
  /**
   * List all organizations the current user is a member of
   */
  list: () => goClient.get<Organization[]>('/organizations'),

  /**
   * Get a single organization by ID
   */
  get: (id: string) => goClient.get<Organization>(`/organizations/${id}`),

  /**
   * Create a new organization
   */
  create: (data: CreateOrganizationInput) => 
    goClient.post<Organization>('/organizations', data),

  /**
   * Update an organization
   */
  update: (id: string, data: UpdateOrganizationInput) => 
    goClient.patch<Organization>(`/organizations/${id}`, data),

  /**
   * Delete an organization (only owners can delete)
   */
  delete: (id: string) => 
    goClient.delete(`/organizations/${id}`),
}
