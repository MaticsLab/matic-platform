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
    console.log('[Login] Session check:', { isPending, hasSession: !!data?.session, hasUser: !!data?.user, data })

    // Wait for session to load
    if (isPending) {
      console.log('[Login] Still pending, waiting...')
      return
    }

    const session = data?.session
    const user = data?.user

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
      if (userType === 'staff') {
        // Try to get last workspace
        const lastWorkspace = localStorage.getItem('lastWorkspace')
        if (lastWorkspace) {
          try {
            const workspace = JSON.parse(lastWorkspace)
            router.replace(`/workspace/${workspace.slug}`)
            return
          } catch (e) {
            router.replace(`/workspace/${lastWorkspace}`)
            return
          }
        }
        // No last workspace - go to home which will handle discovery
        router.replace('/')
        return
      } else if (userType === 'applicant') {
        // For applicants without a redirect path, go to root
        // The subdomain routing will handle showing the correct application
        console.log('[Login] Applicant without redirect path, going to root')
        router.replace('/')
        return
      }

      // Default: if we have a session but no user type, go home
      console.log('[Login] No user type, going home')
      router.replace('/')
    } else {
      // No session - go to auth page
      console.log('[Login] No session found, redirecting to auth')
      const authUrl = redirectPath
        ? `/auth?mode=login&redirect=${encodeURIComponent(redirectPath)}`
        : '/auth?mode=login'
      router.replace(authUrl)
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
