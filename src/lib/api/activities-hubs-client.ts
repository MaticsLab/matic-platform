/**
 * Activities Hubs API Client - Go Backend
 * 
 * Handles all activities hub and tab operations through Go Gin backend
 */

import { goFetch } from './go-client';
import type {
  ActivitiesHub,
  ActivitiesHubWithTabs,
  ActivitiesHubTab,
  CreateActivityInput,
  UpdateActivityInput,
  CreateActivityTabInput,
  UpdateActivityTabInput,
  ReorderTabsInput,
} from '@/types/activities-hubs';

// ============================================================================
// Activities Hub Operations
// ============================================================================

/**
 * List all activities hubs in a workspace
 */
export async function listActivitiesHubs(
  workspaceId: string,
  options?: {
    includeInactive?: boolean;
    includeHidden?: boolean;
  }
): Promise<ActivitiesHub[]> {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  
  if (options?.includeInactive) {
    params.append('include_inactive', 'true');
  }
  
  if (options?.includeHidden) {
    params.append('include_hidden', 'true');
  }

  return goFetch<ActivitiesHub[]>(`/activities-hubs?${params}`);
}

/**
 * Get a single activities hub by ID with tabs
 */
export async function getActivitiesHub(
  workspaceId: string,
  hubId: string
): Promise<ActivitiesHubWithTabs> {
  return goFetch<ActivitiesHubWithTabs>(`/activities-hubs/${hubId}`);
}

/**
 * Get a single activities hub by slug with tabs
 */
export async function getActivitiesHubBySlug(
  workspaceId: string,
  slug: string
): Promise<ActivitiesHubWithTabs> {
  const params = new URLSearchParams({ workspace_id: workspaceId });
  return goFetch<ActivitiesHubWithTabs>(`/activities-hubs/by-slug/${slug}?${params}`);
}

/**
 * Create a new activities hub
 */
export async function createActivitiesHub(
  data: CreateActivityInput
): Promise<ActivitiesHubWithTabs> {
  return goFetch<ActivitiesHubWithTabs>('/activities-hubs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing activities hub
 */
export async function updateActivitiesHub(
  hubId: string,
  data: UpdateActivityInput
): Promise<ActivitiesHubWithTabs> {
  return goFetch<ActivitiesHubWithTabs>(`/activities-hubs/${hubId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete an activities hub
 */
export async function deleteActivitiesHub(
  hubId: string
): Promise<void> {
  return goFetch<void>(`/activities-hubs/${hubId}`, {
    method: 'DELETE',
  });
}

/**
 * Toggle hub visibility (admin only)
 * When hidden, the hub won't appear in navigation or overview for any user
 */
export async function toggleHubVisibility(
  hubId: string,
  isHidden: boolean
): Promise<{ id: string; is_hidden: boolean; message: string }> {
  return goFetch<{ id: string; is_hidden: boolean; message: string }>(`/activities-hubs/${hubId}/visibility`, {
    method: 'PATCH',
    body: JSON.stringify({ is_hidden: isHidden }),
  });
}

// ============================================================================
// Tab Operations
// ============================================================================

/**
 * List all tabs for an activities hub
 */
export async function listActivitiesHubTabs(
  hubId: string,
  options?: {
    includeHidden?: boolean;
  }
): Promise<ActivitiesHubTab[]> {
  const params = new URLSearchParams();
  
  if (options?.includeHidden) {
    params.append('include_hidden', 'true');
  }

  const queryString = params.toString();
  const url = `/activities-hubs/${hubId}/tabs${queryString ? `?${queryString}` : ''}`;
  
  return goFetch<ActivitiesHubTab[]>(url);
}

/**
 * Create a new tab for an activities hub
 */
export async function createActivitiesHubTab(
  hubId: string,
  data: CreateActivityTabInput
): Promise<ActivitiesHubTab> {
  return goFetch<ActivitiesHubTab>(`/activities-hubs/${hubId}/tabs`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing tab
 */
export async function updateActivitiesHubTab(
  hubId: string,
  tabId: string,
  data: UpdateActivityTabInput
): Promise<ActivitiesHubTab> {
  return goFetch<ActivitiesHubTab>(`/activities-hubs/${hubId}/tabs/${tabId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a tab
 */
export async function deleteActivitiesHubTab(
  hubId: string,
  tabId: string
): Promise<void> {
  return goFetch<void>(`/activities-hubs/${hubId}/tabs/${tabId}`, {
    method: 'DELETE',
  });
}

/**
 * Reorder tabs
 */
export async function reorderActivitiesHubTabs(
  hubId: string,
  data: ReorderTabsInput
): Promise<ActivitiesHubTab[]> {
  return goFetch<ActivitiesHubTab[]>(`/activities-hubs/${hubId}/tabs/reorder`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a slug from a name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format date range
 */
export function formatDateRange(beginDate: string | null, endDate: string | null): string {
  if (!beginDate && !endDate) return '';
  if (!endDate) return `Starting ${formatDate(beginDate)}`;
  if (!beginDate) return `Ending ${formatDate(endDate)}`;
  return `${formatDate(beginDate)} → ${formatDate(endDate)}`;
}

/**
 * Calculate activity duration in days
 */
export function calculateDuration(beginDate: string | null, endDate: string | null): number | null {
  if (!beginDate || !endDate) return null;
  const begin = new Date(beginDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - begin.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'emerald';
    case 'upcoming':
      return 'blue';
    case 'completed':
      return 'gray';
    default:
      return 'gray';
  }
}
