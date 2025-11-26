'use client'

import { Upload, Palette, Lock, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Separator } from '@/ui-components/separator'
import { Switch } from '@/ui-components/switch'
import { PortalConfig } from '@/types/portal'

interface PortalSettingsProps {
  type: string
  settings: PortalConfig['settings']
  onUpdate: (updates: Partial<PortalConfig['settings']>) => void
}

export function PortalSettings({ type, settings, onUpdate }: PortalSettingsProps) {
  if (type === 'branding') {
    return (
      <div className="p-8 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Branding & Appearance</h2>
          <p className="text-gray-500 mt-1">Customize how your portal looks to applicants.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <Label>Portal Name</Label>
            <Input 
              value={settings.name} 
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="e.g. Scholarship Application Portal"
            />
          </div>

          <div className="space-y-3">
            <Label>Brand Color</Label>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
                style={{ backgroundColor: settings.themeColor }}
              />
              <Input 
                value={settings.themeColor} 
                onChange={(e) => onUpdate({ themeColor: e.target.value })}
                className="w-32 font-mono"
                placeholder="#000000"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label>Logo</Label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-900">Click to upload logo</p>
              <p className="text-xs text-gray-500 mt-1">SVG, PNG, JPG (max. 2MB)</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'auth') {
    return (
      <div className="p-8 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Login & Signup</h2>
          <p className="text-gray-500 mt-1">Configure the authentication experience.</p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Preview</h3>
            <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-sm mx-auto shadow-sm">
              <div className="text-center mb-6">
                <div className="w-10 h-10 bg-gray-900 rounded-lg mx-auto mb-3" />
                <h4 className="font-bold text-gray-900">Welcome Back</h4>
                <p className="text-sm text-gray-500">Sign in to continue</p>
              </div>
              <div className="space-y-3">
                {(settings.loginFields || []).map(field => (
                  <div key={field.id} className="space-y-1">
                    <Label className="text-xs">{field.label}</Label>
                    <Input disabled placeholder={field.placeholder} />
                  </div>
                ))}
                <Button className="w-full mt-4" style={{ backgroundColor: settings.themeColor }}>Sign In</Button>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">Login Fields</h3>
            {(settings.loginFields || []).map((field, idx) => (
              <div key={field.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <Input 
                  value={field.label} 
                  onChange={(e) => {
                    const newFields = [...(settings.loginFields || [])]
                    newFields[idx].label = e.target.value
                    onUpdate({ loginFields: newFields })
                  }}
                  className="bg-white"
                />
                <Switch checked={field.required} />
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full">Add Field</Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
