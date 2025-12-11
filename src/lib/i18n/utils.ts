/**
 * i18n Utility Functions
 * 
 * Helper functions for translation key generation, format migration,
 * and other translation-related utilities.
 */

import type { 
  TranslationResource, 
  PortalTranslations,
  FieldTranslation,
  SectionTranslation,
  LegacyTranslationsMap
} from './types'

// ============================================
// Legacy Key Patterns (for migration)
// ============================================

const LEGACY_PATTERNS = {
  fieldLabel: /^field_(.+)_label$/,
  fieldPlaceholder: /^field_(.+)_placeholder$/,
  fieldDesc: /^field_(.+)_desc$/,
  fieldOption: /^field_(.+)_opt_(\d+)$/,
  sectionTitle: /^section_(.+)_title$/,
  sectionDesc: /^section_(.+)_desc$/,
  portalName: /^portal_name$/,
  portalDesc: /^portal_desc$/
}

/**
 * Check if a translation object is in legacy format (flat key-value)
 */
export function isLegacyFormat(translations: any): boolean {
  if (!translations || typeof translations !== 'object') return false
  
  // Check for legacy key patterns
  const keys = Object.keys(translations)
  if (keys.length === 0) return false
  
  // Legacy format has flat string values, new format has nested objects
  const firstValue = translations[keys[0]]
  
  // If the first value is a string, it's likely legacy format
  if (typeof firstValue === 'string') {
    // Additional check: look for legacy key patterns
    return keys.some(key => 
      LEGACY_PATTERNS.fieldLabel.test(key) ||
      LEGACY_PATTERNS.sectionTitle.test(key) ||
      LEGACY_PATTERNS.portalName.test(key)
    )
  }
  
  return false
}

/**
 * Migrate a single language's translations from legacy to new format
 */
export function migrateLegacyLanguage(legacy: LegacyTranslationsMap): TranslationResource {
  const result: TranslationResource = {
    portal: { name: '' },
    sections: {},
    fields: {}
  }
  
  // Group options by field ID for later processing
  const fieldOptions: Record<string, { index: number; value: string }[]> = {}
  
  for (const [key, value] of Object.entries(legacy)) {
    // Portal name
    if (LEGACY_PATTERNS.portalName.test(key)) {
      result.portal.name = value
      continue
    }
    
    // Portal description
    if (LEGACY_PATTERNS.portalDesc.test(key)) {
      result.portal.description = value
      continue
    }
    
    // Section title
    const sectionTitleMatch = key.match(LEGACY_PATTERNS.sectionTitle)
    if (sectionTitleMatch) {
      const sectionId = sectionTitleMatch[1]
      if (!result.sections[sectionId]) {
        result.sections[sectionId] = { title: '' }
      }
      result.sections[sectionId].title = value
      continue
    }
    
    // Section description
    const sectionDescMatch = key.match(LEGACY_PATTERNS.sectionDesc)
    if (sectionDescMatch) {
      const sectionId = sectionDescMatch[1]
      if (!result.sections[sectionId]) {
        result.sections[sectionId] = { title: '' }
      }
      result.sections[sectionId].description = value
      continue
    }
    
    // Field label
    const fieldLabelMatch = key.match(LEGACY_PATTERNS.fieldLabel)
    if (fieldLabelMatch) {
      const fieldId = fieldLabelMatch[1]
      if (!result.fields[fieldId]) {
        result.fields[fieldId] = { label: '' }
      }
      result.fields[fieldId].label = value
      continue
    }
    
    // Field placeholder
    const fieldPlaceholderMatch = key.match(LEGACY_PATTERNS.fieldPlaceholder)
    if (fieldPlaceholderMatch) {
      const fieldId = fieldPlaceholderMatch[1]
      if (!result.fields[fieldId]) {
        result.fields[fieldId] = { label: '' }
      }
      result.fields[fieldId].placeholder = value
      continue
    }
    
    // Field description
    const fieldDescMatch = key.match(LEGACY_PATTERNS.fieldDesc)
    if (fieldDescMatch) {
      const fieldId = fieldDescMatch[1]
      if (!result.fields[fieldId]) {
        result.fields[fieldId] = { label: '' }
      }
      result.fields[fieldId].description = value
      continue
    }
    
    // Field options
    const fieldOptionMatch = key.match(LEGACY_PATTERNS.fieldOption)
    if (fieldOptionMatch) {
      const fieldId = fieldOptionMatch[1]
      const optionIndex = parseInt(fieldOptionMatch[2], 10)
      
      if (!fieldOptions[fieldId]) {
        fieldOptions[fieldId] = []
      }
      fieldOptions[fieldId].push({ index: optionIndex, value })
      continue
    }
  }
  
  // Process collected options (sort by index)
  for (const [fieldId, options] of Object.entries(fieldOptions)) {
    if (!result.fields[fieldId]) {
      result.fields[fieldId] = { label: '' }
    }
    
    // Sort by index and extract values
    const sortedOptions = options
      .sort((a, b) => a.index - b.index)
      .map(o => o.value)
    
    result.fields[fieldId].options = sortedOptions
  }
  
  return result
}

/**
 * Migrate all translations from legacy format to new format
 */
export function migrateFromLegacyFormat(
  legacy: Record<string, LegacyTranslationsMap>
): PortalTranslations {
  const result: PortalTranslations = {}
  
  for (const [langCode, translations] of Object.entries(legacy)) {
    result[langCode] = migrateLegacyLanguage(translations)
  }
  
  return result
}

// ============================================
// Key Generation Utilities
// ============================================

/**
 * Generate a stable translation key from text content
 * Uses a simple slug approach for human-readable keys
 */
