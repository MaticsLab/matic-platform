'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/components/auth/provider'
import { useWorkspaceDiscovery } from '@/hooks/useWorkspaceDiscovery'
import { Loader2 } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const { data, isPending: sessionPending } = useSession()
  const { workspaces, loading: workspacesLoading } = useWorkspaceDiscovery()
  const user = data?.user

  useEffect(() => {
    // Wait for session and workspaces to load
    if (sessionPending || workspacesLoading) return

    // If not logged in, go to auth page
    if (!user) {
      router.replace('/auth')
      return
    }

    // User is logged in - check user type
    const userType = (user as any)?.userType || (user as any)?.user_type

    if (userType === 'applicant') {
      // Applicants go to portal
      router.replace('/portal')
      return
    }

    // Staff users - find their workspace
    if (workspaces && workspaces.length > 0) {
      const firstWorkspace = workspaces[0]
      // Save to localStorage for future use
      localStorage.setItem('lastWorkspace', JSON.stringify(firstWorkspace))
      // Redirect to workspace
      router.replace(`/workspace/${firstWorkspace.slug}`)
    } else {
      // No workspaces found - this shouldn't happen for staff
      // Redirect to a "no workspace" page or create workspace page
      console.warn('Staff user has no workspaces')
      router.replace('/auth')
    }
  }, [sessionPending, workspacesLoading, user, workspaces, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
}
