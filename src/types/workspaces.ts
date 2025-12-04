// Workspace types
export interface Workspace {
  id: string
  organization_id: string
  name: string
  slug: string
  custom_subdomain?: string | null  // Custom subdomain for branded portal URLs
  description?: string
  color?: string
  icon?: string
  logo_url?: string
  settings: Record<string, any>
  is_archived: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface WorkspaceSummary {
  id: string
  name: string
  slug: string
  custom_subdomain?: string | null
  color?: string
  icon?: string
}

export interface WorkspaceCreate {
  organization_id: string
  name: string
  slug: string
  description?: string
  color?: string
  icon?: string
  settings?: Record<string, any>
}

export interface WorkspaceUpdate {
  name?: string
  description?: string
  color?: string
  icon?: string
  logo_url?: string
  custom_subdomain?: string | null
  settings?: Record<string, any>
  is_archived?: boolean
}

// Member types
export type MemberRole = 'admin' | 'editor' | 'viewer'
export type MemberStatus = 'pending' | 'active' | 'declined' | 'expired'

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id?: string | null  // Nullable for pending invites
  role: MemberRole
  hub_access?: string[] | null  // List of hub IDs, null/empty = all access
  permissions: Record<string, any>
  
  // Invitation fields
  status: MemberStatus
  invited_email?: string
  invited_by?: string | null
  invite_token?: string
  invite_expires_at?: string | null
  invited_at?: string | null
  accepted_at?: string | null
  
  added_at: string
  updated_at: string
  email?: string  // Populated from join with auth.users
}

export interface UpdateMemberInput {
  role?: MemberRole
  hub_access?: string[]
}

// Invitation types
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export interface WorkspaceInvitation {
  id: string
  workspace_id: string
  email: string
  role: MemberRole
  hub_access?: string[] | null
  status: InvitationStatus
  invited_by: string
  inviter_email?: string
  expires_at: string
  accepted_at?: string | null
  created_at: string
  updated_at: string
}

export interface CreateInvitationInput {
  workspace_id: string
  email: string
  role?: MemberRole
  hub_access?: string[]
}

export interface InvitationPreview {
  invitation: Omit<WorkspaceInvitation, 'token'>
  workspace: {
    id: string
    name: string
    slug: string
  }
  is_expired: boolean
}

