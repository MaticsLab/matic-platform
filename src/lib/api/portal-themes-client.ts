/**
 * Portal Themes API Client
 *
 * Reusable, workspace-level form themes — saved independently of any single
 * form so they can be applied across multiple forms in a workspace.
 */

import { goFetch } from './go-client'
import type { PortalTheme } from '@/types/portal'

export type PortalThemeInput = Omit<PortalTheme, 'id' | 'is_default' | 'created_at' | 'updated_at'>

/**
 * List all saved themes for a workspace
 */
export async function listPortalThemes(workspaceId: string): Promise<PortalTheme[]> {
  return goFetch<PortalTheme[]>('/portal-themes', {
    params: { workspace_id: workspaceId },
  })
}

/**
 * Create a new saved theme
 */
export async function createPortalTheme(input: PortalThemeInput): Promise<PortalTheme> {
  return goFetch<PortalTheme>('/portal-themes', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/**
 * Update a saved theme (rename, or overwrite its values) — full-replace on the
 * editable fields, matching this backend's ending-pages update convention.
 */
export async function updatePortalTheme(
  themeId: string,
  input: PortalThemeInput
): Promise<PortalTheme> {
  return goFetch<PortalTheme>(`/portal-themes/${themeId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

/**
 * Delete a saved theme
 */
export async function removePortalTheme(themeId: string): Promise<void> {
  return goFetch<void>(`/portal-themes/${themeId}`, {
    method: 'DELETE',
  })
}

/**
 * Duplicate a saved theme (server appends " (copy)" to the name)
 */
export async function duplicatePortalTheme(themeId: string): Promise<PortalTheme> {
  return goFetch<PortalTheme>(`/portal-themes/${themeId}/duplicate`, {
    method: 'POST',
  })
}

/**
 * Set a saved theme as the workspace default (unsets any other default)
 */
export async function setDefaultPortalTheme(themeId: string): Promise<PortalTheme> {
  return goFetch<PortalTheme>(`/portal-themes/${themeId}/default`, {
    method: 'POST',
  })
}

export const portalThemesClient = {
  list: listPortalThemes,
  create: createPortalTheme,
  update: updatePortalTheme,
  remove: removePortalTheme,
  duplicate: duplicatePortalTheme,
  setDefault: setDefaultPortalTheme,
}
