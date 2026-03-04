'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/components/auth/provider'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'

/**
 * Redirect page for /login route
 * Better Auth redirects here after successful auth
 * We redirect staff to their last workspace, applicants to portal
 */
function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect')
  const { data, isPending } = useSession()

  useEffect(() => {
    console.log('[Login] Session check:', { isPending, hasSession: !!data?.session, hasUser: !!data?.user, data, redirectPath })

    // Wait for session to load
    if (isPending) {
      console.log('[Login] Still pending, waiting...')
      return
    }

    const session = data?.session
    const user = data?.user

    // CRITICAL: If redirect path is provided and no staff session exists,
    // redirect back to the original page to handle its own auth
    // This prevents redirect loops for portal pages that have their own auth
    if (redirectPath && !session) {
      console.log('[Login] No staff session with redirect path, going back to:', redirectPath)
      router.replace(redirectPath)
      return
    }

    if (session && user) {
      console.log('[Login] User logged in:', { userType: (user as any)?.userType || (user as any)?.user_type })
      
      // Get user type from session
      const userType = (user as any)?.userType || (user as any)?.user_type

      // If we have a redirect path, use it (for both staff and applicants)
      if (redirectPath) {
        console.log('[Login] Using redirect path:', redirectPath)
        router.replace(redirectPath)
        return
      }

      // Redirect based on user type only if no redirect path specified
      if (userType === 'staff' || userType === 'owner' || userType === 'admin' || userType === 'member') {
        // Try to get last workspace from localStorage first
        const lastWorkspace = localStorage.getItem('lastWorkspace')
        if (lastWorkspace) {
          try {
            const workspace = JSON.parse(lastWorkspace)
            router.replace(`/workspace/${workspace.slug}/applications`)
            return
          } catch (e) {
            router.replace(`/workspace/${lastWorkspace}/applications`)
            return
          }
        }
        // No last workspace - fetch first available from API
        workspacesSupabase.getWorkspacesForUser(user.id).then(workspaces => {
          if (workspaces && workspaces.length > 0) {
            const first = workspaces[0]
            localStorage.setItem('lastWorkspace', JSON.stringify({ id: first.id, slug: first.slug, name: first.name }))
            router.replace(`/workspace/${first.slug}/applications`)
          } else {
            // No workspaces found - go to auth to set up
            router.replace('/auth')
          }
        }).catch(() => {
          router.replace('/auth')
        })
        return
      } else if (userType === 'applicant') {
        // For applicants without a redirect path, go to root
        // The subdomain routing will handle showing the correct application
        console.log('[Login] Applicant without redirect path, going to root')
        router.replace('/')
        return
      }

      // Default: authenticated but unknown user type — try workspace resolution
      console.log('[Login] Unknown user type, attempting workspace resolution:', userType)
      workspacesSupabase.getWorkspacesForUser(user.id).then(workspaces => {
        if (workspaces && workspaces.length > 0) {
          const first = workspaces[0]
          localStorage.setItem('lastWorkspace', JSON.stringify({ id: first.id, slug: first.slug, name: first.name }))
          router.replace(`/workspace/${first.slug}/applications`)
        } else {
          router.replace('/auth')
        }
      }).catch(() => router.replace('/auth'))
    } else {
      // No session AND no redirect path - go to auth page
      console.log('[Login] No session and no redirect path, redirecting to auth')
      router.replace('/auth?mode=login')
    }
  }, [data, isPending, router, redirectPath])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
