'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { signIn, signUp } from '@/lib/better-auth-client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function AuthPage() {
  const searchParams = useSearchParams()
  const [isLogin, setIsLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const mode = searchParams.get('mode')
    setIsLogin(mode === 'login')
  }, [searchParams])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: '/workspaces'
      })
    } catch (error) {
      toast.error('Failed to sign in with Google')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    try {
      if (isLogin) {
        if (!password) {
          toast.error('Password is required')
          setIsLoading(false)
          return
        }
        await signIn.email({
          email,
          password,
          callbackURL: '/workspaces'
        })
        toast.success('Welcome back!')
      } else {
        await signUp.email({
          email,
          name: email.split('@')[0], // Use email prefix as default name
          password: password || 'temp-password', // This will be handled by email verification
          callbackURL: '/workspaces'
        })
        toast.success('Check your email to continue')
      }
    } catch (error) {
      toast.error(isLogin ? 'Failed to sign in' : 'Failed to sign up')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative">
      {/* Logo in top left corner */}
      <div className="absolute top-6 left-6 z-10">
        <Link href="/" className="text-2xl font-black text-gray-900">
          MaticsApp
        </Link>
      </div>
      
      <div className="flex min-h-screen">
        {/* Left Side - Sign Up Form */}
        <div className="flex-1 flex items-center justify-center p-8 bg-white">
          <div className="w-full max-w-md space-y-8">

          {/* Auth Form */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {isLogin ? 'Log in' : 'Sign up'}
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {isLogin ? (
                  <>
                    Don't have an account?{' '}
                    <button 
                      type="button"
                      onClick={() => setIsLogin(false)}
                      className="text-blue-600 hover:text-blue-500 underline"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button 
                      type="button"
                      onClick={() => setIsLogin(true)}
                      className="text-blue-600 hover:text-blue-500 underline"
                    >
                      Log in
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* Social Auth Buttons */}
            <div className="space-y-3">
              <Button
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {isLogin ? 'Log in' : 'Sign up'} with Google
              </Button>

              <Button
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M11.4 24H12.6V0H11.4V24ZM20.1 24H21.6V8.4L20.1 8.4V24ZM2.4 24H3.9V8.4H2.4V24ZM8.7 18.3C8.7 17.1 9.6 16.2 10.8 16.2S12.9 17.1 12.9 18.3S12 20.4 10.8 20.4S8.7 19.5 8.7 18.3ZM8.7 5.7C8.7 4.5 9.6 3.6 10.8 3.6S12.9 4.5 12.9 5.7S12 7.8 10.8 7.8S8.7 6.9 8.7 5.7Z"
                  />
                </svg>
                Sign up with Microsoft
              </Button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or</span>
              </div>
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full h-12"
                  required
                />
              </div>

              {isLogin && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-12"
                    required
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || !email || (isLogin && !password)}
                className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isLogin ? 'Logging in...' : 'Creating account...'}
                  </>
                ) : (
                  isLogin ? 'Log in with email' : 'Sign up with email'
                )}
              </Button>
            </form>

            {/* SSO Link */}
            <div className="text-center">
              <Link href="/sso" className="text-sm text-gray-500 hover:text-gray-700 underline">
                Use single sign-on
              </Link>
            </div>

            {/* Terms and Privacy */}
            <div className="text-xs text-gray-500">
              By using MaticsApp, you are agreeing to our{' '}
              <Link href="/privacy" className="underline hover:text-gray-700">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/terms" className="underline hover:text-gray-700">
                Terms
              </Link>
              .
            </div>
          </div>
        </div>
      </div>

        {/* Right Side - App Preview */}
        <div className="hidden lg:flex flex-1 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-cyan-400 to-teal-400">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-20">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100" height="100" fill="url(#grid)" />
              </svg>
            </div>
            
            {/* Enhanced Decorative Elements with Animation */}
            <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse" />
            <div className="absolute bottom-32 right-16 w-24 h-24 bg-white/15 rounded-full blur-lg animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-10 w-16 h-16 bg-white/20 rounded-full blur-md animate-pulse" style={{ animationDelay: '2s' }} />
            
            {/* Additional floating elements for more engagement */}
            <div className="absolute top-1/4 right-1/4 w-20 h-20 bg-white/10 rounded-full blur-lg animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '3s' }} />
            <div className="absolute bottom-1/4 left-1/3 w-12 h-12 bg-white/15 rounded-full blur-md animate-bounce" style={{ animationDelay: '1.5s', animationDuration: '2.5s' }} />
          </div>
          
          <div className="relative flex items-center justify-center p-12 w-full">
            <div className="max-w-2xl w-full">
              {/* App Preview with enhanced animations */}
              <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl transform hover:scale-105 transition-transform duration-300 animate-fade-in">
                {/* Browser Header */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                  <div className="flex gap-1">
                    <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse" />
                    <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="bg-gray-100 rounded-full px-3 py-1">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <div className="w-3 h-3 bg-gray-300 rounded-sm" />
                        <span>maticsapp.com/forms/survey</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* App Interface with staggered animations */}
                <div className="space-y-4">
                  {/* Navigation Tabs */}
                  <div className="flex gap-1 mb-4">
                    <div className="px-3 py-1 bg-blue-500 text-white text-xs rounded transform hover:scale-105 transition-transform">App</div>
                    <div className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded transform hover:scale-105 transition-transform">Forms</div>
                    <div className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded transform hover:scale-105 transition-transform">Database</div>
                  </div>

                  {/* Form Builder Interface with staggered fade-in */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                      <div className="w-6 h-6 bg-yellow-400 rounded flex items-center justify-center transform hover:rotate-12 transition-transform">
                        <span className="text-xs">📝</span>
                      </div>
                      <div className="flex-1 h-3 bg-gray-200 rounded animate-pulse" />
                    </div>
                    
                    <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                      <div className="w-6 h-6 bg-blue-400 rounded flex items-center justify-center transform hover:rotate-12 transition-transform">
                        <span className="text-xs">👤</span>
                      </div>
                      <div className="flex-1 h-3 bg-gray-200 rounded animate-pulse" style={{ animationDelay: '0.1s' }} />
                    </div>
                    
                    <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                      <div className="w-6 h-6 bg-green-400 rounded flex items-center justify-center transform hover:rotate-12 transition-transform">
                        <span className="text-xs">⚡</span>
                      </div>
                      <div className="flex-1 h-3 bg-gray-200 rounded animate-pulse" style={{ animationDelay: '0.2s' }} />
                    </div>
                    
                    <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.4s' }}>
                      <div className="w-6 h-6 bg-purple-400 rounded flex items-center justify-center transform hover:rotate-12 transition-transform">
                        <span className="text-xs">📊</span>
                      </div>
                      <div className="flex-1 h-3 bg-gray-200 rounded animate-pulse" style={{ animationDelay: '0.3s' }} />
                    </div>
                    
                    <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.5s' }}>
                      <div className="w-6 h-6 bg-pink-400 rounded flex items-center justify-center transform hover:rotate-12 transition-transform">
                        <span className="text-xs">📧</span>
                      </div>
                      <div className="flex-1 h-3 bg-gray-200 rounded animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                    
                    <div className="flex items-center gap-3 animate-fade-in" style={{ animationDelay: '0.6s' }}>
                      <div className="w-6 h-6 bg-orange-400 rounded flex items-center justify-center transform hover:rotate-12 transition-transform">
                        <span className="text-xs">🔗</span>
                      </div>
                      <div className="flex-1 h-3 bg-gray-200 rounded animate-pulse" style={{ animationDelay: '0.5s' }} />
                    </div>
                  </div>

                  {/* Right Panel Preview with hover effects */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg transform hover:bg-gray-100 transition-colors animate-fade-in" style={{ animationDelay: '0.7s' }}>
                    <div className="space-y-3">
                      <div className="h-4 bg-white rounded shadow-sm animate-pulse" />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-8 bg-green-100 rounded transform hover:scale-105 transition-transform" />
                        <div className="h-8 bg-orange-100 rounded transform hover:scale-105 transition-transform" />
                      </div>
                      <div className="h-6 bg-yellow-100 rounded transform hover:scale-105 transition-transform" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}