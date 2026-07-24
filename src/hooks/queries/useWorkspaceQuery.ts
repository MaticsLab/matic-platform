'use client'

import { useQuery } from '@tanstack/react-query'
import { workspacesClient } from '@/lib/api/workspaces-client'

export function workspaceQueryKey(workspaceId: string | null | undefined) {
  return ['workspace', workspaceId] as const
}

export function workspaceBySlugQueryKey(slug: string | null | undefined) {
  return ['workspace', 'by-slug', slug] as const
}

export function useWorkspaceQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: workspaceQueryKey(workspaceId),
    queryFn: () => workspacesClient.get(workspaceId as string),
    enabled: !!workspaceId,
  })
}

export function useWorkspaceBySlugQuery(slug: string | null | undefined) {
  return useQuery({
    queryKey: workspaceBySlugQueryKey(slug),
    queryFn: () => workspacesClient.getBySlug(slug as string),
    enabled: !!slug,
  })
}
