/**
 * Better Auth Organizations API Client
 * Direct interface to ba_organizations for multi-tenant support
 * 
 * Note: Workspaces are linked to ba_organizations via ba_organization_id.
 * This client provides direct access to Better Auth organizations.
 */

import { goClient } from './go-client'

export interface BAOrganization {
  id: string // TEXT (Better Auth ID)
  name: string
  slug: string
  logo?: string | null
  metadata?: Record<string, any> // JSONB - contains workspace_id for legacy workspaces
  created_at: string
  updated_at: string
}

export interface BAMember {
  id: string // TEXT (Better Auth ID)
  organization_id: string
  user_id: string // TEXT (Better Auth user ID)
  role: 'owner' | 'admin' | 'member' | 'viewer'
  created_at: string
  updated_at: string
}

export interface BAInvitation {
  id: string
  organization_id: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  expires_at: string
  inviter_id?: string | null
  created_at: string
  updated_at: string
}

/**
 * Get Better Auth organizations for the current user
 * This queries ba_organizations via ba_members
 */
export async function getBAOrganizations(): Promise<BAOrganization[]> {
  // For now, we'll use the regular organizations endpoint
  // which returns organizations the user is a member of
  // In the future, we can add a dedicated ba_organizations endpoint
  const orgs = await goClient.get<any[]>('/organizations')
  
  // Map to BAOrganization format if needed
  // The backend should return organizations with ba_organization_id if available
  return orgs.map(org => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    logo: org.logo_url || null,
    metadata: org.settings || {},
    created_at: org.created_at,
    updated_at: org.updated_at,
  }))
}

/**
 * Get Better Auth members for an organization
 * This queries ba_members
 */
export async function getBAMembers(organizationId: string): Promise<BAMember[]> {
  // Get organization with members preloaded
  const org = await goClient.get<any>(`/organizations/${organizationId}`)
  
  // Map members to BAMember format
  return (org.members || []).map((member: any) => ({
    id: member.id,
    organization_id: member.organization_id,
    user_id: member.ba_user_id || member.user_id, // Prefer Better Auth ID
    role: member.role,
    created_at: member.joined_at || member.created_at,
    updated_at: member.updated_at,
  }))
}

/**
 * Get workspace's Better Auth organization
 * Workspaces have ba_organization_id linking to ba_organizations
 */
export async function getWorkspaceBAOrganization(workspaceId: string): Promise<BAOrganization | null> {
  // Get workspace which should include ba_organization_id
  const workspace = await goClient.get<any>(`/workspaces/${workspaceId}`)
  
  if (!workspace.ba_organization_id) {
    return null
  }
  
  // Get the organization
  return goClient.get<BAOrganization>(`/organizations/${workspace.ba_organization_id}`)
}

