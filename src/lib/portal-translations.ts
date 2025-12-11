/**
 * Portal Translations Utility
 * 
 * This module provides translation utilities for the portal system.
 * It supports both legacy (flat key-value) and new (i18next) formats.
 * 
 * NEW FORMAT (recommended):
 * {
 *   "es": {
 *     "portal": { "name": "...", "description": "..." },
 *     "sections": { "sectionId": { "title": "...", "description": "..." } },
 *     "fields": { "fieldId": { "label": "...", "placeholder": "...", "options": [...] } }
 *   }
 * }
 * 
 * LEGACY FORMAT (deprecated, auto-migrated):
 * {
 *   "es": {
 *     "portal_name": "...",
 *     "field_abc_label": "...",
 *     "section_xyz_title": "..."
 *   }
 * }
 */

import type { TranslationResource, PortalTranslations, FieldTranslation } from './i18n/types'
import { isLegacyFormat, migrateFromLegacyFormat, getFieldKey, getSectionKey } from './i18n/utils'

// ============================================
// Legacy Format Support (Deprecated)
// ============================================

/** @deprecated Use TranslationResource from i18n/types instead */
export type TranslationsMap = Record<string, string>

const labelKey = (fieldId: string) => `field_${fieldId}_label`
const placeholderKey = (fieldId: string) => `field_${fieldId}_placeholder`
const descriptionKey = (fieldId: string) => `field_${fieldId}_desc`
const optionKey = (fieldId: string, idx: number) => `field_${fieldId}_opt_${idx}`
const sectionTitleKey = (sectionId: string) => `section_${sectionId}_title`
const sectionDescKey = (sectionId: string) => `section_${sectionId}_desc`
const portalNameKey = 'portal_name'
const portalDescKey = 'portal_desc'

// ============================================
// Format Detection & Normalization
// ============================================

/**
 * Normalize translations to new format, handling both legacy and new formats
 */
export function normalizeTranslations(translations: any): PortalTranslations {
  if (!translations || Object.keys(translations).length === 0) {
    return {}
  }
  
  const firstLang = Object.keys(translations)[0]
  const firstValue = translations[firstLang]
  
  if (firstValue && isLegacyFormat(firstValue)) {
    return migrateFromLegacyFormat(translations)
  }
  
  return translations as PortalTranslations
}

/**
 * Check if translations are in legacy format
 */
export function isLegacyTranslations(translations: any): boolean {
  if (!translations || Object.keys(translations).length === 0) return false
  const firstLang = Object.keys(translations)[0]
  return isLegacyFormat(translations[firstLang])
}

// ============================================
// New Format Functions
// ============================================

/**
 * Collect translatable content in NEW format (i18next structure)
 */
