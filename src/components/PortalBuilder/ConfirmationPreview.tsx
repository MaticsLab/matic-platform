'use client'

import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/ui-components/button'
import { PortalConfig } from '@/types/portal'
import { cn } from '@/lib/utils'

interface ConfirmationPreviewProps {
  config: PortalConfig
  onEdit?: () => void
}

export function ConfirmationPreview({ config, onEdit }: ConfirmationPreviewProps) {
  const { settings } = config
  const themeColor = settings.themeColor || '#3B82F6'

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
          <div
            onClick={onEdit}
            className={cn(
              "space-y-4 rounded-lg transition-all",
              onEdit ? "cursor-pointer hover:bg-gray-50 p-4 -m-4" : ""
            )}
          >
            <h1 className="text-3xl font-bold text-gray-900">
              Thank You for Your Submission!
            </h1>
            <p className="text-lg text-gray-600 max-w-xl mx-auto">
              We've received your application and will review it carefully. You'll hear from us soon via email.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex gap-4 justify-center">
            <Button
              variant="outline"
              className="px-6"
            >
              View Dashboard
            </Button>
            <Button
              className="px-6"
              style={{ backgroundColor: themeColor }}
            >
              Submit Another
            </Button>
          </div>

          {/* Footer Info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              A confirmation email has been sent to your inbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
