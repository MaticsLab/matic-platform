'use client'

import { useState } from 'react'
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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signupData, setSignupData] = useState<Record<string, any>>({})

  return (
    <AuthPageRenderer
      type="signup"
      config={config}
      email={email}
      password={password}
      signupData={signupData}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSignupDataChange={setSignupData}
      onSelectField={onSelectField}
      selectedFieldId={selectedFieldId}
      onUpdateSettings={onUpdateSettings}
      isPreview={true}
    />
  )
}
