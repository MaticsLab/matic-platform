'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useSession } from '@/components/auth/provider'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { organizationsClient } from '@/lib/api/organizations-client'
import { Input } from '@/ui-components/input'

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
    const initial = workspaceName.trim().charAt(0).toUpperCase()

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-6">
        <div className="w-full max-w-[380px] animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div
            className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl text-lg font-semibold text-white shadow-sm transition-colors duration-300"
            style={{ backgroundColor: initial ? '#171717' : '#d4d4d4' }}
          >
            {initial || ''}
          </div>

          <div className="text-center mb-8">
            <h1 className="text-[22px] font-semibold tracking-tight text-neutral-900 mb-1.5">
              Create your workspace
            </h1>
            <p className="text-[14px] text-neutral-500 leading-relaxed">
              This is where your team&apos;s forms and data will live.
            </p>
          </div>

          <form onSubmit={handleCreateWorkspace} className="space-y-3">
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Acme Inc."
              autoFocus
              disabled={creating}
              className="h-11 rounded-lg border-neutral-200 bg-white px-3.5 text-[15px] shadow-sm placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-900/10 focus-visible:border-neutral-400"
            />

            {createError && (
              <p className="text-[13px] text-red-600 px-0.5">{createError}</p>
            )}

            <button
              type="submit"
              disabled={creating || !workspaceName.trim()}
              className="group flex h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-900 text-[14px] font-medium text-white shadow-sm transition-all duration-150 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating workspace
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
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
