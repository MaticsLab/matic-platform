'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/components/auth/provider'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { organizationsClient } from '@/lib/api/organizations-client'

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Guards against re-running on every re-render of this component (e.g. when
  // useSession() returns a new object reference with the same underlying user).
  // A ref survives re-renders without itself triggering one, unlike state.
  const hasStartedRef = useRef(false)

  const userId = data?.user?.id

  useEffect(() => {
    if (isPending) return

    if (!data?.session || !data?.user) {
      router.replace('/auth?mode=login&redirect=/workspace')
      return
    }

    if (hasStartedRef.current) return

    const lastSlug = readLastWorkspaceSlug()
    if (lastSlug) {
      hasStartedRef.current = true
      router.replace(`/workspace/${lastSlug}`)
      return
    }

    hasStartedRef.current = true

    const resolveOrCreateWorkspace = async () => {
      try {
        const workspaces = await workspacesClient.list()
        let workspace = Array.isArray(workspaces) && workspaces.length > 0 ? workspaces[0] : null

        if (!workspace) {
          // Brand-new account, no workspace yet — create one automatically so
          // workspace setup is never a required, user-facing step.
          const displayName = data.user.name || data.user.email?.split('@')[0] || 'My'
          const name = `${displayName}'s Workspace`
          const slug = `${slugify(displayName)}-${Math.random().toString(36).slice(2, 7)}`

          const organization = await organizationsClient.create({ name, slug })
          workspace = await workspacesClient.create({
            organization_id: organization.id,
            name,
            slug,
          })
        }

        if (!workspace?.slug) {
          throw new Error('Workspace create/list returned no slug')
        }

        localStorage.setItem('lastWorkspace', JSON.stringify(workspace))
        router.replace(`/workspace/${workspace.slug}`)
      } catch (err) {
        console.error('[Workspace Resolver] Failed to resolve or create workspace:', err)
        hasStartedRef.current = false
        setErrorMessage('Unable to load your workspace right now. Please try again.')
      }
    }

    resolveOrCreateWorkspace()
  }, [isPending, data?.session, userId, router])

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="text-center">
        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3 text-neutral-400" />
        <p className="text-[14px] text-neutral-500">Loading workspace...</p>
      </div>
    </div>
  )
}
