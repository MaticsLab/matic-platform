'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { signIn, signUp } from '@/lib/better-auth-client'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

// Custom CSS for animations
const animatedStyles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fade-in {
    animation: fadeIn 0.6s ease-out forwards;
    opacity: 0;
  }
  
  .animate-fade-in-delay-1 {
    animation: fadeIn 0.6s ease-out 0.1s forwards;
    opacity: 0;
  }
  
  .animate-fade-in-delay-2 {
    animation: fadeIn 0.6s ease-out 0.2s forwards;
    opacity: 0;
  }
  
  .animate-fade-in-delay-3 {
    animation: fadeIn 0.6s ease-out 0.3s forwards;
    opacity: 0;
  }
  
  .animate-fade-in-delay-4 {
    animation: fadeIn 0.6s ease-out 0.4s forwards;
    opacity: 0;
  }
  
  .animate-fade-in-delay-5 {
    animation: fadeIn 0.6s ease-out 0.5s forwards;
    opacity: 0;
  }
  
  .animate-fade-in-delay-6 {
    animation: fadeIn 0.6s ease-out 0.6s forwards;
    opacity: 0;
  }
`

function AuthPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const mode = searchParams.get('mode')
    setIsLogin(mode === 'login')
  }, [searchParams])

  const handleModeToggle = (loginMode: boolean) => {
    setIsLogin(loginMode)
    const newMode = loginMode ? 'login' : 'signup'
    router.push(`/auth?mode=${newMode}`)
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn.social({
        provider: 'google',
        callbackURL: '/'
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
          callbackURL: '/'
        })
        toast.success('Welcome back!')
      } else {
        await signUp.email({
          email,
          name: name || email.split('@')[0], // Use email username as fallback
          password: password || 'temp-password',
          callbackURL: '/'
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
    <>
      <style dangerouslySetInnerHTML={{ __html: animatedStyles }} />
      <div className="min-h-screen relative">
        {/* Logo in top left corner */}
        <div className="absolute top-6 left-6 z-10">
          <Link href="/" className="text-2xl font-black text-gray-900">
            MaticsApp
          </Link>
        </div>
        
        <div className="grid lg:grid-cols-2 min-h-screen">
          {/* Left Side - Sign Up Form */}
          <div className="flex items-center justify-center p-8 bg-white">
            <div className="w-full max-w-md space-y-8">
              {/* Auth Form */}
              <div className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    {isLogin ? 'Welcome back' : 'Get started'}
                  </h1>
                  <p className="mt-2 text-sm text-gray-600">
                    {isLogin ? (
                      <>
                        Don't have an account?{' '}
                        <button 
                          type="button"
                          onClick={() => handleModeToggle(false)}
                          className="text-blue-600 hover:text-blue-500 underline font-medium"
                        >
                          Sign up
                        </button>
                      </>
                    ) : (
                      <>
                        Already have an account?{' '}
                        <button 
                          type="button"
                          onClick={() => handleModeToggle(true)}
                          className="text-blue-600 hover:text-blue-500 underline font-medium"
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
                    className="w-full h-12 text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="#4285f4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34a853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#fbbc05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#ea4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    {isLogin ? 'Log in' : 'Sign up'} with Google
                  </Button>

                  <Button
                    disabled={isLoading}
                    variant="outline"
                    className="w-full h-12 text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition-colors"
                  >
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="#00a1f1">
                      <path d="M0 0h11.377v11.372H0zm12.623 0H24v11.372H12.623zM0 12.623h11.377V24H0zm12.623 0H24V24H12.623z"/>
                    </svg>
                    {isLogin ? 'Log in' : 'Sign up'} with Microsoft
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
                  {!isLogin && (
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                        Full Name
                      </label>
                      <Input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}
                  
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
                      className="w-full h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
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
                        className="w-full h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        required
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || !email || (isLogin && !password)}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
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
                    Use single sign-on (SSO)
                  </Link>
                </div>

                {/* Terms and Privacy */}
                <div className="text-xs text-gray-500 text-center">
                  By using MaticsApp, you agree to our{' '}
                  <Link href="/privacy" className="underline hover:text-gray-700">
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link href="/terms" className="underline hover:text-gray-700">
                    Terms of Service
                  </Link>
                  .
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - App Preview */}
          <div className="relative overflow-hidden bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500">
            {/* Background decorative elements */}
            <div className="absolute inset-0">
              <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse"></div>
              <div className="absolute bottom-32 right-16 w-24 h-24 bg-white/15 rounded-full blur-lg animate-pulse" style={{animationDelay: '1s'}}></div>
              <div className="absolute top-1/2 left-10 w-16 h-16 bg-white/20 rounded-full blur-md animate-pulse" style={{animationDelay: '2s'}}></div>
              <div className="absolute top-1/4 right-1/4 w-20 h-20 bg-white/10 rounded-full blur-lg animate-bounce" style={{animationDelay: '0.5s', animationDuration: '3s'}}></div>
            </div>
            
            <div className="relative flex items-center justify-center p-12 h-full">
              <div className="max-w-lg w-full animate-fade-in">
                {/* Main app preview container */}
                <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-2xl">
                  {/* Browser chrome */}
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                    <div className="flex gap-1">
                      <div className="w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
                      <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-600 flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-300 rounded-sm"></div>
                        maticsapp.com/workspace
                      </div>
                    </div>
                  </div>

                  {/* App interface */}
                  <div className="space-y-4">
                    {/* Tabs */}
                    <div className="flex gap-1">
                      <div className="px-3 py-1 bg-blue-500 text-white text-xs rounded font-medium">Dashboard</div>
                      <div className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded">Forms</div>
                      <div className="px-3 py-1 bg-gray-200 text-gray-600 text-xs rounded">Database</div>
                    </div>

                    {/* Content rows with staggered animations */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 animate-fade-in-delay-1">
                        <div className="w-8 h-8 bg-yellow-400 rounded flex items-center justify-center">
                          <span className="text-sm">📝</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
                          <div className="h-2 bg-gray-100 rounded w-3/4"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 animate-fade-in-delay-2">
                        <div className="w-8 h-8 bg-blue-400 rounded flex items-center justify-center">
                          <span className="text-sm">👥</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-200 rounded animate-pulse" style={{animationDelay: '0.1s'}}></div>
                          <div className="h-2 bg-gray-100 rounded w-2/3"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 animate-fade-in-delay-3">
                        <div className="w-8 h-8 bg-green-400 rounded flex items-center justify-center">
                          <span className="text-sm">⚡</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-200 rounded animate-pulse" style={{animationDelay: '0.2s'}}></div>
                          <div className="h-2 bg-gray-100 rounded w-4/5"></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 animate-fade-in-delay-4">
                        <div className="w-8 h-8 bg-purple-400 rounded flex items-center justify-center">
                          <span className="text-sm">📊</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="h-3 bg-gray-200 rounded animate-pulse" style={{animationDelay: '0.3s'}}></div>
                          <div className="h-2 bg-gray-100 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>

                    {/* Stats panel */}
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg animate-fade-in-delay-5">
                      <div className="space-y-3">
                        <div className="h-4 bg-white rounded shadow-sm"></div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="h-8 bg-green-100 rounded"></div>
                          <div className="h-8 bg-orange-100 rounded"></div>
                          <div className="h-8 bg-blue-100 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}