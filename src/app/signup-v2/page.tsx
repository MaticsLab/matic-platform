'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn, signUp, useSession } from '@/lib/better-auth-client'
import { AuthPageRenderer } from '@/components/Portal/AuthPageRenderer'
import { PortalConfig } from '@/types/portal'
import { toast } from 'sonner'

function SignupV2PageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, isPending } = useSession()
  
  // Get mode from URL params (login or signup)
  const mode = (searchParams.get('mode') === 'login' ? 'login' : 'signup') as 'login' | 'signup'
  const [currentMode, setCurrentMode] = useState<'login' | 'signup'>(mode)
  
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupData, setSignupData] = useState<Record<string, any>>({
    name: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isMagicLinkLoading, setIsMagicLinkLoading] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
    if (session && !isPending) {
      const redirect = searchParams.get('redirect') || '/dashboard'
      router.replace(redirect)
    }
  }, [session, isPending, router, searchParams])

  // Pre-fill email from URL params
  useEffect(() => {
    const urlEmail = searchParams.get('email')
    if (urlEmail) {
      setEmail(urlEmail)
    }
  }, [searchParams])

  // Update mode when URL changes
  useEffect(() => {
    setCurrentMode(searchParams.get('mode') === 'login' ? 'login' : 'signup')
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }

    setIsLoading(true)
    
    try {
      if (currentMode === 'signup') {
        // Handle signup
        const result = await signUp.email({
          email: email.trim(),
          password: password || '',
          name: signupData.name || email.split('@')[0]
        })

        if (result.error) {
          toast.error(result.error.message || 'Failed to sign up')
          return
        }

        // If no password was provided, they'll get a magic link
        if (!password) {
          toast.success('Check your email for a signup link!')
          return
        }

        // If password was provided, they're signed up and in
        toast.success('Account created successfully!')
        const redirect = searchParams.get('redirect') || '/dashboard'
        router.replace(redirect)
        
      } else {
        // Handle login
        const result = await signIn.email({
          email: email.trim(),
          password: password || ''
        })

        if (result.error) {
          toast.error(result.error.message || 'Failed to sign in')
          return
        }

        // If no password was provided, they'll get a magic link
        if (!password) {
          toast.success('Check your email for a login link!')
          return
        }

        // If password was provided, they're logged in
        toast.success('Signed in successfully!')
        const redirect = searchParams.get('redirect') || '/dashboard'
        router.replace(redirect)
      }
    } catch (error) {
      console.error('Auth error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMagicLink = async (email: string) => {
    if (!email.trim()) {
      toast.error('Email is required')
      return
    }

    setIsMagicLinkLoading(true)

    try {
      if (currentMode === 'signup') {
        // Magic link signup
        const result = await signUp.email({
          email: email.trim(),
          name: signupData.name || email.split('@')[0],
          password: '' // Empty password for magic link flow
        })

        if (result.error) {
          toast.error(result.error.message || 'Failed to send signup link')
          return
        }

        toast.success('Check your email for a signup link!')
      } else {
        // Magic link login
        const result = await signIn.email({
          email: email.trim(),
          password: '' // Empty password for magic link flow
        })

        if (result.error) {
          toast.error(result.error.message || 'Failed to send login link')
          return
        }

        toast.success('Check your email for a login link!')
      }
    } catch (error) {
      console.error('Magic link error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsMagicLinkLoading(false)
    }
  }

  const handleToggleMode = () => {
    const newMode = currentMode === 'login' ? 'signup' : 'login'
    const currentParams = new URLSearchParams(searchParams.toString())
    
    if (newMode === 'signup') {
      currentParams.delete('mode')
    } else {
      currentParams.set('mode', 'login')
    }
    
    router.replace(`/signup-v2?${currentParams.toString()}`)
  }

  // Basic portal config for styling
  const config: PortalConfig = {
    sections: [], // Empty sections array since this is just for auth styling
    settings: {
      name: 'Matic Platform',
      themeColor: '#3B82F6',
      logoUrl: '',
      signupPage: {
        title: currentMode === 'signup' ? 'Create your account' : 'Welcome back',
        description: currentMode === 'signup' 
          ? 'Get started with your workspace today' 
          : 'Sign in to continue to your workspace'
      },
      loginPage: {
        title: 'Welcome back',
        description: 'Sign in to continue to your workspace'
      },
      signupFields: [
        {
          id: 's1',
          label: 'Full Name',
          type: 'text',
          required: true,
          width: 'full'
        },
        {
          id: 's2',
          label: 'Email',
          type: 'email',
          required: true,
          width: 'full'
        },
        {
          id: 's3',
          label: 'Password',
          type: 'password',
          required: false,
          width: 'full'
        }
      ],
      loginFields: [
        {
          id: 'l1',
          label: 'Email',
          type: 'email',
          required: true,
          width: 'full'
        },
        {
          id: 'l2',
          label: 'Password',
          type: 'password',
          required: false,
          width: 'full'
        }
      ]
    }
  }

  // Show loading while checking session
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Don't render if already authenticated (will redirect)
  if (session) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthPageRenderer
        type={currentMode}
        config={config}
        email={email}
        password={password}
        signupData={signupData}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSignupDataChange={setSignupData}
        onSubmit={handleSubmit}
        onMagicLink={handleMagicLink}
        isLoading={isLoading || isMagicLinkLoading}
        onToggleMode={handleToggleMode}
      />
    </div>
  )
}

export default function SignupV2Page() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <SignupV2PageContent />
    </Suspense>
  )
}