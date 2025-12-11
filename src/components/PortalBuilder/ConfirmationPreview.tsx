'use client'

import { useState } from 'react'
import { CheckCircle2, Edit2 } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Switch } from '@/ui-components/switch'
import { Label } from '@/ui-components/label'
import { PortalConfig } from '@/types/portal'
import { cn } from '@/lib/utils'

interface ConfirmationPreviewProps {
  config: PortalConfig
  onEdit?: () => void
  onUpdateSettings?: (updates: Partial<PortalConfig['settings']>) => void
}

export function ConfirmationPreview({ config, onEdit, onUpdateSettings }: ConfirmationPreviewProps) {
  const { settings } = config
  const themeColor = settings.themeColor || '#3B82F6'
  const [editingField, setEditingField] = useState<string | null>(null)

  const endingPage = settings.endingPage || {}
  const title = endingPage.title || 'Thank You for Your Submission!'
  const description = endingPage.description || "We've received your application and will review it carefully. You'll hear from us soon via email."
  const showDashboardButton = endingPage.showDashboardButton !== false
  const dashboardButtonText = endingPage.dashboardButtonText || 'View Dashboard'
  const showSubmitAnotherButton = endingPage.showSubmitAnotherButton !== false
  const submitAnotherButtonText = endingPage.submitAnotherButtonText || 'Submit Another'
  const footerMessage = endingPage.footerMessage || 'A confirmation email has been sent to your inbox.'

  const handleUpdateEndingPage = (key: string, value: string | boolean | number) => {
    if (!onUpdateSettings) return
    onUpdateSettings({
      endingPage: {
        ...endingPage,
        [key]: value
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-12 text-center">
          {/* Success Icon */}
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: `${themeColor}20` }}
          >
            <CheckCircle2 
              className="w-12 h-12"
              style={{ color: themeColor }}
            />
          </div>

          {/* Logo */}
          {settings.logoUrl && (
            <img 
              src={settings.logoUrl} 
              alt="Logo" 
              className="h-10 mx-auto mb-6"
            />
          )}

          {/* Editable Content Area */}
          <div className="space-y-4">
            {/* Title - Editable */}
            {editingField === 'title' ? (
              <Input
                value={title}
                onChange={(e) => handleUpdateEndingPage('title', e.target.value)}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                autoFocus
                className="text-3xl font-bold text-center border-blue-500"
              />
            ) : (
              <h1 
                className={cn(
                  "text-3xl font-bold text-gray-900",
                  onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors"
                )}
                onClick={() => onUpdateSettings && setEditingField('title')}
              >
                {title}
              </h1>
            )}
            
            {/* Description - Editable */}
            {editingField === 'description' ? (
              <Textarea
                value={description}
                onChange={(e) => handleUpdateEndingPage('description', e.target.value)}
                onBlur={() => setEditingField(null)}
                autoFocus
                className="text-lg text-center border-blue-500"
                rows={3}
              />
            ) : (
              <p 
                className={cn(
                  "text-lg text-gray-600 max-w-xl mx-auto",
                  onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors"
                )}
                onClick={() => onUpdateSettings && setEditingField('description')}
              >
                {description}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4 justify-center flex-wrap">
            {showDashboardButton && (
              editingField === 'dashboardButtonText' ? (
                <Input
                  value={dashboardButtonText}
                  onChange={(e) => handleUpdateEndingPage('dashboardButtonText', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                  autoFocus
                  className="w-36 text-center border-blue-500"
                />
              ) : (
                <Button
                  variant="outline"
                  className={cn(
                    "px-6",
                    onUpdateSettings && "hover:ring-2 hover:ring-gray-300"
                  )}
                  onClick={() => onUpdateSettings && setEditingField('dashboardButtonText')}
                >
                  {dashboardButtonText}
                </Button>
              )
            )}
            
            {showSubmitAnotherButton && (
              editingField === 'submitAnotherButtonText' ? (
                <Input
                  value={submitAnotherButtonText}
                  onChange={(e) => handleUpdateEndingPage('submitAnotherButtonText', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                  autoFocus
                  className="w-36 text-center border-blue-500"
                />
              ) : (
                <Button
                  className={cn(
                    "px-6",
                    onUpdateSettings && "hover:ring-2 hover:ring-blue-300"
                  )}
                  style={{ backgroundColor: themeColor }}
                  onClick={() => onUpdateSettings && setEditingField('submitAnotherButtonText')}
                >
                  {submitAnotherButtonText}
                </Button>
              )
            )}
          </div>

          {/* Button Visibility Toggles (only show in edit mode) */}
          {onUpdateSettings && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3">Button Visibility</p>
              <div className="flex justify-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showDashboardButton}
                    onCheckedChange={(c) => handleUpdateEndingPage('showDashboardButton', c)}
                  />
                  <Label className="text-sm text-gray-600">Dashboard</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showSubmitAnotherButton}
                    onCheckedChange={(c) => handleUpdateEndingPage('showSubmitAnotherButton', c)}
                  />
                  <Label className="text-sm text-gray-600">Submit Another</Label>
                </div>
              </div>
            </div>
          )}

          {/* Footer Info - Editable */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            {editingField === 'footerMessage' ? (
              <Input
                value={footerMessage}
                onChange={(e) => handleUpdateEndingPage('footerMessage', e.target.value)}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                autoFocus
                className="text-sm text-center border-blue-500"
              />
            ) : (
              <p 
                className={cn(
                  "text-sm text-gray-500",
                  onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors"
                )}
                onClick={() => onUpdateSettings && setEditingField('footerMessage')}
              >
                {footerMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
