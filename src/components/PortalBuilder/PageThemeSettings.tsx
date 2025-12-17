'use client'

import { useState, useRef } from 'react'
import { Upload, Image as ImageIcon, Loader2, X } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { PortalConfig } from '@/types/portal'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PageThemeSettingsProps {
  pageType: 'login' | 'signup' | 'sections'
  settings: PortalConfig['settings']
  onUpdate: (updates: Partial<PortalConfig['settings']>) => void
  formId?: string
}

export function PageThemeSettings({ pageType, settings, onUpdate, formId }: PageThemeSettingsProps) {
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const currentImage = pageType === 'login' ? settings.loginPageImage : pageType === 'signup' ? settings.signupPageImage : undefined
  const currentLogo = pageType === 'login' ? settings.loginPageLogo : pageType === 'signup' ? settings.signupPageLogo : settings.logoUrl

  // Handle background image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB')
      return
    }

    setIsUploadingImage(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `auth-images/${formId || 'default'}/${pageType}-${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('form-assets')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('form-assets')
        .getPublicUrl(fileName)

      if (pageType === 'login') {
        onUpdate({ loginPageImage: publicUrl })
      } else if (pageType === 'signup') {
        onUpdate({ signupPageImage: publicUrl })
      }
      toast.success('Background image uploaded successfully')
    } catch (error: any) {
      console.error('Image upload error:', error)
      toast.error(error.message || 'Failed to upload image')
    } finally {
      setIsUploadingImage(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    setIsUploadingLogo(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logos/${formId || 'default'}/${pageType}-${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('form-assets')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('form-assets')
        .getPublicUrl(fileName)

      if (pageType === 'login') {
        onUpdate({ loginPageLogo: publicUrl })
      } else if (pageType === 'signup') {
        onUpdate({ signupPageLogo: publicUrl })
      } else {
        onUpdate({ logoUrl: publicUrl })
      }
      toast.success('Logo uploaded successfully')
    } catch (error: any) {
      console.error('Logo upload error:', error)
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  const handleRemoveImage = () => {
    if (pageType === 'login') {
      onUpdate({ loginPageImage: '' })
    } else if (pageType === 'signup') {
      onUpdate({ signupPageImage: '' })
    }
  }

  const handleRemoveLogo = () => {
    if (pageType === 'login') {
      onUpdate({ loginPageLogo: '' })
    } else if (pageType === 'signup') {
      onUpdate({ signupPageLogo: '' })
    } else {
      onUpdate({ logoUrl: '' })
    }
  }

  // Show different settings based on page type
  if (pageType === 'sections') {
    return (
      <div className="p-4 space-y-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Form Theme</h2>
          <p className="text-xs text-gray-500 mt-1">Customize the appearance of your form sections.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Logo</Label>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
            {currentLogo ? (
              <div className="relative group">
                <div className="w-full h-32 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                  <img src={currentLogo} alt="Logo" className="max-h-full max-w-full object-contain" />
                </div>
                <button
                  onClick={handleRemoveLogo}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => logoInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed"
                disabled={isUploadingLogo}
              >
                {isUploadingLogo ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">Upload Logo</span>
                    <span className="text-xs text-gray-400">PNG, JPG up to 2MB</span>
                  </div>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Questions Background Color</Label>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
                style={{ backgroundColor: settings.formTheme?.questionsBackgroundColor || '#ffffff' }}
              />
              <Input 
                value={settings.formTheme?.questionsBackgroundColor || '#ffffff'} 
                onChange={(e) => onUpdate({ 
                  formTheme: { 
                    ...settings.formTheme, 
                    questionsBackgroundColor: e.target.value 
                  } 
                })}
                className="flex-1 font-mono text-sm"
                placeholder="#ffffff"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Primary Color</Label>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
                style={{ backgroundColor: settings.formTheme?.primaryColor || settings.themeColor || '#3B82F6' }}
              />
              <Input 
                value={settings.formTheme?.primaryColor || settings.themeColor || '#3B82F6'} 
                onChange={(e) => onUpdate({ 
                  formTheme: { 
                    ...settings.formTheme, 
                    primaryColor: e.target.value 
                  } 
                })}
                className="flex-1 font-mono text-sm"
                placeholder="#3B82F6"
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Login/Signup page settings
  return (
    <div className="p-4 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 capitalize">{pageType} Page Theme</h2>
        <p className="text-xs text-gray-500 mt-1">Customize the {pageType} page appearance.</p>
      </div>

      <div className="space-y-4">
        {/* Logo Upload */}
        <div className="space-y-2">
          <Label>Logo</Label>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
          {currentLogo ? (
            <div className="relative group">
              <div className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                <img src={currentLogo} alt="Logo" className="max-h-full max-w-full object-contain p-2" />
              </div>
              <button
                onClick={handleRemoveLogo}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed"
              disabled={isUploadingLogo}
            >
              {isUploadingLogo ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Upload className="w-5 h-5" />
                  <span className="text-sm">Upload Logo</span>
                  <span className="text-xs text-gray-400">PNG, JPG up to 2MB</span>
                </div>
              )}
            </Button>
          )}
          <p className="text-xs text-gray-500">Logo shown in the {pageType} form</p>
        </div>

        {/* Background Image Upload */}
        <div className="space-y-2">
          <Label>Background Image</Label>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          {currentImage ? (
            <div className="relative group">
              <div className="w-full h-48 border-2 border-dashed border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <img src={currentImage} alt="Background" className="w-full h-full object-cover" />
              </div>
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => imageInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed"
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm font-medium">Upload Background Image</span>
                  <span className="text-xs text-gray-400">PNG, JPG up to 5MB</span>
                  <span className="text-xs text-gray-400">Recommended: 1200x1600px</span>
                </div>
              )}
            </Button>
          )}
          <p className="text-xs text-gray-500">Displayed on the side in split-screen layout</p>
        </div>

        {/* Image Position */}
        {currentImage && (
          <div className="space-y-2">
            <Label>Image Position</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  if (pageType === 'login') {
                    onUpdate({ loginImagePosition: 'left' })
                  } else {
                    onUpdate({ signupImagePosition: 'left' })
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all",
                  (pageType === 'login' ? settings.loginImagePosition : settings.signupImagePosition) === 'left'
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                )}
              >
                <div className="flex gap-1">
                  <div className="w-3 h-4 bg-gray-400 rounded-sm" />
                  <div className="w-5 h-4 bg-gray-300 rounded-sm" />
                </div>
                <span className="text-xs font-medium">Left</span>
              </button>
              <button
                onClick={() => {
                  if (pageType === 'login') {
                    onUpdate({ loginImagePosition: 'right' })
                  } else {
                    onUpdate({ signupImagePosition: 'right' })
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all",
                  (pageType === 'login' ? settings.loginImagePosition : settings.signupImagePosition) !== 'left'
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300 text-gray-600"
                )}
              >
                <div className="flex gap-1">
                  <div className="w-5 h-4 bg-gray-300 rounded-sm" />
                  <div className="w-3 h-4 bg-gray-400 rounded-sm" />
                </div>
                <span className="text-xs font-medium">Right</span>
              </button>
            </div>
          </div>
        )}

        {/* Theme Color */}
        <div className="space-y-2">
          <Label>Brand Color</Label>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
              style={{ backgroundColor: settings.themeColor }}
            />
            <Input 
              value={settings.themeColor} 
              onChange={(e) => onUpdate({ themeColor: e.target.value })}
              className="flex-1 font-mono text-sm"
              placeholder="#3B82F6"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
