'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/components/auth/provider'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { organizationsClient } from '@/lib/api/organizations-client'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'

type LastWorkspaceValue = { slug?: string } | string

function readLastWorkspaceSlug(): string | null {
  const raw = localStorage.getItem('lastWorkspace')
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as LastWorkspaceValue
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim()
    if (typeof parsed === 'object' && parsed?.slug) return parsed.slug
  } catch {
    if (raw.trim()) return raw.trim()
  }

  return null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function WorkspaceRootPage() {
  const router = useRouter()
  const { data, isPending } = useSession()
  const [resolving, setResolving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (isPending || resolving || needsOnboarding) return

    if (!data?.session || !data?.user) {
      router.replace('/auth?mode=login&redirect=/workspace')
      return
    }

    const lastSlug = readLastWorkspaceSlug()
    if (lastSlug) {
      router.replace(`/workspace/${lastSlug}/applications`)
      return
    }

    let isMounted = true

    const resolveFirstWorkspace = async () => {
      try {
        setResolving(true)
        const workspaces = await workspacesClient.list()
        const first = Array.isArray(workspaces) && workspaces.length > 0 ? workspaces[0] : null

        if (!isMounted) return

        if (first?.slug) {
          localStorage.setItem('lastWorkspace', JSON.stringify(first))
          router.replace(`/workspace/${first.slug}/applications`)
          return
        }

        // No workspace yet — this is expected for a brand-new account, not an error.
        setNeedsOnboarding(true)
      } catch {
        if (!isMounted) return
        setErrorMessage('Unable to load workspaces right now. Please try again.')
      } finally {
        if (isMounted) setResolving(false)
      }
    }

    resolveFirstWorkspace()

    return () => {
      isMounted = false
    }
  }, [data, isPending, resolving, needsOnboarding, router])

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceName.trim()) return

    setCreating(true)
    setCreateError(null)

    try {
      const slug = slugify(workspaceName) || `workspace-${Date.now()}`

      const organization = await organizationsClient.create({
        name: workspaceName,
        slug,
      })

      const workspace = await workspacesClient.create({
        organization_id: organization.id,
        name: workspaceName,
        slug,
      })

      localStorage.setItem('lastWorkspace', JSON.stringify(workspace))
      router.replace(`/workspace/${workspace.slug}/applications`)
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create workspace. Please try again.')
      setCreating(false)
    }
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-gray-900 font-medium mb-2">Workspace unavailable</p>
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <button
            onClick={() => router.replace('/auth?mode=login&redirect=/workspace')}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in again
          </button>
        </div>
      </div>
    )
  }

  if (needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Create your workspace</h1>
          <p className="text-gray-600 mb-6 text-sm">
            You don&apos;t have a workspace yet. Give it a name to get started.
          </p>
          <form onSubmit={handleCreateWorkspace} className="space-y-4">
            <div>
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Acme Inc."
                autoFocus
                disabled={creating}
              />
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <Button type="submit" disabled={creating || !workspaceName.trim()} className="w-full">
              {creating ? 'Creating...' : 'Create workspace'}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Loading workspace...</p>
      </div>
    </div>
  )
}
