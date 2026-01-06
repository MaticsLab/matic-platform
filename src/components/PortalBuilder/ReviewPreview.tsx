'use client'

import { useState } from 'react'
import { CheckCircle2, Edit2, AlertCircle } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { Input } from '@/ui-components/input'
import { Textarea } from '@/ui-components/textarea'
import { Label } from '@/ui-components/label'
import { PortalConfig } from '@/types/portal'
import { cn } from '@/lib/utils'

interface ReviewPreviewProps {
  config: PortalConfig
  onEdit?: () => void
  onUpdateSettings?: (updates: Partial<PortalConfig['settings']>) => void
}

export function ReviewPreview({ config, onEdit, onUpdateSettings }: ReviewPreviewProps) {
  const { settings } = config
  const themeColor = settings.themeColor || '#3B82F6'
  const [editingField, setEditingField] = useState<string | null>(null)

  const reviewPage = settings.reviewPage || {}
  const title = reviewPage.title || 'Review & Submit'
  const description = reviewPage.description || 'Review your application and submit when ready.'
  const incompleteTitle = reviewPage.incompleteTitle || 'Application Incomplete'
  const incompleteMessage = reviewPage.incompleteMessage || '18 of 27 required fields completed. Please complete all sections before submitting.'
  const submitButtonText = reviewPage.submitButtonText || 'Submit Application'
  const editButtonText = reviewPage.editButtonText || 'Edit'

  const handleUpdateReviewPage = (key: string, value: string) => {
    if (!onUpdateSettings) return
    onUpdateSettings({
      reviewPage: {
        ...reviewPage,
        [key]: value
      }
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Logo */}
        {settings.logoUrl && (
          <div className="mb-6">
            <img 
              src={settings.logoUrl} 
              alt="Logo" 
              className="h-10"
            />
          </div>
        )}

        {/* Header - Editable */}
        <div className="mb-6">
          {editingField === 'title' ? (
            <Input
              value={title}
              onChange={(e) => handleUpdateReviewPage('title', e.target.value)}
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
              autoFocus
              className="text-3xl font-bold border-blue-500 mb-2"
            />
          ) : (
            <h1 
              className={cn(
                "text-3xl font-bold text-gray-900",
                onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-2 transition-colors"
              )}
              onClick={() => onUpdateSettings && setEditingField('title')}
            >
              {title}
            </h1>
          )}
          
          {editingField === 'description' ? (
            <Input
              value={description}
              onChange={(e) => handleUpdateReviewPage('description', e.target.value)}
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
              autoFocus
              className="border-blue-500 mt-2"
            />
          ) : (
            <p 
              className={cn(
                "text-gray-600 mt-2",
                onUpdateSettings && "cursor-pointer hover:bg-blue-50 rounded px-2 py-1 -mx-2 transition-colors"
              )}
              onClick={() => onUpdateSettings && setEditingField('description')}
            >
              {description}
            </p>
          )}
        </div>

        {/* Incomplete Warning - Editable */}
        <div
          className={cn(
            "bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 transition-all",
            onUpdateSettings && "cursor-pointer hover:shadow-md hover:border-orange-300"
          )}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              {editingField === 'incompleteTitle' ? (
                <Input
                  value={incompleteTitle}
                  onChange={(e) => handleUpdateReviewPage('incompleteTitle', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                  autoFocus
                  className="font-semibold border-blue-500 mb-1"
                />
              ) : (
                <h3 
                  className={cn(
                    "font-semibold text-orange-900 mb-1",
                    onUpdateSettings && "hover:bg-orange-100 rounded px-1 -mx-1 transition-colors"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateSettings && setEditingField('incompleteTitle')
                  }}
                >
                  {incompleteTitle}
                </h3>
              )}
              
              {editingField === 'incompleteMessage' ? (
                <Textarea
                  value={incompleteMessage}
                  onChange={(e) => handleUpdateReviewPage('incompleteMessage', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  autoFocus
                  className="text-sm border-blue-500"
                  rows={2}
                />
              ) : (
                <p 
                  className={cn(
                    "text-sm text-orange-700",
                    onUpdateSettings && "hover:bg-orange-100 rounded px-1 -mx-1 transition-colors"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUpdateSettings && setEditingField('incompleteMessage')
                  }}
                >
                  {incompleteMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Review Sections */}
        <div className="space-y-4">
          {(Array.isArray(config.sections) ? config.sections.filter(s => s.sectionType === 'form') : []).map((section, idx) => (
            <div key={section.id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold"
                    style={{ backgroundColor: themeColor }}
                  >
                    {idx === 0 ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                </div>
                {editingField === 'editButtonText' ? (
                  <Input
                    value={editButtonText}
                    onChange={(e) => handleUpdateReviewPage('editButtonText', e.target.value)}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                    autoFocus
                    className="w-24 text-sm border-blue-500"
                  />
                ) : (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    style={{ color: themeColor }}
                    onClick={() => onUpdateSettings && setEditingField('editButtonText')}
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    {editButtonText}
                  </Button>
                )}
              </div>

              {/* Sample field data */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {section.fields.slice(0, 4).map((field) => (
                  <div key={field.id}>
                    <div className="text-gray-500 mb-1">{field.label}</div>
                    <div className="text-gray-900 font-medium">
                      {field.type === 'email' ? 'user@example.com' : 
                       field.type === 'phone' ? '(555) 123-4567' :
                       field.type === 'date' ? '2025-01-15' :
                       'Sample data'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Submit Button - Editable */}
        <div className="mt-8 flex justify-end">
          {editingField === 'submitButtonText' ? (
            <Input
              value={submitButtonText}
              onChange={(e) => handleUpdateReviewPage('submitButtonText', e.target.value)}
              onBlur={() => setEditingField(null)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
              autoFocus
              className="w-48 text-center border-blue-500"
            />
          ) : (
            <Button
              size="lg"
              className={cn(
                "px-8",
                onUpdateSettings && "hover:ring-2 hover:ring-blue-300"
              )}
              style={{ backgroundColor: themeColor }}
              onClick={() => onUpdateSettings && setEditingField('submitButtonText')}
            >
              {submitButtonText}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
