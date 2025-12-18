'use client'

import { AuthPageRenderer } from '@/components/Portal/AuthPageRenderer'
import { PortalConfig } from '@/types/portal'

interface SignUpPreviewProps {
  config: PortalConfig
  onSelectField?: (fieldId: string) => void
  selectedFieldId?: string | null
  onUpdateSettings?: (updates: Partial<PortalConfig['settings']>) => void
  formId?: string
}

export function SignUpPreview({ config, onSelectField, selectedFieldId, onUpdateSettings, formId }: SignUpPreviewProps) {
  return (
    <AuthPageRenderer
      type="signup"
      config={config}
      onSelectField={onSelectField}
      selectedFieldId={selectedFieldId}
      onUpdateSettings={onUpdateSettings}
      isPreview={true}
    />
  )
}
