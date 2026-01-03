'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { getLastWorkspace } from '@/lib/utils'
import { useSession } from '@/lib/better-auth-client'

export default function Home() {
  const router = useRouter()
  const { data, isPending: isLoading } = useSession()
  const user = data?.user || null
  const isAuthenticated = !!user

  useEffect(() => {
    if (isLoading) return // Wait for auth to finish loading

    checkAuthAndRedirect()
  }, [isLoading, isAuthenticated, user])

  async function checkAuthAndRedirect() {
    if (isAuthenticated && user) {
      // User is logged in - redirect to activities hub
      const lastWorkspace = getLastWorkspace()
      
      if (lastWorkspace) {
        router.push(`/workspace/${lastWorkspace}`)
      } else {
        // Get first workspace and redirect to it
        try {
          const workspaces = await workspacesSupabase.getWorkspacesForUser(user.id)
          if (workspaces && workspaces.length > 0) {
            router.push(`/workspace/${workspaces[0].slug}`)
          } else {
            // No workspaces - redirect to login
            router.push('/login')
          }
        } catch (error) {
          console.error('Error fetching workspaces:', error)
          router.push('/login')
        }
      }
    } else if (!isLoading) {
      // User is not logged in - redirect to login page
      router.push('/login')
    }
  }

  // Show loading state while checking auth
  return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
