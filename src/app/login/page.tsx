"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { authClient } from '@/lib/better-auth-client'
import { getLastWorkspace } from '@/lib/utils'
import { workspacesClient } from '@/lib/api/workspaces-client'
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Use Better Auth for authentication
      const result = await authClient.signIn.email({
        email: formData.email,
        password: formData.password,
      })

      if (result.error) {
        throw new Error(result.error.message || 'Invalid email or password')
      }

      if (!result.data?.user) {
        throw new Error('Invalid email or password')
      }

      // Get user's workspaces to ensure we redirect to one they have access to
      const workspaces = await workspacesClient.list()
      
      if (workspaces && workspaces.length > 0) {
        const lastWorkspace = getLastWorkspace()
        const hasAccessToLast = lastWorkspace && workspaces.some(w => w.slug === lastWorkspace)
        
        if (hasAccessToLast) {
          // Use window.location for full page navigation to ensure cookies are set
          window.location.href = `/workspace/${lastWorkspace}`
        } else {
          window.location.href = `/workspace/${workspaces[0].slug}`
        }
      } else {
        window.location.href = '/'
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(err.message || 'Failed to sign in')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:bg-[#181818] dark:text-[#FAFAFA] flex">
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
              <span className="text-gray-900 dark:text-[#FAFAFA] font-bold text-2xl">Matic</span>
            </div>
          </div>

          {/* Login Card */}

          <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 p-8">
            {/* Editor-style heading and subheading */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-[#FAFAFA] mb-2">Matic</h1>
              <p className="text-gray-600 dark:text-[#FAFAFA]/80">Sign in to your account to continue</p>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-[#FAFAFA] mb-6">Sign In</h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-[#232323] border border-red-100 dark:border-red-400 rounded-xl">
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
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
                    className="w-full pl-11 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-[#232323] text-gray-900 dark:text-[#FAFAFA] placeholder-gray-400 dark:placeholder-gray-400"
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
                    className="w-full pl-11 pr-12 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white dark:bg-[#232323] text-gray-900 dark:text-[#FAFAFA] placeholder-gray-400 dark:placeholder-gray-400"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
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
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition">
              Sign up for free
            </Link>
          </p>

          {/* Support */}
          <p className="text-center text-xs text-gray-500 mt-4">
            Need help?{' '}
            <a href="mailto:support@maticsapp.com" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
