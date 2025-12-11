/**
 * i18n Type Definitions for Portal Translation System
 * 
 * This module defines the TypeScript interfaces for the structured
 * translation system based on react-i18next patterns.
 */

/**
 * Translation for a single field (label, placeholder, description, options)
 */
export interface FieldTranslation {
  label: string
  placeholder?: string
  description?: string
  options?: string[] // For select, radio, checkbox options
}

/**
 * Translation for a section (title and description)
 */
export interface SectionTranslation {
  title: string
  description?: string
}

/**
 * Portal-level translations (name and description)
 */
export interface PortalTranslation {
  name: string
  description?: string
}

/**
 * UI strings that are common across the portal
 */
export interface UITranslations {
  // Navigation
  previous?: string
  next?: string
  nextSection?: string
  reviewApplication?: string
  saveAndExit?: string
  submit?: string
  submitApplication?: string
  
  // Section titles
  reviewAndSubmit?: string
  
  // Help section
  needHelp?: string
  contactUsDescription?: string
  sendEmail?: string
  
  // Form
  selectAnOption?: string
  startTypingAddress?: string
  required?: string
  optional?: string
  pleaseComplete?: string
  overallProgress?: string
  complete?: string
  
  // Messages
  applicationSubmitted?: string
  thankYou?: string
  
  // Allow additional custom keys
  [key: string]: string | undefined
}

/**
 * Page-specific translations (signup, review, ending pages)
 */
export interface PageTranslations {
  signup?: {
    title?: string
    description?: string
    buttonText?: string
    loginLinkText?: string
  }
  review?: {
    title?: string
    description?: string
    incompleteTitle?: string
    incompleteMessage?: string
    submitButtonText?: string
    editButtonText?: string
  }
  ending?: {
    title?: string
    description?: string
    dashboardButtonText?: string
    submitAnotherButtonText?: string
    footerMessage?: string
  }
}

/**
 * Complete translation resource for a single language
 * Following i18next namespace convention
 */
export interface TranslationResource {
  portal: PortalTranslation
  sections: Record<string, SectionTranslation>
  fields: Record<string, FieldTranslation>
  ui?: UITranslations
  pages?: PageTranslations
}

/**
 * All translations for a portal, keyed by language code
 */
export type PortalTranslations = Record<string, TranslationResource>

/**
 * Status of a translation entry
 */
export type TranslationStatus = 'auto' | 'reviewed' | 'needs_review'

/**
 * Extended translation entry with metadata (for future use)
 */
export interface TranslationEntry {
  value: string
  status: TranslationStatus
  updatedAt?: string
  updatedBy?: string
}

/**
 * Language configuration
 */
export interface LanguageConfig {
  code: string
  name: string
  nativeName: string
  isRTL: boolean
  locale?: string // Full locale code (e.g., 'es-ES')
}

/**
 * Portal language settings
 */
export interface PortalLanguageSettings {
  default: string
  enabled: boolean
  supported: string[]
  rightToLeft?: boolean
  disableAutoTranslate?: boolean
}

/**
 * Legacy translation format (for migration)
 * @deprecated Use TranslationResource instead
 */
export type LegacyTranslationsMap = Record<string, string>

/**
 * Legacy translations structure (for migration)
 * @deprecated Use PortalTranslations instead
 */
export type LegacyPortalTranslations = Record<string, LegacyTranslationsMap>

/**
 * Translation request sent to AI service
 */
export interface TranslationRequest {
  content: TranslationResource
  targetLanguage: string
  sourceLanguage?: string
}

/**
 * Translation response from AI service
 */
export interface TranslationResponse {
  translations: TranslationResource
  metadata?: {
    model: string
    processingTime: number
    tokenCount?: number
  }
}

/**
 * Field with optional translation key for stable identification
 */
export interface TranslatableField {
  id: string
  translationKey?: string // Stable key for translations (e.g., 'fullName', 'email')
  label: string
  placeholder?: string
  description?: string
  options?: string[] | { label: string; value: string }[]
}

/**
 * Section with optional translation key
 */
export interface TranslatableSection {
  id: string
  translationKey?: string // Stable key for translations
  title: string
  description?: string
}

/**
 * Utility type to extract translation keys from a resource
 */
export type TranslationKeys<T extends TranslationResource> = {
  portal: keyof T['portal']
  sections: string
  fields: string
}

/**
 * i18next namespace definition for type-safe translations
 */
export interface I18nNamespaces {
  portal: TranslationResource
}