export function collectTranslatableContentNew(config: any): TranslationResource {
  const resource: TranslationResource = {
    portal: {
      name: config.settings?.name || '',
      description: config.settings?.description
    },
    sections: {},
    fields: {},
    ui: {
      // Navigation
      previous: 'Previous',
      next: 'Next',
      nextSection: 'Next Section',
      reviewApplication: 'Review Application',
      saveAndExit: 'Save & Exit',
      submit: 'Submit',
      submitApplication: 'Submit Application',
      
      // Section titles
      reviewAndSubmit: 'Review & Submit',
      
      // Help section
      needHelp: 'Need Help?',
      contactUsDescription: 'Contact us for assistance with your application.',
      sendEmail: 'Send Email',
      
      // Form
      selectAnOption: 'Select an option',
      startTypingAddress: 'Start typing an address...',
      required: 'Required',
      optional: 'Optional',
      pleaseComplete: 'Please fill out all required fields to continue.',
      overallProgress: 'Overall Progress',
      complete: 'Complete',
      
      // Messages
      applicationSubmitted: 'Application Submitted!',
      thankYou: 'Thank you for your submission.',
    }
  }
  
  const collectField = (field: any) => {
    const fieldKey = getFieldKey(field)
    resource.fields[fieldKey] = {
      label: field.label || '',
      placeholder: field.placeholder,
      description: field.description
    }
    
    if (Array.isArray(field.options)) {
      resource.fields[fieldKey].options = field.options.map((opt: any) =>
        typeof opt === 'string' ? opt : opt.label || ''
      )
    }
    
    if (Array.isArray(field.children)) {
      field.children.forEach(collectField)
    }
  }
  
  ;(config.sections || []).forEach((section: any) => {
    const sectionKey = getSectionKey(section)
    resource.sections[sectionKey] = {
      title: section.title,
      description: section.description
    }
    ;(section.fields || []).forEach(collectField)
  })
  
  // Collect signup and login fields
  if (config.settings?.signupFields) {
    config.settings.signupFields.forEach(collectField)
  }
  if (config.settings?.loginFields) {
    config.settings.loginFields.forEach(collectField)
  }
  
  // Collect special page content
  if (config.settings?.signupPage) {
    resource.pages = resource.pages || {}
    resource.pages.signup = {
      title: config.settings.signupPage.title,
      description: config.settings.signupPage.description,
      buttonText: config.settings.signupPage.buttonText,
      loginLinkText: config.settings.signupPage.loginLinkText
    }
  }
  
  if (config.settings?.reviewPage) {
    resource.pages = resource.pages || {}
    resource.pages.review = {
      title: config.settings.reviewPage.title,
      description: config.settings.reviewPage.description,
      incompleteTitle: config.settings.reviewPage.incompleteTitle,
      incompleteMessage: config.settings.reviewPage.incompleteMessage,
      submitButtonText: config.settings.reviewPage.submitButtonText,
      editButtonText: config.settings.reviewPage.editButtonText
    }
  }
  
  if (config.settings?.endingPage) {
    resource.pages = resource.pages || {}
    resource.pages.ending = {
      title: config.settings.endingPage.title,
      description: config.settings.endingPage.description,
      dashboardButtonText: config.settings.endingPage.dashboardButtonText,
      submitAnotherButtonText: config.settings.endingPage.submitAnotherButtonText,
      footerMessage: config.settings.endingPage.footerMessage
    }
  }
  
  return resource
}

/**
 * Apply translations from NEW format to a field
 */
export function applyTranslationsToFieldNew(field: any, resource?: TranslationResource): any {
  if (!resource?.fields) return field
  
  const fieldKey = getFieldKey(field)
  const translation = resource.fields[fieldKey]
  
  if (!translation) return field
  
  const cloned = { ...field }
  
  if (translation.label) cloned.label = translation.label
  if (translation.placeholder) cloned.placeholder = translation.placeholder
  if (translation.description) cloned.description = translation.description
  
  if (translation.options && Array.isArray(field.options)) {
    cloned.options = field.options.map((opt: any, idx: number) => {
      const translatedOpt = translation.options?.[idx]
      if (!translatedOpt) return opt
      return typeof opt === 'string' ? translatedOpt : { ...opt, label: translatedOpt }
    })
  }
  
  if (Array.isArray(field.children)) {
    cloned.children = field.children.map((child: any) => applyTranslationsToFieldNew(child, resource))
  }
  
  return cloned
}

/**
 * Apply translations from NEW format to a section
 */
export function applyTranslationsToSectionNew(section: any, resource?: TranslationResource): any {
  if (!resource) return section
  
  const sectionKey = getSectionKey(section)
  const translation = resource.sections?.[sectionKey]
  
  return {
    ...section,
    title: translation?.title || section.title,
    description: translation?.description || section.description,
    fields: (section.fields || []).map((f: any) => applyTranslationsToFieldNew(f, resource))
  }
}

/**
 * Apply translations from NEW format to full config
 */
export function applyTranslationsToConfigNew(config: any, lang?: string): any {
  if (!lang) return config
  
  // Normalize translations to new format
  const translations = normalizeTranslations(config.translations || {})
  const resource = translations[lang]
  
  if (!resource) return config
  
  return {
    ...config,
    settings: {
      ...config.settings,
      name: resource.portal?.name || config.settings?.name,
      description: resource.portal?.description || config.settings?.description,
      signupFields: (config.settings?.signupFields || []).map((f: any) => applyTranslationsToFieldNew(f, resource)),
      loginFields: (config.settings?.loginFields || []).map((f: any) => applyTranslationsToFieldNew(f, resource))
    },
    sections: (config.sections || []).map((s: any) => applyTranslationsToSectionNew(s, resource))
  }
}

/**
 * Default English UI strings
 */
