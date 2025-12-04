"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Loader2, Lock, CheckCircle, AlertCircle } from 'lucide-react'

function SetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  useEffect(() => {
    async function verifyToken() {
      if (!tokenHash || !type) {
        setError('Invalid or missing invitation token')
        setIsVerifying(false)
        return
      }

      try {
        // Verify the OTP token to establish a session
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'invite' | 'signup' | 'recovery' | 'email',
        })

        if (verifyError) {
          console.error('Token verification error:', verifyError)
          setError(verifyError.message)
        }
      } catch (err) {
        console.error('Token verification failed:', err)
        setError('Failed to verify invitation token')
      } finally {
        setIsVerifying(false)
      }
    }

    verifyToken()
  }, [tokenHash, type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        throw updateError
      }

      setSuccess(true)
      
      // Redirect to workspaces after a short delay
      setTimeout(() => {
        router.push('/workspaces')
      }, 2000)
    } catch (err: unknown) {
      console.error('Password update error:', err)
      setError(err instanceof Error ? err.message : 'Failed to set password')
    } finally {
      setIsLoading(false)
    }
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifying your invitation...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Set Successfully!</h1>
            <p className="text-gray-600 mb-4">
              Your account is now ready. Redirecting you to your workspaces...
            </p>
            <Loader2 className="w-5 h-5 animate-spin text-blue-600 mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Set Your Password</h1>
            <p className="text-gray-600 mt-2">
              Create a password to complete your account setup
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-red-800">{error}</p>
                {error.includes('expired') && (
                  <p className="text-sm text-red-600 mt-1">
                    Please request a new invitation from your workspace administrator.
                  </p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                minLength={6}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !!error}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Setting Password...
                </>
              ) : (
                'Set Password & Continue'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <SetPasswordForm />
    </Suspense>
  )
}
