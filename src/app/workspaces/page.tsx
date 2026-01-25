'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { useSession } from '@/lib/better-auth-client'
import { Button } from '@/ui-components/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card'
import { Building2, ArrowRight, Loader2 } from 'lucide-react'

interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
}

export default function WorkspacesPage() {
  const router = useRouter()
  const { data, isPending: isLoading } = useSession()
  const user = data?.user || null
  const isAuthenticated = !!user

  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return // Wait for auth to finish loading
    
    if (!isAuthenticated || !user) {
      router.push('/login')
      return
    }

    loadWorkspaces()
  }, [isLoading, isAuthenticated, user])

  async function loadWorkspaces() {
    try {
      setLoading(true)
      const userWorkspaces = await workspacesSupabase.getWorkspacesForUser(user!.id)
      if (userWorkspaces && userWorkspaces.length > 0) {
        setWorkspaces(userWorkspaces)
      } else {
        // No workspaces - redirect to signup
        router.push('/signup')
      }
    } catch (err) {
      console.error('Error loading workspaces:', err)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleWorkspaceSelect = (workspace: Workspace) => {
    // Store the selected workspace and redirect to workspace page
    localStorage.setItem('lastWorkspace', workspace.slug)
    router.push(`/workspace/${workspace.slug}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your workspaces...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Select a Workspace
          </h1>
          <p className="text-lg text-gray-600">
            Choose a workspace to continue working on your projects
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card
              key={workspace.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200"
              onClick={() => handleWorkspaceSelect(workspace)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{workspace.name}</h3>
                    <p className="text-sm text-gray-500 font-normal">@{workspace.slug}</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workspace.description && (
                  <p className="text-gray-600 mb-4">{workspace.description}</p>
                )}
                <Button className="w-full group">
                  Open Workspace
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
