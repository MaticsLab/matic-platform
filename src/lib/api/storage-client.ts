/**
 * Storage API Client
 *
 * Replaces direct browser-to-Supabase-Storage calls with uploads proxied through the
 * Go backend, which talks to Railway object storage buckets (workspace-assets,
 * user-assets). Mirrors the shape of the Supabase Storage client
 * (`.from(bucket).upload()/.getPublicUrl()/.remove()`) so call sites need minimal changes.
 */
import { getSessionToken } from '@/lib/auth-helpers'

const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_GO_API_URL) {
    return process.env.NEXT_PUBLIC_GO_API_URL
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:8080/api/v1'
    }
  }
  return 'https://api.maticsapp.com/api/v1'
}

const GO_API_URL = getApiUrl()

async function authHeaders(): Promise<HeadersInit> {
  const sessionToken = await getSessionToken()
  if (!sessionToken) return {}
  if (typeof window === 'undefined') return { Authorization: `Bearer ${sessionToken}` }
  try {
    const requestHost = new URL(GO_API_URL).hostname
    if (requestHost !== window.location.hostname) {
      return { Authorization: `Bearer ${sessionToken}` }
    }
  } catch {
    return { Authorization: `Bearer ${sessionToken}` }
  }
  return {}
}

export type StorageBucket = 'workspace-assets' | 'user-assets'

interface StorageResult<T> {
  data: T | null
  error: Error | null
}

function storageObjectUrl(bucket: StorageBucket, path: string): string {
  return `${GO_API_URL}/storage/object/${bucket}/${path.replace(/^\/+/, '')}`
}

export const storageClient = {
  from(bucket: StorageBucket) {
    return {
      /** Upload a file, matching Supabase's `.upload(path, file, options)` shape. */
      async upload(
        path: string,
        file: File | Blob,
        _options?: { cacheControl?: string; upsert?: boolean }
      ): Promise<StorageResult<{ path: string }>> {
        try {
          const formData = new FormData()
          formData.append('bucket', bucket)
          formData.append('path', path)
          formData.append('file', file)

          const headers = await authHeaders()
          const res = await fetch(`${GO_API_URL}/storage/upload`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: formData,
          })

          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            return { data: null, error: new Error(body.error || `Upload failed (${res.status})`) }
          }

          const body = await res.json()
          return { data: { path: body.storagePath }, error: null }
        } catch (err: any) {
          return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
        }
      },

      /** Synchronous URL construction, matching Supabase's `.getPublicUrl(path)` shape. */
      getPublicUrl(path: string): { data: { publicUrl: string } } {
        return { data: { publicUrl: storageObjectUrl(bucket, path) } }
      },

      /** Delete one or more objects, matching Supabase's `.remove(paths)` shape. */
      async remove(paths: string[]): Promise<StorageResult<null>> {
        try {
          const headers = await authHeaders()
          for (const path of paths) {
            const res = await fetch(`${GO_API_URL}/storage/object`, {
              method: 'DELETE',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', ...headers },
              body: JSON.stringify({ bucket, path }),
            })
            if (!res.ok) {
              const body = await res.json().catch(() => ({}))
              return { data: null, error: new Error(body.error || `Delete failed (${res.status})`) }
            }
          }
          return { data: null, error: null }
        } catch (err: any) {
          return { data: null, error: err instanceof Error ? err : new Error(String(err)) }
        }
      },
    }
  },
}
