import type { Workspace as APIWorkspace } from '@/lib/api/workspaces-client'

// Deliberately NOT 'use client' — this plain function/type module is imported
// from both the (dashboard) layout.tsx Server Component and the client-side
// useWorkspaceDiscovery hook. A plain utility function exported from a
// 'use client' module becomes a client-reference stub (not the real callable
// function) when imported into a Server Component, which is exactly what
// broke this in production the first time ("TypeError: object is not a
// function" inside layout.tsx's Array.map) — keeping this file client-boundary-
// free avoids that entirely.

export interface DiscoveryWorkspace {
  id: string
  name: string
  slug: string
  plan: string
}

export interface WorkspaceDiscoverySeed {
  workspaces: DiscoveryWorkspace[]
  currentWorkspace: DiscoveryWorkspace | null
}

/** Maps the raw API workspace shape to the discovery hook's minimal shape —
 * shared so a server-fetched seed lines up exactly with what the client-side
 * fetch would have produced. */
export function toDiscoveryWorkspace(workspace: APIWorkspace): DiscoveryWorkspace {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: 'free', // TODO: Add plan field to backend
  }
}
