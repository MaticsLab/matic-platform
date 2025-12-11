/**
 * Unit Tests for i18n Utility Functions
 */

import { describe, it, expect } from 'vitest'
import {
  isLegacyFormat,
  migrateLegacyLanguage,
  migrateFromLegacyFormat,
  generateTranslationKey,
  getFieldKey,
  getSectionKey,
  applyFieldTranslation,
  applySectionTranslation,
  isRTLLanguage,
  validateTranslationResource,
  calculateTranslationCoverage
} from '../utils'
import type { TranslationResource, FieldTranslation } from '../types'

describe('isLegacyFormat', () => {
  it('should return true for legacy flat key-value format', () => {
    const legacy = {
      'portal_name': 'Mi Portal',
      'field_abc_label': 'Nombre',
      'section_personal_title': 'Información Personal'
    }
    expect(isLegacyFormat(legacy)).toBe(true)
  })

  it('should return false for new i18next format', () => {
    const newFormat: TranslationResource = {
      portal: { name: 'Mi Portal' },
      sections: { personal: { title: 'Información Personal' } },
      fields: { abc: { label: 'Nombre' } }
    }
    expect(isLegacyFormat(newFormat)).toBe(false)
  })

  it('should return false for empty object', () => {
    expect(isLegacyFormat({})).toBe(false)
  })

  it('should return false for null/undefined', () => {
    expect(isLegacyFormat(null)).toBe(false)
    expect(isLegacyFormat(undefined)).toBe(false)
  })
})

describe('migrateLegacyLanguage', () => {
  it('should migrate portal name and description', () => {
    const legacy = {
      'portal_name': 'Mi Portal',
      'portal_desc': 'Descripción del portal'
    }
    const result = migrateLegacyLanguage(legacy)
    
    expect(result.portal.name).toBe('Mi Portal')
    expect(result.portal.description).toBe('Descripción del portal')
  })

  it('should migrate section titles and descriptions', () => {
    const legacy = {
      'section_personal_title': 'Información Personal',
      'section_personal_desc': 'Complete sus datos',
      'section_education_title': 'Educación'
    }
    const result = migrateLegacyLanguage(legacy)
    
    expect(result.sections['personal'].title).toBe('Información Personal')
    expect(result.sections['personal'].description).toBe('Complete sus datos')
    expect(result.sections['education'].title).toBe('Educación')
  })

  it('should migrate field labels, placeholders, and descriptions', () => {
    const legacy = {
      'field_name_label': 'Nombre Completo',
      'field_name_placeholder': 'Ingrese su nombre',
      'field_name_desc': 'Como aparece en su ID',
      'field_email_label': 'Correo Electrónico'
    }
    const result = migrateLegacyLanguage(legacy)
    
    expect(result.fields['name'].label).toBe('Nombre Completo')
    expect(result.fields['name'].placeholder).toBe('Ingrese su nombre')
    expect(result.fields['name'].description).toBe('Como aparece en su ID')
    expect(result.fields['email'].label).toBe('Correo Electrónico')
  })

  it('should migrate field options in order', () => {
    const legacy = {
      'field_gender_label': 'Género',
      'field_gender_opt_0': 'Masculino',
      'field_gender_opt_1': 'Femenino',
      'field_gender_opt_2': 'Otro'
    }
    const result = migrateLegacyLanguage(legacy)
    
    expect(result.fields['gender'].options).toEqual(['Masculino', 'Femenino', 'Otro'])
  })

  it('should handle empty input', () => {
    const result = migrateLegacyLanguage({})
    
    expect(result.portal.name).toBe('')
    expect(result.sections).toEqual({})
    expect(result.fields).toEqual({})
  })
})

describe('migrateFromLegacyFormat', () => {
  it('should migrate multiple languages', () => {
    const legacy = {
      'es': {
        'portal_name': 'Portal Español',
        'field_name_label': 'Nombre'
      },
      'fr': {
        'portal_name': 'Portail Français',
        'field_name_label': 'Nom'
      }
    }
    const result = migrateFromLegacyFormat(legacy)
    
    expect(result['es'].portal.name).toBe('Portal Español')
    expect(result['es'].fields['name'].label).toBe('Nombre')
    expect(result['fr'].portal.name).toBe('Portail Français')
    expect(result['fr'].fields['name'].label).toBe('Nom')
  })
})

describe('generateTranslationKey', () => {
  it('should convert text to lowercase slug', () => {
    expect(generateTranslationKey('Full Name')).toBe('full_name')
    expect(generateTranslationKey('Email Address')).toBe('email_address')
  })

  it('should remove special characters', () => {
    expect(generateTranslationKey('What\'s your name?')).toBe('whats_your_name')
  })

  it('should truncate to 50 characters', () => {
    const longText = 'This is a very long field label that should be truncated to fifty characters'
    expect(generateTranslationKey(longText).length).toBeLessThanOrEqual(50)
  })
})

