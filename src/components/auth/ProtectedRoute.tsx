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
  redirectTo = '/login',
  requireOrganization = false,
  fallback,
}: ProtectedRouteProps) {
  const { data, isPending } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isPending) return

    if (!data?.session) {
      const redirect = `${redirectTo}?redirect=${encodeURIComponent(pathname)}`
      router.push(redirect)
      return
    }

    if (requireOrganization && !(data?.session as any)?.activeOrganizationId) {
      router.push('/workspaces')
      return
    }
  }, [data, isPending, router, redirectTo, requireOrganization, pathname])

  // Show loading state while checking auth
  if (isPending) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    )
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

