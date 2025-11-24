'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { getCurrentUser } from '@/lib/supabase'
import { getLastWorkspace } from '@/lib/utils'

export default function WorkspacesPage() {
  const router = useRouter()

  useEffect(() => {
    redirectToActivitiesHub()
  }, [])

  async function redirectToActivitiesHub() {
    try {
      // Check for last visited workspace
      const lastWorkspace = getLastWorkspace()
      
      if (lastWorkspace) {
        // Redirect to activities hub of last visited workspace
        router.push(`/workspace/${lastWorkspace}/activities-hubs`)
        return
      }

      // Get first workspace and redirect to its activities hub
      const user = await getCurrentUser()
      if (!user) {
        router.push('/login')
        return
      }

      const workspaces = await workspacesSupabase.getWorkspacesForUser(user.id)
      if (workspaces && workspaces.length > 0) {
        router.push(`/workspace/${workspaces[0].slug}/activities-hubs`)
      } else {
        // No workspaces - redirect to signup
        router.push('/signup')
      }
    } catch (err) {
      console.error('Error redirecting to activities hub:', err)
      router.push('/login')
    }
  }

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  )
}
