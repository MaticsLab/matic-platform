/**
 * Unit Tests for Portal Translations
 */

import { describe, it, expect } from 'vitest'
import {
  normalizeTranslations,
  isLegacyTranslations,
  collectTranslatableContentNew,
  applyTranslationsToFieldNew,
  applyTranslationsToSectionNew,
  applyTranslationsToConfigNew,
  updateFieldTranslationNew,
  updateSectionTranslationNew,
  // Legacy functions
  collectTranslatableContent,
  applyTranslationsToField,
  applyTranslationsToSection,
  applyTranslationsToConfig
} from '../portal-translations'
import type { TranslationResource } from '../i18n/types'

describe('normalizeTranslations', () => {
  it('should return empty object for empty input', () => {
    expect(normalizeTranslations({})).toEqual({})
    expect(normalizeTranslations(null)).toEqual({})
    expect(normalizeTranslations(undefined)).toEqual({})
  })

  it('should migrate legacy format to new format', () => {
    const legacy = {
      'es': {
        'portal_name': 'Mi Portal',
        'field_name_label': 'Nombre'
      }
    }
    const result = normalizeTranslations(legacy)
    
    expect(result['es'].portal.name).toBe('Mi Portal')
    expect(result['es'].fields['name'].label).toBe('Nombre')
  })

  it('should pass through new format unchanged', () => {
    const newFormat = {
      'es': {
        portal: { name: 'Mi Portal' },
        sections: {},
        fields: { name: { label: 'Nombre' } }
      }
    }
    const result = normalizeTranslations(newFormat)
    
    expect(result).toEqual(newFormat)
  })
})

describe('isLegacyTranslations', () => {
  it('should detect legacy format', () => {
    const legacy = {
      'es': { 'portal_name': 'Test', 'field_x_label': 'Label' }
    }
    expect(isLegacyTranslations(legacy)).toBe(true)
  })

  it('should detect new format', () => {
    const newFormat = {
      'es': { portal: { name: 'Test' }, sections: {}, fields: {} }
    }
    expect(isLegacyTranslations(newFormat)).toBe(false)
  })
})

describe('collectTranslatableContentNew', () => {
  it('should collect portal name and description', () => {
    const config = {
      settings: { name: 'My Portal', description: 'Portal description' },
      sections: []
    }
    const result = collectTranslatableContentNew(config)
    
    expect(result.portal.name).toBe('My Portal')
    expect(result.portal.description).toBe('Portal description')
  })

  it('should collect section titles and descriptions', () => {
    const config = {
      settings: { name: 'Test' },
      sections: [
        { id: 's1', title: 'Section 1', description: 'Desc 1', fields: [] },
        { id: 's2', title: 'Section 2', fields: [] }
      ]
    }
    const result = collectTranslatableContentNew(config)
    
    expect(result.sections['s1'].title).toBe('Section 1')
    expect(result.sections['s1'].description).toBe('Desc 1')
    expect(result.sections['s2'].title).toBe('Section 2')
  })

  it('should collect field properties', () => {
    const config = {
      settings: { name: 'Test' },
      sections: [{
        id: 's1',
        title: 'Section',
        fields: [
          { id: 'f1', label: 'Field 1', placeholder: 'Enter...', description: 'Help text' },
          { id: 'f2', label: 'Field 2', options: ['A', 'B', 'C'] }
        ]
      }]
    }
    const result = collectTranslatableContentNew(config)
    
    expect(result.fields['f1'].label).toBe('Field 1')
    expect(result.fields['f1'].placeholder).toBe('Enter...')
    expect(result.fields['f1'].description).toBe('Help text')
    expect(result.fields['f2'].label).toBe('Field 2')
    expect(result.fields['f2'].options).toEqual(['A', 'B', 'C'])
  })

  it('should collect signup and login fields', () => {
    const config = {
      settings: {
        name: 'Test',
        signupFields: [{ id: 'signup1', label: 'Signup Field' }],
        loginFields: [{ id: 'login1', label: 'Login Field' }]
      },
      sections: []
    }
    const result = collectTranslatableContentNew(config)
    
    expect(result.fields['signup1'].label).toBe('Signup Field')
    expect(result.fields['login1'].label).toBe('Login Field')
  })
})

