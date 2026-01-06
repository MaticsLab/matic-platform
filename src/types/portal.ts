export type FieldType = 
  | 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'url' | 'address'
  | 'select' | 'multiselect' | 'radio' | 'checkbox'
  | 'date' | 'datetime' | 'time' 
  | 'file' | 'image' | 'signature' | 'rating' | 'rank'
  | 'divider' | 'heading' | 'paragraph' | 'callout'
  | 'group' | 'repeater'
  | 'recommendation'

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
  // Cover section content (Novel editor JSON)
  content?: string
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
    loginPageImage?: string              // Image/video URL for login page split-screen
    signupPageImage?: string             // Image/video URL for signup page split-screen
    loginPageLogo?: string               // Logo specific to login page
    signupPageLogo?: string              // Logo specific to signup page
    loginImagePosition?: 'left' | 'right' // Position of background media on login page
    signupImagePosition?: 'left' | 'right' // Position of background media on signup page
    loginImageFocalPoint?: string        // CSS object-position for login media (e.g., "50% center")
    signupImageFocalPoint?: string       // CSS object-position for signup media (e.g., "50% center")
    loginPageMediaType?: 'image' | 'video' // Type of media for login page
    signupPageMediaType?: 'image' | 'video' // Type of media for signup page
    font?: 'inter' | 'roboto' | 'serif' | 'mono'
    buttonStyle?: 'rounded' | 'pill' | 'sharp'
    authLayout?: 'split' | 'centered' | 'card'
    backgroundImageUrl?: string
    socialLogin?: boolean
    // Form designer theme settings
    formTheme?: {
      questionsBackgroundColor?: string  // Background color for question cards
      primaryColor?: string              // Primary accent color (buttons, highlights)
      questionsColor?: string            // Color for question labels
      answersColor?: string              // Color for answer text/inputs
      showLogo?: boolean                 // Whether to show logo in form header
    }
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
    // Optional auth page titles
    signupTitle?: string
    loginTitle?: string
    // Special page settings
    loginPage?: {
      title?: string
      description?: string
      buttonText?: string
      signupLinkText?: string
      titleMargin?: Record<string, any>
      descriptionMargin?: Record<string, any>
    }
    signupPage?: {
      title?: string
      description?: string
      buttonText?: string
      loginLinkText?: string
      titleMargin?: Record<string, any>
      descriptionMargin?: Record<string, any>
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
    // Dashboard settings for the applicant dashboard
    dashboardSettings?: {
      showStatus?: boolean
      showTimeline?: boolean
      showChat?: boolean
      showDocuments?: boolean
      welcomeTitle?: string
      welcomeText?: string
      tasks?: import('./tasks').DashboardTask[]
    }
    // Email settings for outbound emails (recommendations, notifications)
    emailSettings?: {
      senderName?: string          // Custom sender name (e.g., "Scholarship Office")
      replyToEmail?: string        // Optional reply-to email address
    }
  }
  /** 
   * Translations in new i18next format
   * Structure: { langCode: { portal: {...}, sections: {...}, fields: {...} } }
   * Also supports legacy format for backward compatibility: { langCode: { key: value } }
   */
  translations?: Record<string, Record<string, any>>
}
