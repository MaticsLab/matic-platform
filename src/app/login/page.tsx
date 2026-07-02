'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/components/auth/provider'

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
    console.log('[Login] Session check:', { isPending, hasSession: !!data?.session, hasUser: !!data?.user, redirectPath })

    // Wait for session to load - be patient, sometimes it takes a moment
    if (isPending) {
      console.log('[Login] Session still loading, waiting...')
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
      console.log('[Login] User authenticated:', { 
        userId: user.id, 
        email: user.email,
        userType: (user as any)?.userType || (user as any)?.user_type 
      })

      // If user navigated back to /login without a redirect query,
      // prefer returning to the last in-app page instead of forcing home.
      if (!redirectPath && typeof window !== 'undefined' && document.referrer) {
        try {
          const referrerUrl = new URL(document.referrer)
          if (referrerUrl.origin === window.location.origin) {
            const referrerPath = `${referrerUrl.pathname}${referrerUrl.search}`
            if (!referrerPath.startsWith('/login') && !referrerPath.startsWith('/auth')) {
              console.log('[Login] Using in-app referrer fallback:', referrerPath)
              router.replace(referrerPath)
              return
            }
          }
        } catch {
          // Ignore malformed referrer and continue with existing redirect logic.
        }
      }
      
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
        // Try to get last workspace from localStorage first (key: 'matic_last_workspace', plain slug string)
        const lastWorkspace = localStorage.getItem('matic_last_workspace')
        if (lastWorkspace) {
          try {
            const workspace = JSON.parse(lastWorkspace)
            console.log('[Login] Redirecting to last workspace:', workspace.slug)
            router.replace(`/workspace/${workspace.slug}`)
            return
          } catch (e) {
            console.log('[Login] Redirecting to last workspace:', lastWorkspace)
            router.replace(`/workspace/${lastWorkspace}`)
            return
          }
        }
        // No last workspace - use workspace root resolver instead of sending user home
        console.log('[Login] No last workspace, going to workspace resolver')
        router.replace('/workspace')
        return
      } else if (userType === 'applicant') {
        // Avoid forcing home so back navigation does not bounce users away.
        console.log('[Login] Applicant user, going to workspace resolver')
        router.replace('/workspace')
        return
      }

      // Default: if we have a session but no user type, go home
      console.log('[Login] Session exists but no user type, going to workspace resolver')
      router.replace('/workspace')
    } else {
      // No session after loading completed
      // This might happen if Better Auth cookie hasn't propagated yet
      // Give it a moment and try one refresh before giving up
      console.warn('[Login] No session found after auth. Waiting 1 second for cookie propagation...')
      
      setTimeout(() => {
        // Check one more time
        if (!data?.session) {
          console.error('[Login] Still no session after wait. Redirecting to auth page.')
          router.replace('/auth')
        }
      }, 1000)
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
