import { goFetch } from './go-client'

export interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  settings?: Record<string, any>
  subscription_tier?: 'free' | 'pro' | 'enterprise'
  created_at: string
  updated_at: string
  members?: OrganizationMember[]
  workspaces?: any[]
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: 'owner' | 'admin' | 'editor' | 'member'
  permissions?: Record<string, any>
  joined_at: string
}

export const organizationsClient = {
  list: () => goFetch<Organization[]>('/organizations'),
  
  get: (id: string) => goFetch<Organization>(`/organizations/${id}`),
  
  create: (data: {
    name: string
    slug: string
    description?: string
    settings?: Record<string, any>
  }) => goFetch<Organization>('/organizations', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  update: (id: string, data: {
    name?: string
    slug?: string
    description?: string
    settings?: Record<string, any>
  }) => goFetch<Organization>(`/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  
  delete: (id: string) => goFetch<void>(`/organizations/${id}`, {
    method: 'DELETE'
  })
}