export function generateTranslationKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50)
}

/**
 * Generate a unique field translation key
 * Prefers translationKey if available, falls back to ID
 */
export function getFieldKey(field: { id: string; translationKey?: string }): string {
  return field.translationKey || field.id
}

/**
 * Generate a unique section translation key
 */
export function getSectionKey(section: { id: string; translationKey?: string }): string {
  return section.translationKey || section.id
}

// ============================================
// Translation Resource Builders
// ============================================

/**
 * Build a translation resource from portal config
 */
export function buildTranslationResource(config: {
  settings?: { name?: string; description?: string }
  sections?: Array<{ id: string; title: string; description?: string; fields?: any[] }>
  settings_signupFields?: any[]
  settings_loginFields?: any[]
}): TranslationResource {
  const resource: TranslationResource = {
    portal: {
      name: config.settings?.name || '',
      description: config.settings?.description
    },
    sections: {},
    fields: {}
  }
  
  // Process sections
  for (const section of config.sections || []) {
    const sectionKey = getSectionKey(section)
    resource.sections[sectionKey] = {
      title: section.title,
      description: section.description
    }
    
    // Process fields in section
    for (const field of section.fields || []) {
      processField(field, resource.fields)
    }
  }
  
  return resource
}

/**
 * Process a field and add it to the fields record
 */
function processField(
  field: any,
  fields: Record<string, FieldTranslation>
): void {
  const fieldKey = getFieldKey(field)
  
  fields[fieldKey] = {
    label: field.label || '',
    placeholder: field.placeholder,
    description: field.description
  }
  
  // Handle options
  if (Array.isArray(field.options)) {
    fields[fieldKey].options = field.options.map((opt: any) =>
      typeof opt === 'string' ? opt : opt.label || ''
    )
  }
  
  // Handle nested children (for groups/repeaters)
  if (Array.isArray(field.children)) {
    for (const child of field.children) {
      processField(child, fields)
    }
  }
}

// ============================================
// Translation Application Utilities
// ============================================

/**
 * Apply translations to a field object
 */
export function applyFieldTranslation(
  field: any,
  translation: FieldTranslation | undefined
): any {
  if (!translation) return field
  
  const result = { ...field }
  
  if (translation.label) result.label = translation.label
  if (translation.placeholder) result.placeholder = translation.placeholder
  if (translation.description) result.description = translation.description
  
  if (translation.options && Array.isArray(field.options)) {
    result.options = field.options.map((opt: any, idx: number) => {
      const translatedOpt = translation.options?.[idx]
      if (!translatedOpt) return opt
      
      if (typeof opt === 'string') {
        return translatedOpt
      } else {
        return { ...opt, label: translatedOpt }
      }
    })
  }
  
  // Handle children
  if (Array.isArray(field.children)) {
    result.children = field.children.map((child: any) => {
      // For children, we need to look up their translation by their key
      // This is a limitation - we'd need the full translations object here
      return child
    })
  }
  
  return result
}

/**
 * Apply translations to a section object
 */
export function applySectionTranslation(
  section: any,
  translation: SectionTranslation | undefined
): any {
  if (!translation) return section
  
  return {
    ...section,
    title: translation.title || section.title,
    description: translation.description || section.description
  }
}

// ============================================
// RTL Detection
// ============================================

const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'sd']

/**
 * Check if a language code is RTL
 */
export function isRTLLanguage(langCode: string): boolean {
  return RTL_LANGUAGES.includes(langCode.toLowerCase().split('-')[0])
}

// ============================================
// Validation Utilities
// ============================================

/**
 * Validate a translation resource structure
 */
export function validateTranslationResource(resource: any): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!resource || typeof resource !== 'object') {
    errors.push('Translation resource must be an object')
    return { valid: false, errors }
  }
  
  if (!resource.portal || typeof resource.portal !== 'object') {
    errors.push('Missing or invalid "portal" property')
  }
  
  if (!resource.sections || typeof resource.sections !== 'object') {
    errors.push('Missing or invalid "sections" property')
  }
  
  if (!resource.fields || typeof resource.fields !== 'object') {
    errors.push('Missing or invalid "fields" property')
  }
  
  return { valid: errors.length === 0, errors }
}

/**
 * Calculate translation coverage percentage
 */
export function calculateTranslationCoverage(
  original: TranslationResource,
  translated: TranslationResource
): number {
  let totalFields = 0
  let translatedFields = 0
  
  // Count portal fields
  if (original.portal.name) {
    totalFields++
    if (translated.portal?.name) translatedFields++
  }
  if (original.portal.description) {
    totalFields++
    if (translated.portal?.description) translatedFields++
  }
  
  // Count section fields
  for (const [key, section] of Object.entries(original.sections)) {
    if (section.title) {
      totalFields++
      if (translated.sections?.[key]?.title) translatedFields++
    }
    if (section.description) {
      totalFields++
      if (translated.sections?.[key]?.description) translatedFields++
    }
  }
  
  // Count field translations
  for (const [key, field] of Object.entries(original.fields)) {
    if (field.label) {
      totalFields++
      if (translated.fields?.[key]?.label) translatedFields++
    }
    if (field.placeholder) {
      totalFields++
      if (translated.fields?.[key]?.placeholder) translatedFields++
    }
    if (field.description) {
      totalFields++
      if (translated.fields?.[key]?.description) translatedFields++
    }
    if (field.options) {
      totalFields += field.options.length
      translatedFields += translated.fields?.[key]?.options?.length || 0
    }
  }
  
  if (totalFields === 0) return 100
  return Math.round((translatedFields / totalFields) * 100)
}
