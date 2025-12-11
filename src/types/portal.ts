export type FieldType = 
  | 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'url' | 'address'
  | 'select' | 'multiselect' | 'radio' | 'checkbox' 
  | 'date' | 'datetime' | 'time' 
  | 'file' | 'image' | 'signature' | 'rating' | 'rank'
  | 'divider' | 'heading' | 'paragraph' | 'callout'
  | 'group' | 'repeater'

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
  sectionType?: 'form' | 'cover' | 'ending' | 'review'
  fields: Field[]
  translationKey?: string // Stable key for translations
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
  }
  /** 
   * Translations in new i18next format
   * Structure: { langCode: { portal: {...}, sections: {...}, fields: {...} } }
   * Also supports legacy format for backward compatibility: { langCode: { key: value } }
   */
  translations?: Record<string, Record<string, any>>
}
