import { goFetch } from './go-client'

export interface AuthUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
}

export interface BetterAuthUser {
  id: string
  email: string
  name: string
  full_name?: string
  avatar_url?: string
  user_type: string // 'staff', 'applicant', 'reviewer'
  created_at: string
  updated_at: string
  last_sign_in_at?: string
}

export interface DeleteUserRequest {
  user_id: string
  reassign_to_user_id?: string
}

export const adminClient = {
  // List all auth users (admin only)
  listUsers: () => goFetch<AuthUser[]>('/admin/users'),

  // List all Better Auth users (from ba_users table)
  listBetterAuthUsers: () => goFetch<BetterAuthUser[]>('/admin/users?type=better_auth'),

  // Delete a user and optionally reassign their data
  deleteUser: (userId: string, reassignToUserId?: string) =>
    goFetch<{ message: string }>('/admin/users', {
      method: 'DELETE',
      body: JSON.stringify({
        user_id: userId,
        reassign_to_user_id: reassignToUserId,
      } as DeleteUserRequest),
    }),
}