const DEFAULT_UI_STRINGS = {
  // Navigation
  previous: 'Previous',
  next: 'Next',
  nextSection: 'Next Section',
  reviewApplication: 'Review Application',
  saveAndExit: 'Save & Exit',
  submit: 'Submit',
  submitApplication: 'Submit Application',
  
  // Section titles
  reviewAndSubmit: 'Review & Submit',
  
  // Help section
  needHelp: 'Need Help?',
  contactUsDescription: 'Contact us for assistance with your application.',
  sendEmail: 'Send Email',
  
  // Form
  selectAnOption: 'Select an option',
  startTypingAddress: 'Start typing an address...',
  required: 'Required',
  optional: 'Optional',
  pleaseComplete: 'Please fill out all required fields to continue.',
  overallProgress: 'Overall Progress',
  complete: 'Complete',
  
  // Messages
  applicationSubmitted: 'Application Submitted!',
  thankYou: 'Thank you for your submission.',
}

/**
 * Get UI translations for the current language
 */
export function getUITranslations(config: any, lang?: string): typeof DEFAULT_UI_STRINGS {
  if (!lang) return DEFAULT_UI_STRINGS
  
  const translations = normalizeTranslations(config.translations || {})
  const resource = translations[lang]
  
  if (!resource?.ui) return DEFAULT_UI_STRINGS
  
  return {
    ...DEFAULT_UI_STRINGS,
    ...resource.ui
  }
}

/**
 * Default page strings for special pages
 */
const DEFAULT_PAGE_STRINGS = {
  signup: {
    title: 'Application Portal',
    description: 'Please sign up to continue your application.',
    buttonText: 'Create Account',
    loginLinkText: 'Already have an account?'
  },
  review: {
    title: 'Review & Submit',
    description: 'Review your application and submit when ready.',
    incompleteTitle: 'Application Incomplete',
    incompleteMessage: 'Please complete all required fields before submitting.',
    submitButtonText: 'Submit Application',
    editButtonText: 'Edit'
  },
  ending: {
    title: 'Thank You for Your Submission!',
    description: "We've received your application and will review it carefully. You'll hear from us soon via email.",
    dashboardButtonText: 'View Dashboard',
    submitAnotherButtonText: 'Submit Another',
    footerMessage: 'A confirmation email has been sent to your inbox.'
  }
}

/**
 * Get page translations for special pages (signup, review, ending)
 */
export function getPageTranslations(config: any, lang?: string): typeof DEFAULT_PAGE_STRINGS {
  // First, get values from config settings (if set by user)
  const settings = config.settings || {}
  const basePages = {
    signup: {
      ...DEFAULT_PAGE_STRINGS.signup,
      ...(settings.signupPage?.title && { title: settings.signupPage.title }),
      ...(settings.signupPage?.description && { description: settings.signupPage.description }),
      ...(settings.signupPage?.buttonText && { buttonText: settings.signupPage.buttonText }),
      ...(settings.signupPage?.loginLinkText && { loginLinkText: settings.signupPage.loginLinkText })
    },
    review: {
      ...DEFAULT_PAGE_STRINGS.review,
      ...(settings.reviewPage?.title && { title: settings.reviewPage.title }),
      ...(settings.reviewPage?.description && { description: settings.reviewPage.description }),
      ...(settings.reviewPage?.incompleteTitle && { incompleteTitle: settings.reviewPage.incompleteTitle }),
      ...(settings.reviewPage?.incompleteMessage && { incompleteMessage: settings.reviewPage.incompleteMessage }),
      ...(settings.reviewPage?.submitButtonText && { submitButtonText: settings.reviewPage.submitButtonText }),
      ...(settings.reviewPage?.editButtonText && { editButtonText: settings.reviewPage.editButtonText })
    },
    ending: {
      ...DEFAULT_PAGE_STRINGS.ending,
      ...(settings.endingPage?.title && { title: settings.endingPage.title }),
      ...(settings.endingPage?.description && { description: settings.endingPage.description }),
      ...(settings.endingPage?.dashboardButtonText && { dashboardButtonText: settings.endingPage.dashboardButtonText }),
      ...(settings.endingPage?.submitAnotherButtonText && { submitAnotherButtonText: settings.endingPage.submitAnotherButtonText }),
      ...(settings.endingPage?.footerMessage && { footerMessage: settings.endingPage.footerMessage })
    }
  }
  
  if (!lang) return basePages
  
  const translations = normalizeTranslations(config.translations || {})
  const resource = translations[lang]
  
  if (!resource?.pages) return basePages
  
  return {
    signup: { ...basePages.signup, ...resource.pages.signup },
    review: { ...basePages.review, ...resource.pages.review },
    ending: { ...basePages.ending, ...resource.pages.ending }
  }
}

