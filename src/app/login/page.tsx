"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { authClient } from '@/lib/better-auth-client'
import { getLastWorkspace } from '@/lib/utils'
import { workspacesSupabase } from '@/lib/api/workspaces-supabase'
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authMethod, setAuthMethod] = useState<'auto' | 'supabase' | 'better-auth'>('auto')
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      let user = null
      let usedBetterAuth = false

      // Try Better Auth first (for new users)
      if (authMethod === 'auto' || authMethod === 'better-auth') {
        try {
          const { data, error: betterAuthError } = await authClient.signIn.email({
            email: formData.email,
            password: formData.password,
          })

          if (!betterAuthError && data?.user) {
            user = data.user
            usedBetterAuth = true
            console.log('Logged in with Better Auth')
          }
        } catch (err) {
          console.log('Better Auth login failed, trying Supabase...', err)
        }
      }

      // Fall back to Supabase (for legacy users)
      if (!user && (authMethod === 'auto' || authMethod === 'supabase')) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })

        if (signInError) throw signInError
        if (!data.user) throw new Error('Login failed')
        
        user = data.user
        console.log('Logged in with Supabase')
      }

      if (!user) {
        throw new Error('Invalid email or password')
      }

      // Get user's workspaces to ensure we redirect to one they have access to
      // For Supabase users, use existing method
      if (!usedBetterAuth) {
        const workspaces = await workspacesSupabase.getWorkspacesForUser(user.id)
        
        if (workspaces && workspaces.length > 0) {
          const lastWorkspace = getLastWorkspace()
          const hasAccessToLast = lastWorkspace && workspaces.some(w => w.slug === lastWorkspace)
          
          if (hasAccessToLast) {
            router.push(`/workspace/${lastWorkspace}`)
          } else {
            router.push(`/workspace/${workspaces[0].slug}`)
          }
        } else {
          router.push('/')
        }
      } else {
        // For Better Auth users, redirect based on last workspace or home
        const lastWorkspace = getLastWorkspace()
        if (lastWorkspace) {
          router.push(`/workspace/${lastWorkspace}`)
        } else {
          router.push('/')
        }
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-700 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">M</span>
            </div>
            <span className="text-white font-bold text-2xl">Matic</span>
          </div>
        </div>
        
        <div className="relative">
          <h1 className="text-4xl font-bold text-white mb-4">
            Streamline your workflow
          </h1>
          <p className="text-blue-100 text-lg max-w-md">
            Manage applications, reviews, and data all in one powerful platform designed for modern teams.
          </p>
        </div>
        
        <div className="relative text-blue-200 text-sm">
          © {new Date().getFullYear()} Matic. All rights reserved.
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <span className="text-gray-900 font-bold text-2xl">Matic</span>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
              <p className="text-gray-600">Sign in to your account to continue</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-11 pr-12 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex items-center justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-blue-600/25"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>

          {/* Sign Up Link */}
          <p className="text-center text-sm text-gray-600 mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium transition">
              Sign up for free
            </Link>
          </p>

          {/* Support */}
          <p className="text-center text-xs text-gray-500 mt-4">
            Need help?{' '}
            <a href="mailto:support@maticsapp.com" className="text-gray-600 hover:text-gray-900 transition">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
