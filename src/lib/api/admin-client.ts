import { goFetch } from './go-client'

export interface AuthUser {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
}

export interface DeleteUserRequest {
  user_id: string
  reassign_to_user_id?: string
}

export const adminClient = {
  // List all auth users (admin only)
  listUsers: () => goFetch<AuthUser[]>('/admin/users'),

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
