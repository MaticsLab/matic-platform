"use client"

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Listen for auth state changes - this handles the token exchange automatically
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.email)
      
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked password recovery link - redirect to reset page
        router.push('/auth/reset-password')
        return
      }
      
      if (event === 'SIGNED_IN' && session) {
        // Check if this was a recovery flow by looking at URL params
        const type = searchParams.get('type')
        if (type === 'recovery') {
          router.push('/auth/reset-password')
          return
        }
        
        // Normal sign in - redirect to home
        const next = searchParams.get('next')
        router.push(next || '/')
        return
      }
    })

    // Also handle errors and tokens passed in URL
    const handleUrlParams = async () => {
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')
      
      if (errorParam) {
        setError(errorDescription || errorParam)
        setTimeout(() => router.push('/login'), 2000)
        return
      }

      // Check URL hash for tokens (implicit flow)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const hashError = hashParams.get('error')
      const hashErrorDescription = hashParams.get('error_description')
      
      if (hashError) {
        setError(hashErrorDescription || hashError)
        setTimeout(() => router.push('/login'), 2000)
        return
      }

      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const type = hashParams.get('type')

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (sessionError) {
          setError(sessionError.message)
          setTimeout(() => router.push('/login'), 2000)
          return
        }

        if (type === 'recovery') {
          router.push('/auth/reset-password')
          return
        }
      }

      // Handle PKCE code exchange
      const code = searchParams.get('code')
      if (code) {
        try {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) {
            throw exchangeError
          }
          // Auth state change listener will handle the redirect
        } catch (err: any) {
          setError(err.message || 'Failed to complete authentication')
          setTimeout(() => router.push('/login'), 2000)
        }
        return
      }

      // If no tokens, codes, or errors - check for existing session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const next = searchParams.get('next')
        router.push(next || '/')
      } else {
        // Give it a moment for auth state to settle
        setTimeout(async () => {
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (retrySession) {
            router.push('/')
          } else {
            router.push('/login')
          }
        }, 1000)
      }
    }

    handleUrlParams()

    return () => {
      subscription.unsubscribe()
    }
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
