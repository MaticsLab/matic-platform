'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Redirect page for /login route
 * Better Auth redirects here after successful auth
 * We redirect staff to their last workspace, applicants to portal
 */
function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect')

  useEffect(() => {
    // Check if we have a session cookie
    const hasSession = document.cookie.includes('better-auth.session_token=')
    
    if (hasSession) {
      // If we have a redirect path, use it
      if (redirectPath) {
        router.replace(redirectPath)
        return
      }
      
      // Try to get session data from cookie (Better Auth stores it client-side)
      const sessionDataMatch = document.cookie.match(/better-auth\.session_data=([^;]+)/)
      
      if (sessionDataMatch) {
        try {
          const sessionData = JSON.parse(decodeURIComponent(sessionDataMatch[1]))
          const userType = sessionData?.session?.user?.userType || sessionData?.session?.user?.user_type
          
          // Redirect based on user type
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
            router.replace('/portal')
            return
          }
        } catch (e) {
          console.error('Failed to parse session data:', e)
        }
      }
      
      // Default: if we have a session but couldn't parse it, go home
      router.replace('/')
    } else {
      // No session - go to auth page, pass redirect param if present
      const authUrl = redirectPath 
        ? `/auth?mode=login&redirect=${encodeURIComponent(redirectPath)}`
        : '/auth?mode=login'
      router.replace(authUrl)
    }
  }, [router, redirectPath])

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