/**
 * Update field translation in NEW format
 */
export function updateFieldTranslationNew(
  current: PortalTranslations,
  lang: string,
  fieldId: string,
  updates: Partial<FieldTranslation>
): PortalTranslations {
  const next = { ...current }
  
  if (!next[lang]) {
    next[lang] = { portal: { name: '' }, sections: {}, fields: {} }
  }
  
  const existing = next[lang].fields[fieldId] || { label: '' }
  
  next[lang] = {
    ...next[lang],
    fields: {
      ...next[lang].fields,
      [fieldId]: {
        ...existing,
        ...updates
      }
    }
  }
  
  return next
}

/**
 * Update section translation in NEW format
 */
export function updateSectionTranslationNew(
  current: PortalTranslations,
  lang: string,
  sectionId: string,
  updates: { title?: string; description?: string }
): PortalTranslations {
  const next = { ...current }
  
  if (!next[lang]) {
    next[lang] = { portal: { name: '' }, sections: {}, fields: {} }
  }
  
  const existing = next[lang].sections[sectionId] || { title: '' }
  
  next[lang] = {
    ...next[lang],
    sections: {
      ...next[lang].sections,
      [sectionId]: {
        ...existing,
        ...updates
      }
    }
  }
  
  return next
}

// ============================================
// Legacy Format Functions (Deprecated)
// Keep for backward compatibility during migration
// ============================================

/**
 * @deprecated Use collectTranslatableContentNew instead
 * Collect all translatable strings from the portal config in LEGACY format
 */
export function collectTranslatableContent(config: any): Record<string, string> {
  const contentToTranslate: Record<string, string> = {}

  contentToTranslate[portalNameKey] = config.settings?.name
  if (config.settings?.description) {
    contentToTranslate[portalDescKey] = config.settings.description
  }

  const collectField = (field: any) => {
    contentToTranslate[labelKey(field.id)] = field.label
    if (field.placeholder) {
      contentToTranslate[placeholderKey(field.id)] = field.placeholder
    }
    if (field.description) {
      contentToTranslate[descriptionKey(field.id)] = field.description
    }
    if (Array.isArray(field.options)) {
      field.options.forEach((opt: any, idx: number) => {
        const text = typeof opt === 'string' ? opt : opt.label
        contentToTranslate[optionKey(field.id, idx)] = text
      })
    }
    if (Array.isArray(field.children)) {
      field.children.forEach((child: any) => collectField(child))
    }
  }

  ;(config.sections || []).forEach((section: any) => {
    contentToTranslate[sectionTitleKey(section.id)] = section.title
    if (section.description) {
      contentToTranslate[sectionDescKey(section.id)] = section.description
    }
    (section.fields || []).forEach(collectField)
  })

  if (config.settings?.signupFields) {
    (config.settings.signupFields || []).forEach(collectField)
  }
  if (config.settings?.loginFields) {
    (config.settings.loginFields || []).forEach(collectField)
  }

  return contentToTranslate
}

/**
 * Apply translations to field - handles BOTH legacy and new formats
 */
