export type FieldType = 
  | 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'url' | 'address'
  | 'select' | 'multiselect' | 'radio' | 'checkbox'
  | 'date' | 'datetime' | 'time' 
  | 'file' | 'image' | 'signature' | 'rating' | 'rank'
  | 'divider' | 'heading' | 'paragraph' | 'callout'
  | 'group' | 'repeater'

// Import ending block type
import type { EndingBlock } from './ending-blocks'

export type Field = {
  id: string
  type: FieldType
  label: string
  description?: string
  placeholder?: string
  required: boolean
  options?: string[]
  width?: 'full' | 'half' | 'third' | 'quarter'
  sectionId?: string
  children?: Field[] // For groups and repeaters
  validation?: Record<string, any>
  translationKey?: string // Stable key for translations (survives field recreation)
  config?: {
    sourceField?: string
    sourceKey?: string
    [key: string]: any
  }
}

export type Section = {
  id: string
  title: string
  description?: string
  sectionType?: 'form' | 'cover' | 'ending' | 'review' | 'dashboard'
  fields: Field[]
  // NEW: Ending blocks for ending section type
  blocks?: EndingBlock[]
  translationKey?: string // Stable key for translations
  conditions?: Array<{
    fieldId: string
    operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'in' | 'notIn' | 'gt' | 'gte' | 'lt' | 'lte' | 'isEmpty' | 'isNotEmpty' | 'startsWith' | 'endsWith'
    value?: any
  }>
}

export type PortalConfig = {
  sections: Section[]
  settings: {
    name: string
    description?: string
    themeColor: string
    logoUrl: string
    font?: 'inter' | 'roboto' | 'serif' | 'mono'
    buttonStyle?: 'rounded' | 'pill' | 'sharp'
    authLayout?: 'split' | 'centered' | 'card'
    backgroundImageUrl?: string
    socialLogin?: boolean
    termsUrl?: string
    privacyUrl?: string
    loginFields: Field[]
    signupFields: Field[]
    language?: {
      default: string
      enabled: boolean
      supported: string[]
      rightToLeft?: boolean
      disableAutoTranslate?: boolean
    }
    // Special page settings
    signupPage?: {
      title?: string
      description?: string
      buttonText?: string
      loginLinkText?: string
    }
    reviewPage?: {
      title?: string
      description?: string
      incompleteTitle?: string
      incompleteMessage?: string
      submitButtonText?: string
      editButtonText?: string
    }
    endingPage?: {
      title?: string
      description?: string
      showDashboardButton?: boolean
      dashboardButtonText?: string
      showSubmitAnotherButton?: boolean
      submitAnotherButtonText?: string
      footerMessage?: string
      redirectUrl?: string
      redirectDelay?: number // seconds
    }
  }
  /** 
   * Translations in new i18next format
   * Structure: { langCode: { portal: {...}, sections: {...}, fields: {...} } }
   * Also supports legacy format for backward compatibility: { langCode: { key: value } }
   */
  translations?: Record<string, Record<string, any>>
}
