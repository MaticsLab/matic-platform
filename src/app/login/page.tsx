'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Redirect page for /login route
 * Better Auth redirects here after successful auth
 * We redirect staff to their last workspace, applicants to portal
 */
export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    // Check if we have a session cookie
    const hasSession = document.cookie.includes('better-auth.session_token=')
    
    if (hasSession) {
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
      // No session - go to auth page
      router.replace('/auth?mode=login')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}
