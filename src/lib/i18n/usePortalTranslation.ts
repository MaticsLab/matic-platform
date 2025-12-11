'use client'

/**
 * usePortalTranslation Hook
 * 
 * A custom hook that provides convenient translation utilities
 * for portal components. Wraps react-i18next's useTranslation
 * with portal-specific functionality.
 */

import { useMemo, useCallback } from 'react'
import { useTranslationContext } from './TranslationProvider'
import type { TranslationResource, FieldTranslation, SectionTranslation } from './types'
import { applyFieldTranslation, applySectionTranslation, getFieldKey, getSectionKey } from './utils'

interface UsePortalTranslationResult {
  // Language state
  activeLanguage: string
  defaultLanguage: string
  supportedLanguages: string[]
  isEnabled: boolean
  isRTL: boolean
  isLoading: boolean
  
  // Language control
  setLanguage: (langCode: string) => void
  
  // Translation functions
  t: {
    field: (fieldId: string, property?: 'label' | 'placeholder' | 'description') => string | undefined
    fieldOptions: (fieldId: string) => string[] | undefined
    section: (sectionId: string, property?: 'title' | 'description') => string | undefined
    portal: (property: 'name' | 'description') => string | undefined
  }
  
  // Apply translations to objects
  applyToField: <T extends { id: string; label: string }>(field: T) => T
  applyToSection: <T extends { id: string; title: string }>(section: T) => T
  applyToConfig: <T extends { sections?: any[]; settings?: any }>(config: T) => T
  
  // Get current language's resource
  getCurrentResource: () => TranslationResource | undefined
}

/**
 * Hook for accessing portal translations
 */
export function usePortalTranslation(): UsePortalTranslationResult {
  const context = useTranslationContext()
  
  // Get current language resource
  const getCurrentResource = useCallback((): TranslationResource | undefined => {
    return context.translations[context.activeLanguage]
  }, [context.translations, context.activeLanguage])
  
  // Translation helper object
  const t = useMemo(() => ({
    field: (fieldId: string, property: 'label' | 'placeholder' | 'description' = 'label') => {
      return context.translateField(fieldId, property)
    },
    fieldOptions: (fieldId: string) => {
      return context.translateOptions(fieldId)
    },
    section: (sectionId: string, property: 'title' | 'description' = 'title') => {
      return context.translateSection(sectionId, property)
    },
    portal: (property: 'name' | 'description') => {
      return context.translatePortal(property)
    }
  }), [context])
  
  // Apply translations to a field
  const applyToField = useCallback(<T extends { id: string; label: string }>(field: T): T => {
    if (!context.isEnabled || context.activeLanguage === context.defaultLanguage) {
      return field
    }
    
    const resource = context.translations[context.activeLanguage]
    if (!resource?.fields) return field
    
    const fieldKey = getFieldKey(field as any)
    const translation = resource.fields[fieldKey]
    
    if (!translation) return field
    
    return applyFieldTranslation(field, translation) as T
  }, [context])
  
  // Apply translations to a section
  const applyToSection = useCallback(<T extends { id: string; title: string }>(section: T): T => {
    if (!context.isEnabled || context.activeLanguage === context.defaultLanguage) {
      return section
    }
    
    const resource = context.translations[context.activeLanguage]
    if (!resource?.sections) return section
    
    const sectionKey = getSectionKey(section as any)
    const translation = resource.sections[sectionKey]
    
    if (!translation) return section
    
    return applySectionTranslation(section, translation) as T
  }, [context])
  
  // Apply translations to full config
  const applyToConfig = useCallback(<T extends { sections?: any[]; settings?: any }>(config: T): T => {
    if (!context.isEnabled || context.activeLanguage === context.defaultLanguage) {
      return config
    }
    
    const resource = context.translations[context.activeLanguage]
    if (!resource) return config
    
    const result = { ...config }
    
    // Apply portal-level translations
    if (result.settings) {
      result.settings = {
        ...result.settings,
        name: resource.portal?.name || result.settings.name,
        description: resource.portal?.description || result.settings.description
      }
      
      // Apply to signup fields
      if (Array.isArray(result.settings.signupFields)) {
        result.settings.signupFields = result.settings.signupFields.map((field: any) => {
          const fieldKey = getFieldKey(field)
          const translation = resource.fields?.[fieldKey]
          return translation ? applyFieldTranslation(field, translation) : field
        })
      }
      
      // Apply to login fields
      if (Array.isArray(result.settings.loginFields)) {
        result.settings.loginFields = result.settings.loginFields.map((field: any) => {
          const fieldKey = getFieldKey(field)
          const translation = resource.fields?.[fieldKey]
          return translation ? applyFieldTranslation(field, translation) : field
        })
      }
    }
    
    // Apply to sections
    if (Array.isArray(result.sections)) {
      result.sections = result.sections.map((section: any) => {
        const sectionKey = getSectionKey(section)
        const sectionTranslation = resource.sections?.[sectionKey]
        
        let translatedSection = sectionTranslation
          ? applySectionTranslation(section, sectionTranslation)
          : section
        
        // Apply to fields in section
        if (Array.isArray(translatedSection.fields)) {
          translatedSection = {
            ...translatedSection,
            fields: translatedSection.fields.map((field: any) => {
              const fieldKey = getFieldKey(field)
              const fieldTranslation = resource.fields?.[fieldKey]
              return fieldTranslation ? applyFieldTranslation(field, fieldTranslation) : field
            })
          }
        }
        
        return translatedSection
      })
    }
    
    return result as T
  }, [context])
  
  return {
    activeLanguage: context.activeLanguage,
    defaultLanguage: context.defaultLanguage,
    supportedLanguages: context.supportedLanguages,
    isEnabled: context.isEnabled,
    isRTL: context.isRTL,
    isLoading: context.isLoading,
    setLanguage: context.setLanguage,
    t,
    applyToField,
    applyToSection,
    applyToConfig,
    getCurrentResource
  }
}

/**
 * Simple hook for just language state without translation functions
 */
export function useLanguage() {
  const context = useTranslationContext()
  
  return {
    activeLanguage: context.activeLanguage,
    defaultLanguage: context.defaultLanguage,
    supportedLanguages: context.supportedLanguages,
    setLanguage: context.setLanguage,
    isRTL: context.isRTL,
    isEnabled: context.isEnabled
  }
}
