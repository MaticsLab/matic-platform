'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Mail, Lock, Sparkles, CheckCircle2, Languages } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Label } from '@/ui-components/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { ApplicationForm, EMPTY_APPLICATION_STATE } from './ApplicationForm'
import { Form } from '@/types/forms'
import { Field } from '@/types/portal'
import { cn } from '@/lib/utils'
import { applyTranslationsToConfig } from '@/lib/portal-translations'
import { portalAuthClient } from '@/lib/api/portal-auth-client'
import { toast } from 'sonner'

interface PublicPortalProps {
  slug: string
  subdomain?: string
}

export function PublicPortal({ slug, subdomain }: PublicPortalProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [email, setEmail] = useState('')
  const [signupData, setSignupData] = useState<Record<string, any>>({})
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isFormLoading, setIsFormLoading] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [initialData, setInitialData] = useState<any>(null)

  // Language support
  const defaultLanguage = form?.settings?.language?.default || 'en'
  const supportedLanguages = useMemo(() => {
    if (!form?.settings?.language?.enabled) return []
    return Array.from(new Set([defaultLanguage, ...(form.settings.language?.supported || [])]))
  }, [form, defaultLanguage])
  const [activeLanguage, setActiveLanguage] = useState<string>(defaultLanguage)

  // Apply translations to form config
  const translatedForm = useMemo(() => {
    if (!form || !form.settings?.language?.enabled || activeLanguage === defaultLanguage) {
      return form
    }
    // Apply translations to the form's settings and fields
    // translations are stored in form.settings.translations or as a top-level property
    const translations = (form.settings as any).translations || (form as any).translations || {}
    const translated = applyTranslationsToConfig(
      { sections: [], settings: form.settings, translations },
      activeLanguage
    )
    return {
      ...form,
      name: translated.settings.name || form.name,
      description: form.description, // Keep original or translate if needed
      settings: {
        ...form.settings,
        signupFields: translated.settings.signupFields || form.settings.signupFields
      }
    }
  }, [form, activeLanguage, defaultLanguage])

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
    if (!form?.id) return
    
    setIsLoading(true)

    try {
      if (isLogin) {
        // Login with existing account
        const applicant = await portalAuthClient.login({
          form_id: form.id,
          email,
          password
        })

        // Fetch existing submission if available
        if (applicant.submission_data) {
          setInitialData(applicant.submission_data)
        } else {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_GO_API_URL || 'http://localhost:8080/api/v1'
            const res = await fetch(`${baseUrl}/forms/${form.id}/submission?email=${encodeURIComponent(email)}`)
            if (res.ok) {
              const data = await res.json()
              setInitialData(data)
            }
          } catch (err) {
            console.error("Failed to fetch submission", err)
          }
        }

        setIsAuthenticated(true)
        toast.success('Logged in successfully')
      } else {
        // Sign up new account
        const applicant = await portalAuthClient.signup({
          form_id: form.id,
          email,
          password,
          full_name: signupData.name || '',
          data: signupData
        })

        setIsAuthenticated(true)
        toast.success('Account created successfully')
      }
    } catch (error: any) {
      console.error('Authentication error:', error)
      toast.error(error.message || 'Authentication failed')
    } finally {
      setIsLoading(false)
    }
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
      {/* Language Selector - Top Right */}
      {form?.settings?.language?.enabled && supportedLanguages.length > 1 && (
        <div className="fixed top-4 right-4 z-50">
          <Select value={activeLanguage} onValueChange={setActiveLanguage}>
            <SelectTrigger className="w-32 h-9 text-sm bg-white/90 backdrop-blur-sm">
              <Languages className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedLanguages.map(lang => (
                <SelectItem key={lang} value={lang}>{lang.toUpperCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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
              {translatedForm?.name || 'Application Portal'}
            </h1>
          )}
          {isFormLoading ? (
            <div className="h-6 bg-gray-200 rounded-lg w-1/2 mx-auto animate-pulse" />
          ) : (
            <p className="text-gray-500 text-lg">
              {translatedForm?.description || (isLogin ? 'Please log in to continue your application.' : 'Please sign up to continue your application.')}
            </p>
          )}
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
          <form onSubmit={handleAuth} className="space-y-4">
            {/* Render login fields (always email + password) */}
            {isLogin ? (
              <>
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
              </>
            ) : (
              /* Render signup fields from portal config */
              (translatedForm?.settings?.signupFields || []).map((field: Field) => (
                <div key={field.id} className="space-y-2">
                  <Label className="text-base font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {field.placeholder && (
                    <p className="text-sm text-gray-500 -mt-1">{field.placeholder}</p>
                  )}
                  
                  {/* Email field */}
                  {field.type === 'email' && (
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input 
                        type="email" 
                        className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-11"
                        value={signupData[field.id] || ''}
                        onChange={e => {
                          setSignupData(prev => ({ ...prev, [field.id]: e.target.value }))
                          setEmail(e.target.value)
                        }}
                        required={field.required}
                      />
                    </div>
                  )}
                  
                  {/* Password field (shown as text type with "password" in label) */}
                  {field.type === 'text' && field.label.toLowerCase().includes('password') && (
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input 
                        type="password" 
                        className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-11"
                        value={signupData[field.id] || ''}
                        onChange={e => setSignupData(prev => ({ ...prev, [field.id]: e.target.value }))}
                        required={field.required}
                      />
                    </div>
                  )}
                  
                  {/* Regular text fields */}
                  {field.type === 'text' && !field.label.toLowerCase().includes('password') && (
                    <Input 
                      type="text" 
                      className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-11"
                      value={signupData[field.id] || ''}
                      onChange={e => setSignupData(prev => ({ ...prev, [field.id]: e.target.value }))}
                      required={field.required}
                    />
                  )}
                  
                  {/* Phone field */}
                  {field.type === 'phone' && (
                    <Input 
                      type="tel" 
                      className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-11"
                      value={signupData[field.id] || ''}
                      onChange={e => setSignupData(prev => ({ ...prev, [field.id]: e.target.value }))}
                      required={field.required}
                    />
                  )}
                  
                  {/* Textarea */}
                  {field.type === 'textarea' && (
                    <Textarea 
                      className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors min-h-[100px]"
                      value={signupData[field.id] || ''}
                      onChange={e => setSignupData(prev => ({ ...prev, [field.id]: e.target.value }))}
                      required={field.required}
                    />
                  )}
                </div>
              ))
            )}

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
