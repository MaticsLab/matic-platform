'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Mail, Lock, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { ApplicationForm, EMPTY_APPLICATION_STATE } from './ApplicationForm'
import { Form } from '@/types/forms'

interface PublicPortalProps {
  slug: string
  subdomain?: string
}

export function PublicPortal({ slug, subdomain }: PublicPortalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isFormLoading, setIsFormLoading] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [initialData, setInitialData] = useState<any>(null)

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
        
        // If subdomain is provided, use subdomain+slug lookup
        // Otherwise, try by slug (which handles both UUID and custom_slug)
        const endpoint = subdomain 
          ? `${baseUrl}/forms/by-subdomain/${subdomain}/${slug}`
          : `${baseUrl}/forms/by-slug/${slug}`
        
        const response = await fetch(endpoint)
        if (response.ok) {
          const data = await response.json()
          setForm(data)
        }
      } catch (error) {
        console.error('Failed to fetch form:', error)
      } finally {
        setIsFormLoading(false)
      }
    }
    fetchForm()
  }, [slug, subdomain])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Fetch existing submission
    if (form?.id) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
        console.log('Fetching submission for:', form.id, email)
        const res = await fetch(`${baseUrl}/forms/${form.id}/submission?email=${encodeURIComponent(email)}`)
        if (res.ok) {
          const data = await res.json()
          console.log('Submission data received:', data)
          setInitialData(data)
        } else {
          console.log('No submission found or error:', res.status)
        }
      } catch (err) {
        console.error("Failed to fetch submission", err)
      }
    }

    // Simulate auth delay
    setTimeout(() => {
      setIsLoading(false)
      setIsAuthenticated(true)
    }, 1000)
  }

  if (isSubmitted) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="min-h-screen bg-white flex flex-col items-center justify-center p-4 text-center"
      >
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Application Submitted!</h1>
        <p className="text-gray-500 max-w-md mb-8">
          Thank you for applying. We have received your application and will review it shortly. You will receive a confirmation email at {email}.
        </p>
        <Button onClick={() => window.location.reload()}>
          Return to Home
        </Button>
      </motion.div>
    )
  }

  if (isAuthenticated) {
    return (
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="min-h-screen bg-white"
      >
        <ApplicationForm 
          onBack={() => {}} // No-op for external
          onSave={() => setIsSubmitted(true)}
          isExternal={true}
          formDefinition={form}
          userEmail={email}
          initialData={initialData || {
            ...EMPTY_APPLICATION_STATE,
            personal: {
              ...EMPTY_APPLICATION_STATE.personal,
              personalEmail: email
            }
          }}
        />
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center p-4 font-sans text-gray-900">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Notion-like Header */}
        <div className="mb-8 text-center space-y-4">
          <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-gray-200 mx-auto flex items-center justify-center text-3xl">
            🎓
          </div>
          {isFormLoading ? (
            <div className="h-10 bg-gray-200 rounded-lg w-3/4 mx-auto animate-pulse" />
          ) : (
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              {form?.name || slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </h1>
          )}
          {isFormLoading ? (
            <div className="h-6 bg-gray-200 rounded-lg w-1/2 mx-auto animate-pulse" />
          ) : (
            <p className="text-gray-500 text-lg">
              {form?.description || (isLogin ? 'Please log in to continue your application.' : 'Please sign up to continue your application.')}
            </p>
          )}
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@example.com" 
                  className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors"
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-10 text-base font-medium bg-gray-900 hover:bg-gray-800 text-white transition-all"
              disabled={isLoading || isFormLoading}
            >
              {isLoading ? (
                <motion.div 
                  animate={{ rotate: 360 }} 
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <span className="flex items-center gap-2">
                  {isLogin ? 'Log In' : 'Create Account'} 
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-400">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="w-full" type="button">
              Google
            </Button>
            <Button variant="outline" className="w-full" type="button">
              Microsoft
            </Button>
          </div>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium text-gray-900 hover:underline underline-offset-4"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </motion.div>
      
      <div className="mt-12 flex items-center gap-2 text-sm text-gray-400">
        <Sparkles className="w-4 h-4" />
        <span>Powered by Matic Platform</span>
      </div>
    </div>
  )
}
