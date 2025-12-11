/**
 * i18next Configuration and Initialization
 * 
 * This module sets up i18next for the portal translation system.
 * It uses a dynamic resource loading approach since portal translations
 * are stored in the database, not static files.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import type { TranslationResource, PortalTranslations } from './types'

// Default English fallback resource
const defaultResource: TranslationResource = {
  portal: {
    name: 'Application Portal',
    description: 'Complete your application'
  },
  sections: {},
  fields: {}
}

// Initialize i18next with minimal configuration
// Resources are added dynamically per portal
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Default language
    lng: 'en',
    fallbackLng: 'en',
    
    // Default namespace
    defaultNS: 'portal',
    ns: ['portal'],
    
    // Start with empty resources - will be populated per portal
    resources: {
      en: {
        portal: defaultResource
      }
    },
    
    // Interpolation settings
    interpolation: {
      escapeValue: false // React already escapes
    },
    
    // Detection options
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'portal_language',
      caches: ['localStorage']
    },
    
    // React options
    react: {
      useSuspense: false // Don't suspend on missing translations
    },
    
    // Return empty string for missing keys (we handle fallback manually)
    returnEmptyString: false,
    returnNull: false,
    
    // Key separator for nested keys (e.g., 'fields.email.label')
    keySeparator: '.',
    nsSeparator: ':'
  })

/**
 * Load portal-specific translations into i18next
 * Call this when a portal is loaded
 */
export function loadPortalTranslations(
  translations: PortalTranslations,
  defaultLanguage: string = 'en'
): void {
  // Clear existing portal resources
  const languages = Object.keys(translations)
  
  // Add each language's translations
  languages.forEach(langCode => {
    const resource = translations[langCode]
    if (resource) {
      i18n.addResourceBundle(langCode, 'portal', resource, true, true)
    }
  })
  
  // Set the default language if not already set
  if (i18n.language !== defaultLanguage && languages.includes(defaultLanguage)) {
    i18n.changeLanguage(defaultLanguage)
  }
}

/**
 * Clear all portal translations (when switching portals)
 */
export function clearPortalTranslations(): void {
  const languages = i18n.languages || ['en']
  languages.forEach(lang => {
    i18n.removeResourceBundle(lang, 'portal')
  })
  
  // Reset to default
  i18n.addResourceBundle('en', 'portal', defaultResource, true, true)
  i18n.changeLanguage('en')
}

/**
 * Add a single language translation
 */
export function addLanguageTranslation(
  langCode: string,
  resource: TranslationResource
): void {
  i18n.addResourceBundle(langCode, 'portal', resource, true, true)
}

/**
 * Remove a language translation
 */
export function removeLanguageTranslation(langCode: string): void {
  i18n.removeResourceBundle(langCode, 'portal')
}

/**
 * Get current language
 */
export function getCurrentLanguage(): string {
  return i18n.language || 'en'
}

/**
 * Change current language
 */
export function changeLanguage(langCode: string): Promise<void> {
  return i18n.changeLanguage(langCode).then(() => {})
}

/**
 * Check if a language has translations loaded
 */
export function hasLanguage(langCode: string): boolean {
  return i18n.hasResourceBundle(langCode, 'portal')
}

/**
 * Get all loaded language codes
 */
export function getLoadedLanguages(): string[] {
  return Object.keys(i18n.services.resourceStore.data || {})
}

export default i18n
