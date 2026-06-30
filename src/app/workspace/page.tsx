'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/components/auth/provider'
import { workspacesClient } from '@/lib/api/workspaces-client'

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

export default function WorkspaceRootPage() {
  const router = useRouter()
  const { data, isPending } = useSession()
  const [resolving, setResolving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isPending || resolving) return

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

        setErrorMessage('No accessible workspace found for this account.')
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
  }, [data, isPending, resolving, router])

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
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
        <p className="text-gray-600">Loading workspace...</p>
      </div>
    </div>
  )
}
