'use client'

import { useState } from 'react'
import { Upload, Palette, Lock, Eye, EyeOff, LayoutTemplate, Type, MousePointerClick, Image as ImageIcon, Globe } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Separator } from '@/ui-components/separator'
import { Switch } from '@/ui-components/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui-components/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select'
import { PortalConfig, Field } from '@/types/portal'
import { cn } from '@/lib/utils'

interface PortalSettingsProps {
  type: string
  settings: PortalConfig['settings']
  onUpdate: (updates: Partial<PortalConfig['settings']>) => void
}

export function PortalSettings({ type, settings, onUpdate }: PortalSettingsProps) {
  const [authPreviewTab, setAuthPreviewTab] = useState<'login' | 'signup'>('login')

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
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer group">
                {settings.logoUrl ? (
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
              <div className="flex gap-2">
                <Input 
                  value={settings.backgroundImageUrl || ''} 
                  onChange={(e) => onUpdate({ backgroundImageUrl: e.target.value })}
                  placeholder="https://..."
                  className="text-xs"
                />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'auth') {
    const activeFields = authPreviewTab === 'login' 
      ? (settings.loginFields || []) 
      : (settings.signupFields || [])

    const updateFields = (newFields: Field[]) => {
      if (authPreviewTab === 'login') {
        onUpdate({ loginFields: newFields })
      } else {
        onUpdate({ signupFields: newFields })
      }
    }

    return (
      <div className="flex h-full">
        {/* Settings Column */}
        <div className="w-1/2 p-8 border-r border-gray-200 overflow-y-auto">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900">Login & Signup</h2>
            <p className="text-gray-500 mt-1">Configure the authentication experience.</p>
          </div>

          <Tabs value={authPreviewTab} onValueChange={(v: any) => setAuthPreviewTab(v)} className="space-y-6">
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">Login Page</TabsTrigger>
              <TabsTrigger value="signup" className="flex-1">Signup Page</TabsTrigger>
            </TabsList>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Page Layout</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'centered', label: 'Centered', icon: LayoutTemplate },
                    { id: 'split', label: 'Split', icon: LayoutTemplate },
                    { id: 'card', label: 'Card', icon: LayoutTemplate },
                  ].map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => onUpdate({ authLayout: layout.id as any })}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 border rounded-lg text-sm transition-all",
                        settings.authLayout === layout.id 
                          ? "border-blue-500 bg-blue-50 text-blue-700" 
                          : "border-gray-200 hover:border-gray-300 text-gray-600"
                      )}
                    >
                      <layout.icon className="w-5 h-5" />
                      {layout.label}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">
                    {authPreviewTab === 'login' ? 'Login' : 'Signup'} Fields
                  </h3>
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    Reset Defaults
                  </Button>
                </div>
                
                {activeFields.map((field, idx) => (
                  <div key={field.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 group">
                    <div className="flex-1 space-y-1">
                      <Input 
                        value={field.label} 
                        onChange={(e) => {
                          const newFields = [...activeFields]
                          newFields[idx] = { ...newFields[idx], label: e.target.value }
                          updateFields(newFields)
                        }}
                        className="bg-white h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-500">Req</Label>
                      <Switch 
                        checked={field.required}
                        onCheckedChange={(checked) => {
                          const newFields = [...activeFields]
                          newFields[idx] = { ...newFields[idx], required: checked }
                          updateFields(newFields)
                        }}
                      />
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full border-dashed">
                  Add Custom Field
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Options</h3>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Social Login</Label>
                    <p className="text-xs text-gray-500">Allow Google/GitHub sign in</p>
                  </div>
                  <Switch 
                    checked={settings.socialLogin}
                    onCheckedChange={(c) => onUpdate({ socialLogin: c })}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <Label>Legal Links</Label>
                  <div className="grid gap-2">
                    <div className="relative">
                      <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                      <Input 
                        placeholder="Terms of Service URL" 
                        className="pl-9"
                        value={settings.termsUrl || ''}
                        onChange={(e) => onUpdate({ termsUrl: e.target.value })}
                      />
                    </div>
                    <div className="relative">
                      <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                      <Input 
                        placeholder="Privacy Policy URL" 
                        className="pl-9"
                        value={settings.privacyUrl || ''}
                        onChange={(e) => onUpdate({ privacyUrl: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Tabs>
        </div>

        {/* Preview Column */}
        <div className="w-1/2 bg-gray-100 p-8 flex items-center justify-center relative overflow-hidden">
          {/* Background Preview */}
          {settings.backgroundImageUrl && (
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-10"
              style={{ backgroundImage: `url(${settings.backgroundImageUrl})` }}
            />
          )}

          <div className={cn(
            "w-full max-w-md bg-white shadow-xl transition-all duration-300 flex flex-col",
            settings.authLayout === 'card' && "rounded-xl border border-gray-200",
            settings.authLayout === 'split' && "h-full max-w-none w-full flex-row",
            settings.authLayout === 'centered' && "bg-transparent shadow-none max-w-sm"
          )}>
            {settings.authLayout === 'split' && (
              <div className="w-1/2 bg-gray-900 p-8 text-white flex flex-col justify-between">
                <div className="w-8 h-8 bg-white/20 rounded-lg" />
                <div>
                  <h3 className="text-2xl font-bold mb-2">Welcome to {settings.name}</h3>
                  <p className="text-gray-400">Start your journey with us today.</p>
                </div>
              </div>
            )}

            <div className={cn(
              "p-8 flex flex-col justify-center",
              settings.authLayout === 'split' ? "w-1/2 bg-white" : "bg-white w-full",
              settings.authLayout === 'centered' && "rounded-xl shadow-sm border border-gray-200"
            )}>
              <div className="text-center mb-8">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="h-10 mx-auto mb-4 object-contain" />
                ) : (
                  <div 
                    className="w-10 h-10 rounded-lg mx-auto mb-4" 
                    style={{ backgroundColor: settings.themeColor }} 
                  />
                )}
                <h4 className="text-xl font-bold text-gray-900">
                  {authPreviewTab === 'login' ? 'Welcome Back' : 'Create Account'}
                </h4>
                <p className="text-sm text-gray-500 mt-1">
                  {authPreviewTab === 'login' ? 'Sign in to continue' : 'Get started for free'}
                </p>
              </div>

              <div className="space-y-4">
                {activeFields.map(field => (
                  <div key={field.id} className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input disabled placeholder={field.placeholder} className="bg-gray-50" />
                  </div>
                ))}

                <Button 
                  className={cn(
                    "w-full mt-2 font-medium",
                    settings.buttonStyle === 'pill' && "rounded-full",
                    settings.buttonStyle === 'sharp' && "rounded-none",
                    settings.buttonStyle === 'rounded' && "rounded-md"
                  )}
                  style={{ backgroundColor: settings.themeColor }}
                >
                  {authPreviewTab === 'login' ? 'Sign In' : 'Create Account'}
                </Button>

                {settings.socialLogin && (
                  <>
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-500">Or continue with</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="outline" className="w-full" disabled>Google</Button>
                      <Button variant="outline" className="w-full" disabled>GitHub</Button>
                    </div>
                  </>
                )}

                <p className="text-center text-xs text-gray-500 mt-4">
                  {authPreviewTab === 'login' ? (
                    <>Don't have an account? <span className="text-blue-600 font-medium">Sign up</span></>
                  ) : (
                    <>Already have an account? <span className="text-blue-600 font-medium">Sign in</span></>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}
