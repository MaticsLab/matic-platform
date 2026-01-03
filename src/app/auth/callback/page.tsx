"use client"

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/better-auth-client'
import { Loader2 } from 'lucide-react'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Better Auth handles OAuth callbacks automatically via /api/auth/[...all]
        // Check for errors in URL params
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')
        
        if (errorParam) {
          setError(errorDescription || errorParam)
          setTimeout(() => router.push('/login'), 2000)
          return
        }

        // Check if we have a session (Better Auth sets cookies automatically)
        const session = await authClient.getSession()
        
        if (session?.data?.session) {
          // Successfully authenticated
          const next = searchParams.get('next')
          router.push(next || '/')
        } else {
          // Wait a moment for cookies to be set
          setTimeout(async () => {
            const retrySession = await authClient.getSession()
            if (retrySession?.data?.session) {
              router.push('/')
            } else {
              router.push('/login')
            }
          }, 1000)
        }
      } catch (err: any) {
        console.error('Auth callback error:', err)
        setError(err.message || 'Failed to complete authentication')
        setTimeout(() => router.push('/login'), 2000)
      }
    }

    handleCallback()
  }, [router, searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-gray-900 font-medium mb-2">Authentication error</p>
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-gray-500 mt-4">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
}
