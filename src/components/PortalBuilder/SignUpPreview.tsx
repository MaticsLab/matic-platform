'use client'

import { useState } from 'react'
import { ArrowRight, Mail, Lock, Phone, Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Label } from '@/ui-components/label'
import { Field, PortalConfig } from '@/types/portal'

interface SignUpPreviewProps {
  config: PortalConfig
  onSelectField?: (fieldId: string) => void
  selectedFieldId?: string | null
  onUpdateSettings?: (updates: Partial<PortalConfig['settings']>) => void
}

export function SignUpPreview({ config, onSelectField, selectedFieldId, onUpdateSettings }: SignUpPreviewProps) {
  const { settings } = config
  const themeColor = settings.themeColor || '#3B82F6'
  const [editingField, setEditingField] = useState<string | null>(null)

  const signupPage = settings.signupPage || {}
  const title = signupPage.title || settings.name || 'Application Portal'
  const description = signupPage.description || 'Please sign up to continue your application.'
  const buttonText = signupPage.buttonText || 'Create Account'
  const loginLinkText = signupPage.loginLinkText || 'Already have an account?'

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
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center p-4 font-sans text-gray-900">
      <div className="w-full max-w-md">
        {/* Notion-like Header */}
        <div className="mb-8 text-center space-y-4">
          {/* Logo/Icon */}
          {settings.logoUrl ? (
            <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-gray-200 mx-auto flex items-center justify-center overflow-hidden">
              <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-gray-200 mx-auto flex items-center justify-center text-3xl">
              🎓
            </div>
          )}
          
          {/* Portal Name - Editable */}
          {editingField === 'title' ? (
            <Input
              value={title}
              onChange={(e) => handleUpdateSignupPage('title', e.target.value)}
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
              autoFocus
              className="text-3xl font-bold text-center border-blue-500"
            />
          ) : (
            <h1 
              className={cn(
                "text-3xl font-bold tracking-tight text-gray-900",
                onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors group relative"
              )}
              onClick={() => onUpdateSettings && setEditingField('title')}
            >
              {title}
              {onUpdateSettings && (
                <Edit2 className="w-4 h-4 absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 text-gray-400" />
              )}
            </h1>
          )}
          
          {/* Description - Editable */}
          {editingField === 'description' ? (
            <Input
              value={description}
              onChange={(e) => handleUpdateSignupPage('description', e.target.value)}
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
              autoFocus
              className="text-lg text-center border-blue-500"
            />
          ) : (
            <p 
              className={cn(
                "text-gray-500 text-lg",
                onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors"
              )}
              onClick={() => onUpdateSettings && setEditingField('description')}
            >
              {description}
            </p>
          )}
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-6">
          <div className="space-y-4">
            {settings.signupFields.map((field) => (
              <div
                key={field.id}
                onClick={() => onSelectField?.(field.id)}
                className={cn(
                  "space-y-2 rounded-lg transition-all cursor-pointer",
                  selectedFieldId === field.id 
                    ? "ring-2 ring-blue-500 ring-offset-2 p-2 -m-2" 
                    : "hover:bg-gray-50 p-2 -m-2"
                )}
              >
                <Label className="text-base font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {field.description && (
                  <p className="text-sm text-gray-500 -mt-1">{field.description}</p>
                )}
                
                {/* Email field with icon */}
                {field.type === 'email' && (
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      type="email" 
                      placeholder={field.placeholder}
                      className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-11"
                      disabled
                    />
                  </div>
                )}
                
                {/* Password field (detected by label) with icon */}
                {field.type === 'text' && field.label.toLowerCase().includes('password') && (
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      type="password"
                      placeholder={field.placeholder}
                      className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-11"
                      disabled
                    />
                  </div>
                )}
                
                {/* Regular text fields */}
                {field.type === 'text' && !field.label.toLowerCase().includes('password') && (
                  <Input 
                    type="text"
                    placeholder={field.placeholder}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-11"
                    disabled
                  />
                )}
                
                {/* Phone field with icon */}
                {field.type === 'phone' && (
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      type="tel"
                      placeholder={field.placeholder}
                      className="pl-10 bg-gray-50/50 border-gray-200 focus:bg-white transition-colors h-11"
                      disabled
                    />
                  </div>
                )}
                
                {/* Textarea fields */}
                {field.type === 'textarea' && (
                  <Textarea 
                    placeholder={field.placeholder}
                    className="bg-gray-50/50 border-gray-200 focus:bg-white transition-colors min-h-[80px]"
                    disabled
                  />
                )}
              </div>
            ))}
          </div>

          {/* Sign Up Button - Editable */}
          {editingField === 'buttonText' ? (
            <Input
              value={buttonText}
              onChange={(e) => handleUpdateSignupPage('buttonText', e.target.value)}
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
              autoFocus
              className="text-center border-blue-500"
            />
          ) : (
            <Button
              className={cn(
                "w-full h-12 text-base font-medium text-white group",
                onUpdateSettings && "hover:ring-2 hover:ring-blue-300"
              )}
              style={{ backgroundColor: themeColor }}
              onClick={() => onUpdateSettings && setEditingField('buttonText')}
            >
              {buttonText}
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}

          {/* Login Link - Editable */}
          <div className="text-center pt-2">
            {editingField === 'loginLinkText' ? (
              <Input
                value={loginLinkText}
                onChange={(e) => handleUpdateSignupPage('loginLinkText', e.target.value)}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                autoFocus
                className="text-center border-blue-500 text-sm"
              />
            ) : (
              <p 
                className={cn(
                  "text-gray-500",
                  onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors inline-block"
                )}
                onClick={() => onUpdateSettings && setEditingField('loginLinkText')}
              >
                {loginLinkText}{' '}
                <span className="font-medium hover:underline" style={{ color: themeColor }}>
                  Log in
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Powered by Matic */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Powered by Matics Lab
          </p>
        </div>
      </div>
    </div>
  )
}
