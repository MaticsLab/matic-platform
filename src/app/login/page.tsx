"use client"

import { useState, useEffect } from 'react'
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
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 })
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  // Mouse movement handler for interactive background
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      setMousePos({ x, y })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

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
    <div className="min-h-screen flex">
      {/* Left side - Animated Liquid Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Liquid Background Animation */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-700">
          {/* Animated liquid blobs */}
          <div className="absolute inset-0">
            {/* Main liquid blob 1 - responds to mouse */}
            <div 
              className="absolute w-96 h-96 rounded-full opacity-70 transition-transform duration-1000 ease-out"
              style={{
                background: 'linear-gradient(45deg, rgba(99, 102, 241, 0.8), rgba(168, 85, 247, 0.8))',
                filter: 'blur(60px)',
                animation: 'liquid1 20s ease-in-out infinite',
                top: `${20 + (mousePos.y - 50) * 0.1}%`,
                left: `${10 + (mousePos.x - 50) * 0.1}%`,
                transform: `translate(${(mousePos.x - 50) * 0.2}px, ${(mousePos.y - 50) * 0.2}px)`
              }}
            />
            
            {/* Main liquid blob 2 - responds to mouse inversely */}
            <div 
              className="absolute w-80 h-80 rounded-full opacity-60 transition-transform duration-700 ease-out"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(147, 51, 234, 0.9))',
                filter: 'blur(50px)',
                animation: 'liquid2 25s ease-in-out infinite reverse',
                top: `${50 + (mousePos.y - 50) * -0.15}%`,
                right: `${15 + (mousePos.x - 50) * -0.1}%`,
                transform: `translate(${(mousePos.x - 50) * -0.3}px, ${(mousePos.y - 50) * -0.1}px)`
              }}
            />
            
            {/* Secondary liquid blob 3 - responds to mouse with delay */}
            <div 
              className="absolute w-64 h-64 rounded-full opacity-50 transition-transform duration-1200 ease-out"
              style={{
                background: 'linear-gradient(225deg, rgba(139, 92, 246, 0.7), rgba(99, 102, 241, 0.7))',
                filter: 'blur(40px)',
                animation: 'liquid3 30s ease-in-out infinite',
                bottom: `${20 + (mousePos.y - 50) * 0.08}%`,
                left: `${20 + (mousePos.x - 50) * 0.05}%`,
                transform: `translate(${(mousePos.x - 50) * 0.15}px, ${(mousePos.y - 50) * -0.2}px)`
              }}
            />
            
            {/* Small floating blobs - mouse reactive */}
            <div 
              className="absolute w-32 h-32 rounded-full opacity-40 transition-transform duration-500 ease-out"
              style={{
                background: 'linear-gradient(45deg, rgba(236, 72, 153, 0.6), rgba(168, 85, 247, 0.6))',
                filter: 'blur(20px)',
                animation: 'float1 15s ease-in-out infinite',
                top: `${30 + (mousePos.y - 50) * 0.2}%`,
                right: `${30 + (mousePos.x - 50) * -0.2}%`,
                transform: `translate(${(mousePos.x - 50) * 0.4}px, ${(mousePos.y - 50) * 0.3}px)`
              }}
            />
            
            <div 
              className="absolute w-24 h-24 rounded-full opacity-30 transition-transform duration-800 ease-out"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(99, 102, 241, 0.8))',
                filter: 'blur(15px)',
                animation: 'float2 12s ease-in-out infinite reverse',
                bottom: `${40 + (mousePos.y - 50) * -0.1}%`,
                right: `${10 + (mousePos.x - 50) * 0.1}%`,
                transform: `translate(${(mousePos.x - 50) * -0.25}px, ${(mousePos.y - 50) * 0.4}px)`
              }}
            />
            
            {/* Additional mouse follower blob */}
            <div 
              className="absolute w-40 h-40 rounded-full opacity-20 transition-all duration-300 ease-out"
              style={{
                background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.3), rgba(99, 102, 241, 0.3))',
                filter: 'blur(30px)',
                top: `${mousePos.y - 10}%`,
                left: `${mousePos.x - 10}%`,
                transform: `translate(-50%, -50%)`
              }}
            />
          </div>
          
          {/* Overlay for better contrast */}
          <div className="absolute inset-0 bg-black/20" />
        </div>

        {/* Content overlay */}
        <div className="relative z-10 p-12 flex flex-col justify-center text-white">
          <div>
            <h1 className="text-6xl font-bold mb-6 leading-tight">
              Welcome back to <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                your workspace
              </span>
            </h1>
            <p className="text-white/80 text-xl max-w-lg leading-relaxed">
              Streamline your workflow with powerful data management, forms, and collaborative review processes.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-white rounded-3xl shadow-2xl shadow-indigo-500/10 p-8 border border-gray-100">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Sign in</h1>
              <p className="text-gray-500">Welcome back! Please enter your details.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 text-sm"
                    placeholder="Enter your email"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-14 py-4 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white text-gray-900 placeholder-gray-400 text-sm"
                    placeholder="Enter your password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex items-center justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
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
          <p className="text-center text-sm text-gray-600 mt-8">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
              Sign up for free
            </Link>
          </p>

          {/* Support */}
          <p className="text-center text-xs text-gray-500 mt-4">
            Need help?{' '}
            <a href="mailto:support@example.com" className="text-gray-600 hover:text-gray-800 transition-colors hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>

      {/* CSS for liquid animations */}
      <style jsx>{`
        @keyframes liquid1 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          25% { transform: translate(30px, -40px) rotate(90deg) scale(1.1); }
          50% { transform: translate(-20px, 20px) rotate(180deg) scale(0.9); }
          75% { transform: translate(-40px, -30px) rotate(270deg) scale(1.05); }
        }
        
        @keyframes liquid2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          33% { transform: translate(-50px, 30px) rotate(120deg) scale(1.15); }
          66% { transform: translate(40px, -25px) rotate(240deg) scale(0.85); }
        }
        
        @keyframes liquid3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          20% { transform: translate(25px, 35px) rotate(72deg) scale(1.2); }
          40% { transform: translate(-30px, -20px) rotate(144deg) scale(0.8); }
          60% { transform: translate(35px, -40px) rotate(216deg) scale(1.1); }
          80% { transform: translate(-25px, 30px) rotate(288deg) scale(0.9); }
        }
        
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
        
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-30px) rotate(-180deg); }
        }
      `}</style>
    </div>
  )
}