describe('getFieldKey / getSectionKey', () => {
  it('should prefer translationKey over id', () => {
    expect(getFieldKey({ id: 'abc123', translationKey: 'fullName' })).toBe('fullName')
    expect(getSectionKey({ id: 'xyz789', translationKey: 'personal' })).toBe('personal')
  })

  it('should fall back to id if no translationKey', () => {
    expect(getFieldKey({ id: 'abc123' })).toBe('abc123')
    expect(getSectionKey({ id: 'xyz789' })).toBe('xyz789')
  })
})

describe('applyFieldTranslation', () => {
  const baseField = {
    id: 'name',
    label: 'Full Name',
    placeholder: 'Enter your name',
    description: 'As shown on ID',
    options: ['Option 1', 'Option 2']
  }

  it('should apply translation overrides', () => {
    const translation: FieldTranslation = {
      label: 'Nombre Completo',
      placeholder: 'Ingrese su nombre',
      description: 'Como aparece en su ID'
    }
    const result = applyFieldTranslation(baseField, translation)
    
    expect(result.label).toBe('Nombre Completo')
    expect(result.placeholder).toBe('Ingrese su nombre')
    expect(result.description).toBe('Como aparece en su ID')
  })

  it('should translate options', () => {
    const translation: FieldTranslation = {
      label: 'Opciones',
      options: ['Opción 1', 'Opción 2']
    }
    const result = applyFieldTranslation(baseField, translation)
    
    expect(result.options).toEqual(['Opción 1', 'Opción 2'])
  })

  it('should return original field if no translation', () => {
    const result = applyFieldTranslation(baseField, undefined)
    expect(result).toEqual(baseField)
  })
})

describe('applySectionTranslation', () => {
  const baseSection = {
    id: 'personal',
    title: 'Personal Information',
    description: 'Enter your details'
  }

  it('should apply translation overrides', () => {
    const translation = {
      title: 'Información Personal',
      description: 'Ingrese sus datos'
    }
    const result = applySectionTranslation(baseSection, translation)
    
    expect(result.title).toBe('Información Personal')
    expect(result.description).toBe('Ingrese sus datos')
  })

  it('should keep original values if translation is partial', () => {
    const translation = { title: 'Información Personal' }
    const result = applySectionTranslation(baseSection, translation)
    
    expect(result.title).toBe('Información Personal')
    expect(result.description).toBe('Enter your details')
  })
})

describe('isRTLLanguage', () => {
  it('should return true for RTL languages', () => {
    expect(isRTLLanguage('ar')).toBe(true)
    expect(isRTLLanguage('he')).toBe(true)
    expect(isRTLLanguage('fa')).toBe(true)
  })

  it('should return false for LTR languages', () => {
    expect(isRTLLanguage('en')).toBe(false)
    expect(isRTLLanguage('es')).toBe(false)
    expect(isRTLLanguage('zh')).toBe(false)
  })

  it('should handle locale codes', () => {
    expect(isRTLLanguage('ar-SA')).toBe(true)
    expect(isRTLLanguage('en-US')).toBe(false)
  })
})

describe('validateTranslationResource', () => {
  it('should validate a correct resource', () => {
    const resource: TranslationResource = {
      portal: { name: 'Test' },
      sections: {},
      fields: {}
    }
    const result = validateTranslationResource(resource)
    
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('should catch missing portal', () => {
    const resource = { sections: {}, fields: {} }
    const result = validateTranslationResource(resource)
    
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing or invalid "portal" property')
  })

  it('should catch non-object input', () => {
    const result = validateTranslationResource(null)
    
    expect(result.valid).toBe(false)
  })
})

describe('calculateTranslationCoverage', () => {
  it('should calculate 100% for fully translated resource', () => {
    const original: TranslationResource = {
      portal: { name: 'Test', description: 'Desc' },
      sections: { s1: { title: 'Section 1' } },
      fields: { f1: { label: 'Field 1' } }
    }
    const translated: TranslationResource = {
      portal: { name: 'Prueba', description: 'Descripción' },
      sections: { s1: { title: 'Sección 1' } },
      fields: { f1: { label: 'Campo 1' } }
    }
    
    expect(calculateTranslationCoverage(original, translated)).toBe(100)
  })

  it('should calculate partial coverage', () => {
    const original: TranslationResource = {
      portal: { name: 'Test', description: 'Desc' },
      sections: {},
      fields: { f1: { label: 'Field 1' }, f2: { label: 'Field 2' } }
    }
    const translated: TranslationResource = {
      portal: { name: 'Prueba' }, // missing description
      sections: {},
      fields: { f1: { label: 'Campo 1' } } // missing f2
    }
    
    // 4 total items (name, desc, f1, f2), 2 translated = 50%
    expect(calculateTranslationCoverage(original, translated)).toBe(50)
  })

  it('should return 100% for empty original', () => {
    const original: TranslationResource = {
      portal: { name: '' },
      sections: {},
      fields: {}
    }
    const translated: TranslationResource = {
      portal: { name: '' },
      sections: {},
      fields: {}
    }
    
    expect(calculateTranslationCoverage(original, translated)).toBe(100)
  })
})
