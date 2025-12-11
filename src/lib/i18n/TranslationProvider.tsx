'use client'

/**
 * TranslationProvider Component
 * 
 * A React context provider that manages portal-specific translations.
 * This wraps portal components and handles loading translations from
 * the portal configuration.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { I18nextProvider, useTranslation } from 'react-i18next'
import i18n, { loadPortalTranslations, clearPortalTranslations, changeLanguage } from './index'
import type { PortalTranslations, TranslationResource, PortalLanguageSettings } from './types'
import { migrateFromLegacyFormat, isLegacyFormat } from './utils'

interface TranslationContextValue {
  /** Current active language code */
  activeLanguage: string
  /** Default language code */
  defaultLanguage: string
  /** List of supported language codes */
  supportedLanguages: string[]
  /** Whether translations are enabled for this portal */
  isEnabled: boolean
  /** Whether RTL mode is active */
  isRTL: boolean
  /** Change the active language */
  setLanguage: (langCode: string) => void
  /** Get a translated string for a field */
  translateField: (fieldId: string, property: 'label' | 'placeholder' | 'description') => string | undefined
  /** Get translated options for a field */
  translateOptions: (fieldId: string) => string[] | undefined
  /** Get a translated section property */
  translateSection: (sectionId: string, property: 'title' | 'description') => string | undefined
  /** Get portal-level translation */
  translatePortal: (property: 'name' | 'description') => string | undefined
  /** Raw translation resources */
  translations: PortalTranslations
  /** Whether translations are still loading */
  isLoading: boolean
}

const TranslationContext = createContext<TranslationContextValue | null>(null)

interface TranslationProviderProps {
  children: React.ReactNode
  /** Portal translations - can be in new or legacy format */
  translations?: PortalTranslations | Record<string, Record<string, string>>
  /** Language settings from portal config */
  languageSettings?: PortalLanguageSettings
  /** Initial language to use */
  initialLanguage?: string
}

export function TranslationProvider({
  children,
  translations: rawTranslations,
  languageSettings,
  initialLanguage
}: TranslationProviderProps) {
  const defaultLanguage = languageSettings?.default || initialLanguage || 'en'
  const [activeLanguage, setActiveLanguage] = useState(defaultLanguage)
  const [isLoading, setIsLoading] = useState(true)
  
  // Normalize translations (handle legacy format migration)
  const translations = useMemo<PortalTranslations>(() => {
    if (!rawTranslations || Object.keys(rawTranslations).length === 0) {
      return {}
    }
    
    // Check if any language uses legacy format
    const firstLang = Object.keys(rawTranslations)[0]
    const firstValue = rawTranslations[firstLang]
    
    if (firstValue && isLegacyFormat(firstValue)) {
      // Migrate from legacy format
      return migrateFromLegacyFormat(rawTranslations as Record<string, Record<string, string>>)
    }
    
    return rawTranslations as PortalTranslations
  }, [rawTranslations])
  
  // Compute supported languages
  const supportedLanguages = useMemo(() => {
    const langs = new Set<string>([defaultLanguage])
    
    if (languageSettings?.supported) {
      languageSettings.supported.forEach(l => langs.add(l))
    }
    
    Object.keys(translations).forEach(l => langs.add(l))
    
    return Array.from(langs)
  }, [defaultLanguage, languageSettings?.supported, translations])
  
  // Load translations into i18next when they change
  useEffect(() => {
    setIsLoading(true)
    
    if (Object.keys(translations).length > 0) {
      loadPortalTranslations(translations, defaultLanguage)
    }
    
    setIsLoading(false)
    
    return () => {
      clearPortalTranslations()
    }
  }, [translations, defaultLanguage])
  
  // Handle language change
  const setLanguage = useCallback((langCode: string) => {
    if (supportedLanguages.includes(langCode)) {
      setActiveLanguage(langCode)
      changeLanguage(langCode)
    }
  }, [supportedLanguages])
  
  // Translation helper functions
  const translateField = useCallback((
    fieldId: string,
    property: 'label' | 'placeholder' | 'description'
  ): string | undefined => {
    if (activeLanguage === defaultLanguage) return undefined
    
    const langTranslations = translations[activeLanguage]
    if (!langTranslations?.fields?.[fieldId]) return undefined
    
    return langTranslations.fields[fieldId][property]
  }, [activeLanguage, defaultLanguage, translations])
  
  const translateOptions = useCallback((fieldId: string): string[] | undefined => {
    if (activeLanguage === defaultLanguage) return undefined
    
    const langTranslations = translations[activeLanguage]
    if (!langTranslations?.fields?.[fieldId]) return undefined
    
    return langTranslations.fields[fieldId].options
  }, [activeLanguage, defaultLanguage, translations])
  
  const translateSection = useCallback((
    sectionId: string,
    property: 'title' | 'description'
  ): string | undefined => {
    if (activeLanguage === defaultLanguage) return undefined
    
    const langTranslations = translations[activeLanguage]
    if (!langTranslations?.sections?.[sectionId]) return undefined
    
    return langTranslations.sections[sectionId][property]
  }, [activeLanguage, defaultLanguage, translations])
  
  const translatePortal = useCallback((
    property: 'name' | 'description'
  ): string | undefined => {
    if (activeLanguage === defaultLanguage) return undefined
    
    const langTranslations = translations[activeLanguage]
    if (!langTranslations?.portal) return undefined
    
    return langTranslations.portal[property]
  }, [activeLanguage, defaultLanguage, translations])
  
  // Check RTL
  const isRTL = useMemo(() => {
    const rtlLanguages = ['ar', 'he', 'fa', 'ur']
    return languageSettings?.rightToLeft || rtlLanguages.includes(activeLanguage)
  }, [activeLanguage, languageSettings?.rightToLeft])
  
  const contextValue: TranslationContextValue = {
    activeLanguage,
    defaultLanguage,
    supportedLanguages,
    isEnabled: languageSettings?.enabled ?? false,
    isRTL,
    setLanguage,
    translateField,
    translateOptions,
    translateSection,
    translatePortal,
    translations,
    isLoading
  }
  
  return (
    <TranslationContext.Provider value={contextValue}>
      <I18nextProvider i18n={i18n}>
        {children}
      </I18nextProvider>
    </TranslationContext.Provider>
  )
}

/**
 * Hook to access translation context
 */
export function useTranslationContext(): TranslationContextValue {
  const context = useContext(TranslationContext)
  
  if (!context) {
    // Return a default context for components outside provider
    return {
      activeLanguage: 'en',
      defaultLanguage: 'en',
      supportedLanguages: ['en'],
      isEnabled: false,
      isRTL: false,
      setLanguage: () => {},
      translateField: () => undefined,
      translateOptions: () => undefined,
      translateSection: () => undefined,
      translatePortal: () => undefined,
      translations: {},
      isLoading: false
    }
  }
  
  return context
}

export { TranslationContext }