export function applyTranslationsToField(field: any, translations?: TranslationsMap | TranslationResource): any {
  if (!translations) return field
  
  // Check if it's new format (has 'fields' property)
  if ('fields' in translations || 'portal' in translations) {
    return applyTranslationsToFieldNew(field, translations as TranslationResource)
  }
  
  // Legacy format
  const legacyTranslations = translations as TranslationsMap
  const cloned = { ...field }
  const label = legacyTranslations[labelKey(field.id)]
  const placeholder = legacyTranslations[placeholderKey(field.id)]
  const description = legacyTranslations[descriptionKey(field.id)]
  if (label) cloned.label = label
  if (placeholder) cloned.placeholder = placeholder
  if (description) cloned.description = description
  if (Array.isArray(field.options)) {
    cloned.options = field.options.map((opt: any, idx: number) => {
      const translation = legacyTranslations[optionKey(field.id, idx)]
      if (!translation) return opt
      
      if (typeof opt === 'string') {
        return translation
      } else {
        return { ...opt, label: translation }
      }
    })
  }
  if (Array.isArray(field.children)) {
    cloned.children = field.children.map((child: any) => applyTranslationsToField(child, legacyTranslations))
  }
  if (field.config?.content && legacyTranslations[labelKey(field.id)]) {
    cloned.config = { ...field.config }
  }
  return cloned
}

/**
 * Apply translations to section - handles BOTH legacy and new formats
 */
export function applyTranslationsToSection(section: any, translations?: TranslationsMap | TranslationResource): any {
  if (!translations) return section
  
  // Check if it's new format
  if ('sections' in translations || 'portal' in translations) {
    return applyTranslationsToSectionNew(section, translations as TranslationResource)
  }
  
  // Legacy format
  const legacyTranslations = translations as TranslationsMap
  return {
    ...section,
    title: legacyTranslations[sectionTitleKey(section.id)] || section.title,
    description: legacyTranslations[sectionDescKey(section.id)] || section.description,
    fields: (section.fields || []).map((f: any) => applyTranslationsToField(f, legacyTranslations)),
  }
}

/**
 * Apply translations to full config - handles BOTH legacy and new formats
 */
export function applyTranslationsToConfig(config: any, lang?: string): any {
  if (!lang) return config
  
  const rawTranslations = config.translations?.[lang]
  if (!rawTranslations) return config
  
  // Check if it's new format by looking for 'portal' or 'fields' keys
  const isNewFormat = rawTranslations.portal || rawTranslations.fields || rawTranslations.sections
  
  if (isNewFormat) {
    return applyTranslationsToConfigNew(config, lang)
  }
  
  // Legacy format
  const translations = rawTranslations as TranslationsMap
  return {
    ...config,
    settings: {
      ...config.settings,
      name: translations[portalNameKey] || config.settings.name,
      description: translations[portalDescKey] || config.settings.description,
      signupFields: (config.settings.signupFields || []).map((f: any) => applyTranslationsToField(f, translations)),
      loginFields: (config.settings.loginFields || []).map((f: any) => applyTranslationsToField(f, translations)),
    },
    sections: (config.sections || []).map((s: any) => applyTranslationsToSection(s, translations)),
  }
}

/**
 * @deprecated Use updateFieldTranslationNew instead
 */
export function updateTranslationsForField(
  current: Record<string, TranslationsMap>,
  lang: string,
  fieldId: string,
  updates: any,
  baseField: any
): Record<string, TranslationsMap> {
  const next = { ...current }
  const existing = { ...(next[lang] || {}) }

  if (typeof updates.label === 'string') existing[labelKey(fieldId)] = updates.label
  if (typeof updates.placeholder === 'string') existing[placeholderKey(fieldId)] = updates.placeholder
  if (typeof updates.description === 'string') existing[descriptionKey(fieldId)] = updates.description
  if (Array.isArray(updates.options)) {
    updates.options.forEach((opt: any, idx: number) => {
      const text = typeof opt === 'string' ? opt : opt.label
      existing[optionKey(fieldId, idx)] = text
    })
    if (Array.isArray(baseField?.options) && baseField.options.length > updates.options.length) {
      baseField.options.forEach((_: string, idx: number) => {
        if (idx >= updates.options.length) delete existing[optionKey(fieldId, idx)]
      })
    }
  }

  next[lang] = existing
  return next
}

/**
 * @deprecated Use updateSectionTranslationNew instead
 */
export function updateTranslationsForSection(
  current: Record<string, TranslationsMap>,
  lang: string,
  sectionId: string,
  updates: any
): Record<string, TranslationsMap> {
  const next = { ...current }
  const existing = { ...(next[lang] || {}) }

  if (typeof updates.title === 'string') existing[sectionTitleKey(sectionId)] = updates.title
  if (typeof updates.description === 'string') existing[sectionDescKey(sectionId)] = updates.description

  next[lang] = existing
  return next
}
