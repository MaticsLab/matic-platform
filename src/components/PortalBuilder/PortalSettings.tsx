'use client'

import { useState, useRef } from 'react'
import { Upload, Palette, Lock, Eye, EyeOff, LayoutTemplate, Type, MousePointerClick, Image as ImageIcon, Globe, Loader2 } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Separator } from '@/ui-components/separator'
import { Switch } from '@/ui-components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { PortalConfig, Field } from '@/types/portal'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface PortalSettingsProps {
  type: string
  settings: PortalConfig['settings']
  onUpdate: (updates: Partial<PortalConfig['settings']>) => void
  /** Form ID for organizing uploads */
  formId?: string
}

export function PortalSettings({ type, settings, onUpdate, formId }: PortalSettingsProps) {
  const [authPreviewTab, setAuthPreviewTab] = useState<'login' | 'signup'>('login')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingBackground, setIsUploadingBackground] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const backgroundInputRef = useRef<HTMLInputElement>(null)

  // Handle logo file upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB')
      return
    }

    setIsUploadingLogo(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logos/${formId || 'default'}/${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('form-assets')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('form-assets')
        .getPublicUrl(fileName)

      onUpdate({ logoUrl: publicUrl })
      toast.success('Logo uploaded successfully')
    } catch (error: any) {
      console.error('Logo upload error:', error)
      toast.error(error.message || 'Failed to upload logo')
    } finally {
      setIsUploadingLogo(false)
      // Reset input
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  // Handle background image upload
  const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingBackground(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `backgrounds/${formId || 'default'}/${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('form-assets')
        .upload(fileName, file, { upsert: true })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('form-assets')
        .getPublicUrl(fileName)

      onUpdate({ backgroundImageUrl: publicUrl })
      toast.success('Background uploaded successfully')
    } catch (error: any) {
      console.error('Background upload error:', error)
      toast.error(error.message || 'Failed to upload background')
    } finally {
      setIsUploadingBackground(false)
      if (backgroundInputRef.current) backgroundInputRef.current.value = ''
    }
  }

  if (type === 'branding') {
    return (
      <div className="p-4 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Branding</h2>
          <p className="text-xs text-gray-500 mt-1">Customize portal appearance.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Portal Name</Label>
              <Input 
                value={settings.name} 
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="e.g. Scholarship Application Portal"
              />
            </div>

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
                  className="flex-1 font-mono"
                  placeholder="#000000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Typography</Label>
              <Select 
                value={settings.font || 'inter'} 
                onValueChange={(val: any) => onUpdate({ font: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inter">Inter (Modern Sans)</SelectItem>
                  <SelectItem value="roboto">Roboto (Neutral)</SelectItem>
                  <SelectItem value="serif">Merriweather (Serif)</SelectItem>
                  <SelectItem value="mono">JetBrains Mono (Code)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Button Style</Label>
              <div className="flex gap-2 flex-wrap">
                {['rounded', 'pill', 'sharp'].map((style) => (
                  <button
                    key={style}
                    onClick={() => onUpdate({ buttonStyle: style as any })}
                    className={cn(
                      "px-3 py-1.5 border rounded-md text-xs font-medium transition-all",
                      settings.buttonStyle === style 
                        ? "border-blue-500 bg-blue-50 text-blue-700" 
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    )}
                  >
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </button>
                ))}
              </div>
            </div>
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
              <div 
                onClick={() => !isUploadingLogo && logoInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer group",
                  isUploadingLogo && "opacity-50 cursor-wait"
                )}
              >
                {isUploadingLogo ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400 mb-2" />
                    <p className="text-xs text-gray-500">Uploading...</p>
                  </div>
                ) : settings.logoUrl ? (
                   <div className="relative w-20 h-20 mx-auto">
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                        <span className="text-white text-xs">Change</span>
                      </div>
                   </div>
                ) : (
                  <>
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-white transition-colors">
                      <Upload className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-xs font-medium text-gray-900">Upload logo</p>
                  </>
                )}
              </div>
              <Input 
                value={settings.logoUrl || ''} 
                onChange={(e) => onUpdate({ logoUrl: e.target.value })}
                placeholder="Or enter logo URL..."
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label>Background Image</Label>
              <input
                ref={backgroundInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackgroundUpload}
                className="hidden"
              />
              <div className="flex gap-2">
                <Input 
                  value={settings.backgroundImageUrl || ''} 
                  onChange={(e) => onUpdate({ backgroundImageUrl: e.target.value })}
                  placeholder="https://..."
                  className="text-xs"
                />
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 shrink-0"
                  onClick={() => !isUploadingBackground && backgroundInputRef.current?.click()}
                  disabled={isUploadingBackground}
                >
                  {isUploadingBackground ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Form Designer Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Form Designer</h3>
            <p className="text-xs text-gray-500 mb-4">Customize form field appearance.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Questions Background</Label>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded border border-gray-200"
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
                    className="w-24 font-mono text-xs"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Label className="text-sm">Primary</Label>
                  <span className="text-gray-400 text-xs cursor-help" title="Used for buttons and accents">ⓘ</span>
                </div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded border border-gray-200"
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
                    className="w-24 font-mono text-xs"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Questions</Label>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded border border-gray-200"
                    style={{ backgroundColor: settings.formTheme?.questionsColor || '#111827' }}
                  />
                  <Input 
                    value={settings.formTheme?.questionsColor || '#111827'} 
                    onChange={(e) => onUpdate({ 
                      formTheme: { 
                        ...settings.formTheme, 
                        questionsColor: e.target.value 
                      } 
                    })}
                    className="w-24 font-mono text-xs"
                    placeholder="#111827"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Answers</Label>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded border border-gray-200"
                    style={{ backgroundColor: settings.formTheme?.answersColor || '#374151' }}
                  />
                  <Input 
                    value={settings.formTheme?.answersColor || '#374151'} 
                    onChange={(e) => onUpdate({ 
                      formTheme: { 
                        ...settings.formTheme, 
                        answersColor: e.target.value 
                      } 
                    })}
                    className="w-24 font-mono text-xs"
                    placeholder="#374151"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <Label className="text-sm">Logo</Label>
                  <span className="text-gray-400 text-xs cursor-help" title="Show logo in form header">ⓘ</span>
                </div>
                <Switch
                  checked={settings.formTheme?.showLogo !== false}
                  onCheckedChange={(checked) => onUpdate({ 
                    formTheme: { 
                      ...settings.formTheme, 
                      showLogo: checked 
                    } 
                  })}
                />
              </div>
              {settings.logoUrl && settings.formTheme?.showLogo !== false && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <img 
                    src={settings.logoUrl} 
                    alt="Logo preview" 
                    className="h-8 w-auto object-contain"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'auth') {
    // Auth page settings are now handled by PageThemeSettings
    // This section is kept for backwards compatibility but redirects to theme settings
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Auth Page Settings</h2>
          <p className="text-gray-500 mb-4">
            Auth page customization has been moved to the Theme settings tab.
          </p>
          <p className="text-sm text-gray-400">
            Use the Theme tab to customize logo, background image, title, and description.
          </p>
        </div>
      </div>
    )
  }

  return null
}
