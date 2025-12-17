'use client'

import { useState } from 'react'
import { ArrowRight, Mail, Lock, Phone, Edit2, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Label } from '@/ui-components/label'
import { Field, PortalConfig } from '@/types/portal'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui-components/popover'
import { PageThemeSettings } from './PageThemeSettings'

interface SignUpPreviewProps {
  config: PortalConfig
  onSelectField?: (fieldId: string) => void
  selectedFieldId?: string | null
  onUpdateSettings?: (updates: Partial<PortalConfig['settings']>) => void
  formId?: string
}

export function SignUpPreview({ config, onSelectField, selectedFieldId, onUpdateSettings, formId }: SignUpPreviewProps) {
  const { settings } = config
  const themeColor = settings.themeColor || '#3B82F6'
  const [editingField, setEditingField] = useState<string | null>(null)

  const signupPage = settings.signupPage || {}
  const title = signupPage.title || settings.name || 'Application Portal'
  const description = signupPage.description || 'Please sign up to continue your application.'
  const buttonText = signupPage.buttonText || 'Create Account'
  const loginLinkText = signupPage.loginLinkText || 'Already have an account?'

  const logo = settings.signupPageLogo || settings.logoUrl
  const backgroundImage = settings.signupPageImage

  const handleUpdateSignupPage = (key: string, value: string) => {
    if (!onUpdateSettings) return
    onUpdateSettings({
      signupPage: {
        ...signupPage,
        [key]: value
      }
    })
  }

  return (
    <div className="min-h-screen bg-white flex relative">
      {/* Theme Button (Floating) */}
      {onUpdateSettings && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-4 left-4 z-50 shadow-lg bg-white"
            >
              <Palette className="w-4 h-4 mr-2" />
              Theme
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <PageThemeSettings
              pageType="signup"
              settings={settings}
              onUpdate={onUpdateSettings}
              formId={formId}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Left Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          {logo && (
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="h-10 object-contain" />
            </div>
          )}
          
          {/* Title - Editable */}
          <div className="space-y-2">
            {editingField === 'title' ? (
              <Input
                value={title}
                onChange={(e) => handleUpdateSignupPage('title', e.target.value)}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                autoFocus
                className="text-2xl font-bold text-center border-blue-500"
              />
            ) : (
              <h1 
                className={cn(
                  "text-2xl font-bold tracking-tight text-gray-900",
                  onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors"
                )}
                onClick={() => onUpdateSettings && setEditingField('title')}
              >
                {title}
              </h1>
            )}
          </div>
          
          {/* Description - Editable */}
          {editingField === 'description' ? (
            <Input
              value={description}
              onChange={(e) => handleUpdateSignupPage('description', e.target.value)}
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
              autoFocus
              className="text-sm text-center border-blue-500"
            />
          ) : (
            <p 
              className={cn(
                "text-gray-500 text-sm",
                onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors"
              )}
              onClick={() => onUpdateSettings && setEditingField('description')}
            >
              {description}
            </p>
          )}

        {/* Signup Fields */}
        <div className="space-y-4">
          {settings.signupFields.map((field) => (
            <div
              key={field.id}
              onClick={() => onSelectField?.(field.id)}
              className={cn(
                "space-y-1.5 rounded-lg transition-all cursor-pointer",
                selectedFieldId === field.id 
                  ? "ring-2 ring-blue-500 ring-offset-2 p-2 -m-2" 
                  : "hover:bg-gray-50 p-2 -m-2"
              )}
            >
              <Label className="text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              
              {/* Email field */}
              {field.type === 'email' && (
                <Input 
                  type="email" 
                  placeholder={field.placeholder}
                  className="h-10"
                  disabled
                />
              )}
              
              {/* Password field */}
              {field.type === 'text' && field.label.toLowerCase().includes('password') && (
                <Input 
                  type="password"
                  placeholder={field.placeholder}
                  className="h-10"
                  disabled
                />
              )}
              
              {/* Regular text fields */}
              {field.type === 'text' && !field.label.toLowerCase().includes('password') && (
                <Input 
                  type="text"
                  placeholder={field.placeholder}
                  className="h-10"
                  disabled
                />
              )}
              
              {/* Phone field */}
              {field.type === 'phone' && (
                <Input 
                  type="tel"
                  placeholder={field.placeholder}
                  className="h-10"
                  disabled
                />
              )}
              
              {/* Textarea fields */}
              {field.type === 'textarea' && (
                <Textarea 
                  placeholder={field.placeholder}
                  className="min-h-[80px]"
                  disabled
                />
              )}
            </div>
          ))}
        </div>

        {/* Sign Up Button */}
        <Button
          className="w-full h-11 text-base font-medium text-white"
          style={{ backgroundColor: themeColor }}
        >
          {buttonText}
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>

        {/* Login Link */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            {loginLinkText}{' '}
            <span className="font-medium hover:underline cursor-pointer" style={{ color: themeColor }}>
              Log in
            </span>
          </p>
        </div>
      </div>
      </div>

      {/* Right Side - Background Image */}
      {backgroundImage && (
        <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
          <img 
            src={backgroundImage} 
            alt="Background" 
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  )
}
