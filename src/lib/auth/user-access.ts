/**
 * User Access Control Utilities
 * 
 * Defines access levels and provides helper functions to check user permissions
 * based on user_type and organization roles.
 */

export type UserType = 'staff' | 'applicant' | 'reviewer'
export type OrganizationRole = 'owner' | 'admin' | 'member'

export interface User {
  id: string
  email: string
  name?: string
  user_type: UserType
  email_verified?: boolean
}

export interface UserWithOrgRole extends User {
  organization_role?: OrganizationRole
  organization_id?: string
}

/**
 * Check if user can access the main application
 * Only staff users can access the main app
 */
export function canAccessMainApp(user: User | null): boolean {
  if (!user) return false
  return user.user_type === 'staff'
}

/**
 * Check if user can access the portal
 * Both applicants and staff can access portal, but applicants are restricted to portal only
 */
export function canAccessPortal(user: User | null): boolean {
  if (!user) return false
  return user.user_type === 'applicant' || user.user_type === 'staff'
}

/**
 * Check if user is an applicant (restricted to portal only)
 */
export function isApplicant(user: User | null): boolean {
  if (!user) return false
  return user.user_type === 'applicant'
}

/**
 * Check if user is staff (can access main app and portal)
 */
export function isStaff(user: User | null): boolean {
  if (!user) return false
  return user.user_type === 'staff'
}

/**
 * Check if user is an organization owner
 */
export function isOrganizationOwner(user: UserWithOrgRole | null): boolean {
  if (!user) return false
  return user.organization_role === 'owner'
}

/**
 * Check if user is an organization admin or owner
 */
export function isOrganizationAdmin(user: UserWithOrgRole | null): boolean {
  if (!user) return false
  return user.organization_role === 'owner' || user.organization_role === 'admin'
}

/**
 * Check if user can manage organization settings
 * Only owners and admins can manage organization settings
 */
export function canManageOrganization(user: UserWithOrgRole | null): boolean {
  if (!user || !isStaff(user)) return false
  return isOrganizationAdmin(user)
}

/**
 * Check if user can manage workspace
 * Staff users who are organization members can manage workspaces
 */
export function canManageWorkspace(user: UserWithOrgRole | null): boolean {
  if (!user || !isStaff(user)) return false
  return user.organization_id !== undefined
}

/**
 * Check if user can invite other users
 * Only staff users with organization admin+ role can invite
 */
export function canInviteUsers(user: UserWithOrgRole | null): boolean {
  if (!user || !isStaff(user)) return false
  return isOrganizationAdmin(user)
}

/**
 * Get user's access level description
 */
export function getUserAccessLevel(user: UserWithOrgRole | null): string {
  if (!user) return 'No Access'
  
  if (user.user_type === 'applicant') {
    return 'Portal Access Only'
  }
  
  if (user.user_type === 'staff') {
    if (user.organization_role === 'owner') {
      return 'Organization Owner'
    }
    if (user.organization_role === 'admin') {
      return 'Organization Admin'
    }
    if (user.organization_role === 'member') {
      return 'Organization Member'
    }
    return 'Staff (No Organization)'
  }
  
  return 'Unknown Access'
}

/**
 * Redirect path based on user type
 */
export function getDefaultRedirectPath(user: User | null): string {
  if (!user) return '/auth'
  
  if (user.user_type === 'applicant') {
    return '/portal'
  }
  
  if (user.user_type === 'staff') {
    return '/workspace'
  }
  
  return '/auth'
}
