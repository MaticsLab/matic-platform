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
}

export function ReviewPreview({ config, onEdit }: ReviewPreviewProps) {
  const { settings } = config
  const themeColor = settings.themeColor || '#3B82F6'
  
  // State for editable content
  const [title, setTitle] = useState('Review & Submit')
  const [description, setDescription] = useState('Review your application and submit when ready.')
  const [incompleteMessage, setIncompleteMessage] = useState('18 of 27 required fields completed. Please complete all sections before submitting.')
  const [isEditing, setIsEditing] = useState(false)

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
        <div
          onClick={() => setIsEditing(!isEditing)}
          className={cn(
            "mb-6 rounded-lg transition-all",
            onEdit ? "cursor-pointer hover:bg-white p-4 -m-4" : ""
          )}
        >
          {isEditing ? (
            <div className="space-y-3 bg-white p-4 rounded-lg border-2 border-blue-500">
              <div>
                <Label className="text-xs text-gray-500">Page Title</Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Description</Label>
                <Input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button size="sm" onClick={() => setIsEditing(false)}>Done</Button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
              <p className="text-gray-600 mt-2">{description}</p>
            </>
          )}
        </div>

        {/* Incomplete Warning - Editable */}
        <div
          onClick={onEdit}
          className={cn(
            "bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 transition-all",
            onEdit ? "cursor-pointer hover:shadow-md hover:border-orange-300" : ""
          )}
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 mb-1">Application Incomplete</h3>
              <p className="text-sm text-orange-700">
                {incompleteMessage}
              </p>
            </div>
          </div>
        </div>

        {/* Review Sections */}
        <div className="space-y-4">
          {config.sections.filter(s => s.sectionType === 'form').map((section, idx) => (
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
                <Button variant="ghost" size="sm" style={{ color: themeColor }}>
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </Button>
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

        {/* Submit Button */}
        <div className="mt-8 flex justify-end">
          <Button
            size="lg"
            className="px-8"
            style={{ backgroundColor: themeColor }}
            disabled
          >
            Submit Application
          </Button>
        </div>
      </div>
    </div>
  )
}
