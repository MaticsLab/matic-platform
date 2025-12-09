'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Field, PortalConfig } from '@/types/portal'

interface SignUpPreviewProps {
  config: PortalConfig
  onSelectField?: (fieldId: string) => void
  selectedFieldId?: string | null
}

export function SignUpPreview({ config, onSelectField, selectedFieldId }: SignUpPreviewProps) {
  const { settings } = config
  const themeColor = settings.themeColor || '#3B82F6'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        {settings.logoUrl && (
          <div className="text-center mb-8">
            <img 
              src={settings.logoUrl} 
              alt="Logo" 
              className="h-12 mx-auto"
            />
          </div>
        )}

        {/* Sign Up Card */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
            <p className="text-sm text-gray-500 mt-1">Sign up to get started</p>
          </div>

          {/* Sign Up Fields */}
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
                <Label className="text-sm font-medium text-gray-700">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {field.placeholder && (
                  <p className="text-sm text-gray-500 -mt-1">{field.placeholder}</p>
                )}
                <Input
                  type={field.type === 'email' ? 'email' : 'text'}
                  placeholder={field.label}
                  className="h-11"
                  disabled
                />
              </div>
            ))}
          </div>

          {/* Sign Up Button */}
          <Button
            className="w-full mt-6 h-11"
            style={{ backgroundColor: themeColor }}
          >
            Sign Up
          </Button>

          {/* Social Login */}
          {settings.socialLogin && (
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="outline" disabled>
                  Google
                </Button>
                <Button variant="outline" disabled>
                  GitHub
                </Button>
              </div>
            </div>
          )}

          {/* Login Link */}
          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <a href="#" className="font-medium" style={{ color: themeColor }}>
                Log in
              </a>
            </p>
          </div>

          {/* Terms & Privacy */}
          {(settings.termsUrl || settings.privacyUrl) && (
            <div className="text-center mt-4 text-xs text-gray-500">
              By signing up, you agree to our{' '}
              {settings.termsUrl && (
                <a href={settings.termsUrl} className="underline" style={{ color: themeColor }}>
                  Terms
                </a>
              )}
              {settings.termsUrl && settings.privacyUrl && ' and '}
              {settings.privacyUrl && (
                <a href={settings.privacyUrl} className="underline" style={{ color: themeColor }}>
                  Privacy Policy
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