describe('applyTranslationsToConfigNew', () => {
  const baseConfig = {
    settings: {
      name: 'My Portal',
      description: 'Description',
      signupFields: [{ id: 'email', label: 'Email' }],
      loginFields: [{ id: 'password', label: 'Password' }]
    },
    sections: [{
      id: 'personal',
      title: 'Personal Info',
      fields: [{ id: 'name', label: 'Full Name' }]
    }],
    translations: {
      'es': {
        portal: { name: 'Mi Portal', description: 'Descripción' },
        sections: { personal: { title: 'Información Personal' } },
        fields: {
          name: { label: 'Nombre Completo' },
          email: { label: 'Correo' },
          password: { label: 'Contraseña' }
        }
      }
    }
  }

  it('should apply translations to portal name', () => {
    const result = applyTranslationsToConfigNew(baseConfig, 'es')
    
    expect(result.settings.name).toBe('Mi Portal')
    expect(result.settings.description).toBe('Descripción')
  })

  it('should apply translations to sections', () => {
    const result = applyTranslationsToConfigNew(baseConfig, 'es')
    
    expect(result.sections[0].title).toBe('Información Personal')
  })

  it('should apply translations to section fields', () => {
    const result = applyTranslationsToConfigNew(baseConfig, 'es')
    
    expect(result.sections[0].fields[0].label).toBe('Nombre Completo')
  })

  it('should apply translations to signup/login fields', () => {
    const result = applyTranslationsToConfigNew(baseConfig, 'es')
    
    expect(result.settings.signupFields[0].label).toBe('Correo')
    expect(result.settings.loginFields[0].label).toBe('Contraseña')
  })

  it('should return original if no translations for language', () => {
    const result = applyTranslationsToConfigNew(baseConfig, 'fr')
    
    expect(result.settings.name).toBe('My Portal')
  })

  it('should return original if lang is undefined', () => {
    const result = applyTranslationsToConfigNew(baseConfig, undefined)
    
    expect(result.settings.name).toBe('My Portal')
  })
})

describe('updateFieldTranslationNew', () => {
  it('should add a new field translation', () => {
    const current = {}
    const result = updateFieldTranslationNew(current, 'es', 'name', {
      label: 'Nombre',
      placeholder: 'Ingrese nombre'
    })
    
    expect(result['es'].fields['name'].label).toBe('Nombre')
    expect(result['es'].fields['name'].placeholder).toBe('Ingrese nombre')
  })

  it('should update existing field translation', () => {
    const current = {
      'es': {
        portal: { name: 'Test' },
        sections: {},
        fields: { name: { label: 'Nombre Viejo' } }
      }
    }
    const result = updateFieldTranslationNew(current, 'es', 'name', {
      label: 'Nombre Nuevo'
    })
    
    expect(result['es'].fields['name'].label).toBe('Nombre Nuevo')
  })
})

describe('updateSectionTranslationNew', () => {
  it('should add a new section translation', () => {
    const current = {}
    const result = updateSectionTranslationNew(current, 'es', 'personal', {
      title: 'Información Personal',
      description: 'Complete sus datos'
    })
    
    expect(result['es'].sections['personal'].title).toBe('Información Personal')
    expect(result['es'].sections['personal'].description).toBe('Complete sus datos')
  })
})

describe('Legacy format compatibility', () => {
  describe('applyTranslationsToField (dual format)', () => {
    const baseField = { id: 'name', label: 'Name', placeholder: 'Enter name' }

    it('should work with legacy format', () => {
      const legacyTranslations = {
        'field_name_label': 'Nombre',
        'field_name_placeholder': 'Ingrese nombre'
      }
      const result = applyTranslationsToField(baseField, legacyTranslations)
      
      expect(result.label).toBe('Nombre')
      expect(result.placeholder).toBe('Ingrese nombre')
    })

    it('should work with new format', () => {
      const newTranslations = {
        portal: { name: '' },
        sections: {},
        fields: { name: { label: 'Nombre', placeholder: 'Ingrese nombre' } }
      }
      const result = applyTranslationsToField(baseField, newTranslations)
      
      expect(result.label).toBe('Nombre')
      expect(result.placeholder).toBe('Ingrese nombre')
    })
  })

  describe('applyTranslationsToConfig (dual format)', () => {
    it('should work with legacy translations in config', () => {
      const config = {
        settings: { name: 'Portal' },
        sections: [{ id: 's1', title: 'Section', fields: [] }],
        translations: {
          'es': {
            'portal_name': 'Portal Español',
            'section_s1_title': 'Sección'
          }
        }
      }
      const result = applyTranslationsToConfig(config, 'es')
      
      expect(result.settings.name).toBe('Portal Español')
      expect(result.sections[0].title).toBe('Sección')
    })

    it('should work with new translations in config', () => {
      const config = {
        settings: { name: 'Portal' },
        sections: [{ id: 's1', title: 'Section', fields: [] }],
        translations: {
          'es': {
            portal: { name: 'Portal Español' },
            sections: { s1: { title: 'Sección' } },
            fields: {}
          }
        }
      }
      const result = applyTranslationsToConfig(config, 'es')
      
      expect(result.settings.name).toBe('Portal Español')
      expect(result.sections[0].title).toBe('Sección')
    })
  })
})
