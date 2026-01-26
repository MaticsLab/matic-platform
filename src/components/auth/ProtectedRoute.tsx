'use client'

import { useSession } from '@/lib/better-auth-client'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
  redirectTo?: string
  requireOrganization?: boolean
  fallback?: ReactNode
}

/**
 * ProtectedRoute Component
 * 
 * Wraps a route/page to require authentication.
 * Automatically redirects to login if user is not authenticated.
 * Redirects to user's last workspace or first available workspace after auth.
 * 
 * @example
 * ```tsx
 * export default function WorkspacePage() {
 *   return (
 *     <ProtectedRoute requireOrganization>
 *       <WorkspaceContent />
 *     </ProtectedRoute>
 *   )
 * }
 * ```
 */
export function ProtectedRoute({
  children,
  redirectTo = '/?login=true',
  requireOrganization = false,
  fallback,
}: ProtectedRouteProps) {
  const { data, isPending } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isPending) return

    if (!data?.session) {
      const separator = redirectTo.includes('?') ? '&' : '?'
      const redirect = `${redirectTo}${separator}redirect=${encodeURIComponent(pathname)}`
      router.push(redirect)
      return
    }

    if (requireOrganization && !(data?.session as any)?.activeOrganizationId) {
      // Instead of going to /workspaces, redirect to last workspace or first available
      const lastWorkspace = localStorage.getItem('lastWorkspace')
      if (lastWorkspace) {
        try {
          const workspace = JSON.parse(lastWorkspace)
          router.push(`/workspace/${workspace.slug}`)
          return
        } catch (e) {
          // If JSON parse fails, treat it as a slug string
          router.push(`/workspace/${lastWorkspace}`)
          return
        }
      }
      // If no last workspace, will need to fetch user's workspaces - handled by workspace discovery
    }
  }, [data, isPending, redirectTo, requireOrganization, pathname, router])

  // Show loading state while checking auth
  if (isPending) {
    return fallback || null
  }

  // Show nothing while redirecting (will redirect via useEffect)
  if (!data?.session) {
    return fallback || null
  }

  if (requireOrganization && !(data?.session as any)?.activeOrganizationId) {
    return fallback || null
  }

  return <>{children}</>
}


