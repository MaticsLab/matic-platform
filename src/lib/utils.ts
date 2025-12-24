import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extract a meaningful error message from various error types.
 * Handles Error instances, objects with message/error properties, strings,
 * and nested error structures common in AI SDKs.
 */
export function getErrorMessage(error: unknown): string {
  // Handle null/undefined
  if (error === null || error === undefined) {
    return "Unknown error";
  }

  // Handle Error instances (and their subclasses)
  if (error instanceof Error) {
    // Some errors have a cause property with more details
    if (error.cause && error.cause instanceof Error) {
      return `${error.message}: ${error.cause.message}`;
    }
    return error.message;
  }

  // Handle strings
  if (typeof error === "string") {
    return error;
  }

  // Handle objects with message or error properties
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    
    if (typeof obj.message === "string") {
      return obj.message;
    }
    
    if (typeof obj.error === "string") {
      return obj.error;
    }
    
    // Try to stringify the object
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

/**
 * Async version of getErrorMessage that handles Promise errors
 */
export async function getErrorMessageAsync(error: unknown): Promise<string> {
  if (error instanceof Promise) {
    try {
      const resolved = await error;
      return getErrorMessage(resolved);
    } catch (e) {
      return getErrorMessage(e);
    }
  }
  return getErrorMessage(error);
}

// Domain utilities for workspace routing
export function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split('.')
  
  // For localhost development
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return null
  }
  
  // For maticsapp.com subdomains
  if (parts.length >= 3 && parts[1] === 'maticsapp' && parts[2] === 'com') {
    return parts[0]
  }
  
  return null
}

export function isValidWorkspaceSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 3 && slug.length <= 50
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const target = new Date(date)
  const diffInSeconds = Math.floor((now.getTime() - target.getTime()) / 1000)

  if (diffInSeconds < 60) return 'just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
  
  return formatDate(target)
}
// Workspace navigation tracking
const LAST_WORKSPACE_KEY = 'matic_last_workspace'

export function saveLastWorkspace(workspaceSlug: string) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LAST_WORKSPACE_KEY, workspaceSlug)
  } catch (error) {
    console.error('Failed to save last workspace:', error)
  }
}

export function getLastWorkspace(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(LAST_WORKSPACE_KEY)
  } catch (error) {
    console.error('Failed to get last workspace:', error)
    return null
  }
}

export function clearLastWorkspace() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(LAST_WORKSPACE_KEY)
  } catch (error) {
    console.error('Failed to clear last workspace:', error)
  }
}
