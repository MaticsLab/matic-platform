/**
 * Workspace Invitations & Members API Client
 * 
 * Handles all invitation and member management operations
 */

import { goFetch } from './go-client'
import type {
  WorkspaceMember,
  WorkspaceMemberWithAuth,
  WorkspaceInvitation,
  CreateInvitationInput,
  UpdateMemberInput,
  InvitationPreview,
} from '@/types/workspaces'

// ============================================================================
// Invitation Operations
// ============================================================================

/**
 * List all invitations for a workspace
 */
export async function listInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  return goFetch<WorkspaceInvitation[]>('/invitations', {
    params: { workspace_id: workspaceId },
  })
}

/**
 * List invitations for a workspace via the nested /workspaces/:id/invitations route
 * (GetWorkspaceInvitations — a thin wrapper around the same handler as listInvitations,
 * just scoped by URL path instead of a query param).
 */
export async function getWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
  return goFetch<WorkspaceInvitation[]>(`/workspaces/${workspaceId}/invitations`)
}

/**
 * Create a new invitation
 */
export async function createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation> {
  return goFetch<WorkspaceInvitation>('/invitations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Create a new invitation via the nested /workspaces/:id/invitations route
 * (CreateWorkspaceInvitation — injects workspace_id from the URL, so it's omitted here).
 */
export async function createWorkspaceInvitation(
  workspaceId: string,
  input: Omit<CreateInvitationInput, 'workspace_id'>
): Promise<WorkspaceInvitation> {
  return goFetch<WorkspaceInvitation>(`/workspaces/${workspaceId}/invitations`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Revoke a pending invitation
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  return goFetch<void>(`/invitations/${invitationId}`, {
    method: 'DELETE',
  })
}

/**
 * Resend an invitation email
 */
export async function resendInvitation(invitationId: string): Promise<WorkspaceInvitation> {
  return goFetch<WorkspaceInvitation>(`/invitations/${invitationId}/resend`, {
    method: 'POST',
  })
}

/**
 * Get invitation details by token (for accepting)
 */
export async function getInvitationByToken(token: string): Promise<InvitationPreview> {
  return goFetch<InvitationPreview>(`/invitations/by-token/${token}`)
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(token: string): Promise<{
  message: string
  workspace: { id: string; name: string; slug: string }
  member: WorkspaceMember
}> {
  return goFetch(`/invitations/accept/${token}`, {
    method: 'POST',
  })
}

/**
 * Decline an invitation
 */
export async function declineInvitation(token: string): Promise<{ message: string }> {
  return goFetch(`/invitations/decline/${token}`, {
    method: 'POST',
  })
}

// ============================================================================
// Member Operations
// ============================================================================

/**
 * List all members of a workspace
 */
export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return goFetch<WorkspaceMember[]>('/workspace-members', {
    params: { workspace_id: workspaceId },
  })
}

/**
 * List workspace members joined with their Better Auth user record (name, email,
 * image) via the nested /workspaces/:id/members-with-auth route. Excludes
 * applicant-type users. Prefer this over listWorkspaceMembers for any UI that
 * displays member name/email.
 */
export async function getWorkspaceMembersWithAuth(workspaceId: string): Promise<WorkspaceMemberWithAuth[]> {
  return goFetch<WorkspaceMemberWithAuth[]>(`/workspaces/${workspaceId}/members-with-auth`)
}

/**
 * Update a workspace member's role or hub access
 */
export async function updateWorkspaceMember(
  memberId: string,
  input: UpdateMemberInput
): Promise<WorkspaceMember> {
  return goFetch<WorkspaceMember>(`/workspace-members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/**
 * Remove a member from a workspace
 */
export async function removeWorkspaceMember(memberId: string): Promise<void> {
  return goFetch<void>(`/workspace-members/${memberId}`, {
    method: 'DELETE',
  })
}

// ============================================================================
// Export Client Object
// ============================================================================

export const invitationsClient = {
  // Invitations
  list: listInvitations,
  listForWorkspace: getWorkspaceInvitations,
  create: createInvitation,
  createForWorkspace: createWorkspaceInvitation,
  revoke: revokeInvitation,
  resend: resendInvitation,
  getByToken: getInvitationByToken,
  accept: acceptInvitation,
  decline: declineInvitation,
}

export const membersClient = {
  list: listWorkspaceMembers,
  listWithAuth: getWorkspaceMembersWithAuth,
  update: updateWorkspaceMember,
  remove: removeWorkspaceMember,
}
