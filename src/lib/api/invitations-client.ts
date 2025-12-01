/**
 * Workspace Invitations & Members API Client
 * 
 * Handles all invitation and member management operations
 */

import { goFetch } from './go-client'
import type {
  WorkspaceMember,
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
 * Create a new invitation
 */
export async function createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation> {
  return goFetch<WorkspaceInvitation>('/invitations', {
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
  create: createInvitation,
  revoke: revokeInvitation,
  resend: resendInvitation,
  getByToken: getInvitationByToken,
  accept: acceptInvitation,
}

export const membersClient = {
  list: listWorkspaceMembers,
  update: updateWorkspaceMember,
  remove: removeWorkspaceMember,
}
