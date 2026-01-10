'use client'

import { useState, useMemo } from 'react'
import { ArrowRight, Mail, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Field, PortalConfig } from '@/types/portal'
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter'
import { RichTextEditor, RichTextContent } from '@/components/PortalBuilder/RichTextEditor'
import { toast } from 'sonner'

interface AuthPageRendererProps {
  type: 'login' | 'signup'
  config: PortalConfig
  email?: string
  password?: string
  signupData?: Record<string, any>
  onEmailChange?: (email: string) => void
  onPasswordChange?: (password: string) => void
  onSignupDataChange?: (data: Record<string, any>) => void
  onSubmit?: (e: React.FormEvent) => void
  onMagicLink?: (email: string) => Promise<void>
  isLoading?: boolean
  isMagicLinkLoading?: boolean
  onSelectField?: (fieldId: string) => void
  selectedFieldId?: string | null
  onUpdateSettings?: (updates: Partial<PortalConfig['settings']>) => void
  onToggleMode?: () => void
  isPreview?: boolean
  isMobilePreview?: boolean
}

export function AuthPageRenderer({
  type,
  config,
  email = '',
  password = '',
  signupData = {},
  onEmailChange,
  onPasswordChange,
  onSignupDataChange,
  onSubmit,
  onMagicLink,
  isLoading = false,
  isMagicLinkLoading = false,
  onSelectField,
  selectedFieldId,
  onUpdateSettings,
  onToggleMode,
  isPreview = false,
  isMobilePreview = false
}: AuthPageRendererProps) {
  const { settings } = config
  const [editingField, setEditingField] = useState<string | null>(null)
  
  const themeColor = settings.themeColor || '#3B82F6'
  const isSignup = type === 'signup'
  
  // Page-specific settings (always prefer explicit login/signupPage fields)
  const pageSettings = isSignup ? settings.signupPage : settings.loginPage
  const title = pageSettings?.title
    || (isSignup ? settings.signupTitle : settings.loginTitle)
    || settings.name
    || (isSignup ? 'Sign up for your account' : 'Log in to your account')
  const description = pageSettings?.description
    || (isSignup ? settings.signupDescription : settings.loginDescription)
    || (isSignup
        ? 'Please sign up to continue your application.'
        : 'Please log in to continue your application.'
      )
  // Dynamic button text based on password input
  // Use useMemo to ensure it updates when password changes
  const buttonText = useMemo(() => {
    if (isSignup) {
      // For signup: if password is provided, show custom text or "Create Account", otherwise show "Email me a signup link"
      if (password && password.trim().length > 0) {
        return pageSettings?.buttonText || 'Create Account'
      }
      return 'Email me a signup link'
    }
    
    // For login: if password is provided, show "Log In", otherwise show "Email me a login link"
    if (password && password.trim().length > 0) {
      return pageSettings?.buttonText || 'Log In'
    }
    return 'Email me a login link'
  }, [isSignup, password, pageSettings?.buttonText])
  const titleMargin = pageSettings?.titleMargin || {}
  const descriptionMargin = pageSettings?.descriptionMargin || {}
  
  const logo = isSignup ? (settings.signupPageLogo || settings.logoUrl) : (settings.loginPageLogo || settings.logoUrl)
  const backgroundImage = isSignup ? settings.signupPageImage : settings.loginPageImage
  const imagePosition = isSignup ? (settings.signupImagePosition || 'right') : (settings.loginImagePosition || 'right')
  const imageFocalPoint = isSignup ? (settings as any).signupImageFocalPoint : (settings as any).loginImageFocalPoint
  const mediaType = isSignup ? (settings as any).signupPageMediaType : (settings as any).loginPageMediaType
  
  // Detect if it's a video based on file extension or media type
  const isVideo = backgroundImage && (
    backgroundImage.endsWith('.mp4') || 
    backgroundImage.endsWith('.webm') || 
    backgroundImage.endsWith('.mov') ||
    mediaType === 'video'
  )

  const handleUpdatePageSettings = (key: string, value: string | any) => {
    if (!onUpdateSettings || !isSignup) return
    
    // Parse JSON strings for margin objects
    let parsedValue = value
    if (key.includes('Margin') && typeof value === 'string') {
      try {
        parsedValue = JSON.parse(value)
      } catch (e) {
        // If parsing fails, use the value as-is
      }
    }
    
    onUpdateSettings({
      signupPage: {
        ...pageSettings,
        [key]: parsedValue
      }
    })
  }

  const handleFieldChange = (fieldId: string, value: unknown) => {
    const newData = { ...signupData, [fieldId]: value }
    onSignupDataChange?.(newData)
    
    // Special handling for email and password fields
    if (type === 'signup') {
      const field = settings.signupFields?.find(f => f.id === fieldId)
      if (field?.type === 'email') {
        onEmailChange?.(value as string)
      }
      // Safely check label for password fields
      const fieldLabelStr = typeof field?.label === 'string' ? field.label : '';
      if (field?.type === 'text' && fieldLabelStr.toLowerCase().includes('password')) {
        onPasswordChange?.(value as string)
      }
    }
  }

  return (
    <div className={cn(
      "min-h-screen bg-white dark:bg-[#181818] text-gray-900 dark:text-[#FAFAFA] flex relative",
      isMobilePreview ? "flex-col" : "flex-col lg:flex-row"
    )}>
      {/* Background Media - Top on Mobile, Left on Desktop */}
      {backgroundImage && imagePosition === 'left' && (
        <div className={cn(
          "relative overflow-hidden",
          isMobilePreview ? "w-full h-48" : "w-full h-64 lg:hidden"
        )}>
          {isVideo ? (
            <video 
              src={backgroundImage} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: imageFocalPoint || 'center center'
              }}
              autoPlay 
              loop 
              muted 
              playsInline
            />
          ) : (
            <img 
              src={backgroundImage} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: imageFocalPoint || 'center center'
              }}
            />
          )}
        </div>
      )}
      
      {/* Background Media - Left Side Desktop Only */}
      {backgroundImage && imagePosition === 'left' && !isMobilePreview && (
        <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
          {isVideo ? (
            <video 
              src={backgroundImage} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: imageFocalPoint || 'center center'
              }}
              autoPlay 
              loop 
              muted 
              playsInline
            />
          ) : (
            <img 
              src={backgroundImage} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: imageFocalPoint || 'center center'
              }}
            />
          )}
        </div>
      )}

      {/* Form Content */}
      <div className={cn(
        "w-full flex flex-col items-center justify-center p-4 sm:p-6",
        !isMobilePreview && "lg:p-12",
        !isMobilePreview && backgroundImage && (imagePosition === 'left' || imagePosition === 'right') ? "lg:w-1/2" : !isMobilePreview && "lg:w-full"
      )}>
        <div className="w-full max-w-md space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Logo */}
          {logo && (
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className={cn(
                "object-contain",
                isMobilePreview ? "h-6" : "h-8 sm:h-10"
              )} />
            </div>
          )}
          
          {/* Title - Editable in preview mode */}
          <div 
            className={cn(isMobilePreview ? "space-y-1" : "space-y-1 sm:space-y-2")}
            style={{
              marginTop: `${titleMargin.top || 0}px`,
              marginBottom: `${titleMargin.bottom || 0}px`,
              marginLeft: `${titleMargin.left || 0}px`,
              marginRight: `${titleMargin.right || 0}px`,
            }}
          >
            <div
              className={cn(
                "font-bold tracking-tight text-gray-900 dark:text-[#FAFAFA] outline-none",
                isMobilePreview ? "text-lg" : "text-xl sm:text-2xl",
                isPreview && onUpdateSettings && editingField === 'title' && "ring-2 ring-blue-400 rounded px-2 py-1 bg-white dark:bg-[#181818]",
                isPreview && onUpdateSettings && editingField !== 'title' && "cursor-text hover:bg-gray-50 dark:hover:bg-[#232323] rounded px-2 py-1 transition-all"
              )}
              contentEditable={!!(isPreview && onUpdateSettings)}
              suppressContentEditableWarning
              onFocus={() => isPreview && setEditingField('title')}
              onBlur={(e) => {
                if (isPreview && editingField === 'title') {
                  const newText = e.currentTarget.textContent || ''
                  handleUpdatePageSettings('title', newText)
                  setEditingField(null)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
            >
              {title || 'Enter title...'}
            </div>
          </div>
          
          {/* Description - Editable in preview mode */}
          <div
            style={{
              marginTop: `${descriptionMargin.top || 0}px`,
              marginBottom: `${descriptionMargin.bottom || 0}px`,
              marginLeft: `${descriptionMargin.left || 0}px`,
              marginRight: `${descriptionMargin.right || 0}px`,
            }}
          >
            <div
              className={cn(
                "text-gray-500 dark:text-[#FAFAFA]/80 outline-none",
                isMobilePreview ? "text-xs" : "text-sm",
                isPreview && onUpdateSettings && editingField === 'description' && "ring-2 ring-blue-400 rounded px-2 py-1 bg-white dark:bg-[#181818]",
                isPreview && onUpdateSettings && editingField !== 'description' && "cursor-text hover:bg-gray-50 dark:hover:bg-[#232323] rounded px-2 py-1 transition-all"
              )}
              contentEditable={!!(isPreview && onUpdateSettings)}
              suppressContentEditableWarning
              onFocus={() => isPreview && setEditingField('description')}
              onBlur={(e) => {
                if (isPreview && editingField === 'description') {
                  const newText = e.currentTarget.textContent || ''
                  handleUpdatePageSettings('description', newText)
                  setEditingField(null)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.blur()
                }
              }}
            >
              {description || 'Enter description...'}
            </div>
          </div>

          {/* Form Fields */}
          <form onSubmit={onSubmit} className={cn(isMobilePreview ? "space-y-2" : "space-y-3 sm:space-y-4")}>
            {type === 'login' ? (
              // Login fields - always email + password
              <>
                <div className={cn(isMobilePreview ? "space-y-1" : "space-y-2")}>
                  <Label htmlFor="email" className={cn(isMobilePreview && "text-xs")}>Email Address</Label>
                  <div className="relative">
                    <Mail className={cn(
                      "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400",
                      isMobilePreview ? "w-3 h-3" : "w-4 h-4"
                    )} />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="you@example.com" 
                      className={cn(
                        "pl-10",
                        isMobilePreview && "h-8 text-xs"
                      )}
                      value={email}
                      onChange={(e) => onEmailChange?.(e.target.value)}
                      required
                      disabled={isPreview}
                    />
                  </div>
                </div>

                <div className={cn(isMobilePreview ? "space-y-1" : "space-y-2")}>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className={cn(isMobilePreview && "text-xs")}>Password</Label>
                    <a 
                      href="#" 
                      className={cn(
                        "text-xs text-gray-500 hover:text-gray-700",
                        isMobilePreview && "text-[10px]"
                      )}
                      onClick={(e) => {
                        e.preventDefault()
                        // TODO: Implement forgot password flow
                      }}
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className={cn(
                      "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400",
                      isMobilePreview ? "w-3 h-3" : "w-4 h-4"
                    )} />
                    <Input 
                      id="password" 
                      type="password"
                      autoComplete="current-password"
                      placeholder="Optional"
                      className={cn(
                        "pl-10",
                        isMobilePreview && "h-8 text-xs"
                      )}
                      value={password}
                      onChange={(e) => onPasswordChange?.(e.target.value)}
                      disabled={isPreview}
                    />
                  </div>
                </div>
              </>
            ) : (
              // Signup fields - always use default Better Auth fields (full name, email, password)
              (() => {
                // Default Better Auth signup fields - always use these
                const defaultFields: Field[] = [
                  {
                    id: 'full_name',
                    type: 'text',
                    label: 'Full name',
                    required: true,
                    placeholder: 'Enter your full name'
                  },
                  {
                    id: 'email',
                    type: 'email',
                    label: 'Email',
                    required: true,
                    placeholder: 'you@example.com'
                  },
                  {
                    id: 'password',
                    type: 'password',
                    label: 'Password',
                    required: false,
                    placeholder: 'Optional'
                  }
                ]
                
                return defaultFields.map((field) => {
                    // Special handling for email field to sync with email state
                    if (field.id === 'email') {
                      return (
                        <div
                          key={field.id}
                          className={cn(isMobilePreview ? "space-y-1" : "space-y-2")}
                        >
                          <Label htmlFor={field.id} className={cn(isMobilePreview && "text-xs")}>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </Label>
                          <Input
                            id={field.id}
                            type="email"
                            placeholder={field.placeholder}
                            className={cn(isMobilePreview && "h-8 text-xs")}
                            value={email}
                            onChange={(e) => {
                              onEmailChange?.(e.target.value)
                              handleFieldChange(field.id, e.target.value)
                            }}
                            required={field.required}
                            disabled={isPreview}
                          />
                        </div>
                      )
                    }
                    
                    // Special handling for password field
                    if (field.id === 'password') {
                      return (
                        <div
                          key={field.id}
                          className={cn(isMobilePreview ? "space-y-1" : "space-y-2")}
                        >
                          <Label htmlFor={field.id} className={cn(isMobilePreview && "text-xs")}>
                            {field.label}
                          </Label>
                          <Input
                            id={field.id}
                            type="password"
                            autoComplete="new-password"
                            placeholder={field.placeholder}
                            className={cn(isMobilePreview && "h-8 text-xs")}
                            value={password}
                            onChange={(e) => {
                              onPasswordChange?.(e.target.value)
                              handleFieldChange(field.id, e.target.value)
                            }}
                            disabled={isPreview}
                          />
                        </div>
                      )
                    }
                    
                    // Regular text fields (full_name)
                    return (
                      <div
                        key={field.id}
                        className={cn(isMobilePreview ? "space-y-1" : "space-y-2")}
                      >
                        <Label htmlFor={field.id} className={cn(isMobilePreview && "text-xs")}>
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </Label>
                        <Input
                          id={field.id}
                          type="text"
                          placeholder={field.placeholder}
                          className={cn(isMobilePreview && "h-8 text-xs")}
                          value={signupData[field.id] || ''}
                          onChange={(e) => handleFieldChange(field.id, e.target.value)}
                          required={field.required}
                          disabled={isPreview}
                        />
                      </div>
                    )
                  })
              })()
            )}

            {/* Submit Button - Editable text in preview mode */}
            {isPreview && editingField === 'button' ? (
              <Input
                value={buttonText}
                onChange={(e) => handleUpdatePageSettings('buttonText', e.target.value)}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                autoFocus
                className="text-center border-blue-500"
              />
            ) : (
              <Button 
                type={isPreview ? "button" : "submit"}
                className={cn(
                  "w-full font-medium transition-all",
                  isMobilePreview ? "h-8 text-xs" : "h-10 sm:h-11 text-sm sm:text-base",
                  isPreview && onUpdateSettings && "cursor-pointer"
                )}
                style={{ backgroundColor: themeColor }}
                disabled={isLoading}
                onClick={async (e) => {
                  if (isPreview && onUpdateSettings) {
                    e.preventDefault()
                    setEditingField('button')
                    return
                  }
                  
                  // For login: if no password, trigger magic link instead
                  if (!isSignup && (!password || password.trim().length === 0) && onMagicLink && email.trim()) {
                    e.preventDefault()
                    await onMagicLink(email.trim())
                    return
                  }
                  
                  // For signup: if no password, trigger magic link instead
                  if (isSignup && (!password || password.trim().length === 0) && onMagicLink && email.trim()) {
                    e.preventDefault()
                    await onMagicLink(email.trim())
                    return
                  }
                }}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    {buttonText}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            )}
          </form>
        </div>

        {/* Toggle between login/signup */}
        {onToggleMode && (
          <p className="text-center mt-4 sm:mt-6 text-xs sm:text-sm text-gray-500">
            {type === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button 
              onClick={onToggleMode}
              className="font-medium text-gray-900 hover:underline underline-offset-4"
              type="button"
            >
              {type === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        )}
      </div>

      {/* Background Media - Top on Mobile, Right on Desktop */}
      {backgroundImage && imagePosition === 'right' && (
        <div className={cn(
          "relative overflow-hidden order-first",
          isMobilePreview ? "w-full h-48" : "w-full h-64 lg:hidden"
        )}>
          {isVideo ? (
            <video 
              src={backgroundImage} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: imageFocalPoint || 'center center'
              }}
              autoPlay 
              loop 
              muted 
              playsInline
            />
          ) : (
            <img 
              src={backgroundImage} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: imageFocalPoint || 'center center'
              }}
            />
          )}
        </div>
      )}
      
      {/* Background Media - Right Side Desktop Only */}
      {backgroundImage && imagePosition === 'right' && !isMobilePreview && (
        <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
          {isVideo ? (
            <video 
              src={backgroundImage} 
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: imageFocalPoint || 'center center'
              }}
              autoPlay 
              loop 
              muted 
              playsInline
            />
          ) : (
            <img 
              src={backgroundImage} 
              alt="Background" 
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                objectPosition: imageFocalPoint || 'center center'
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}
