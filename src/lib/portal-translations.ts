export type TranslationsMap = Record<string, string>

const labelKey = (fieldId: string) => `field_${fieldId}_label`
const placeholderKey = (fieldId: string) => `field_${fieldId}_placeholder`
const optionKey = (fieldId: string, idx: number) => `field_${fieldId}_opt_${idx}`
const sectionTitleKey = (sectionId: string) => `section_${sectionId}_title`
const sectionDescKey = (sectionId: string) => `section_${sectionId}_desc`
const portalNameKey = 'portal_name'

// Collect all translatable strings from the portal config so we can send them to the
// translation provider in one shot.
export function collectTranslatableContent(config: any): Record<string, string> {
  const contentToTranslate: Record<string, string> = {}

  contentToTranslate[portalNameKey] = config.settings?.name

  const collectField = (field: any) => {
    contentToTranslate[labelKey(field.id)] = field.label
    if (field.placeholder) {
      contentToTranslate[placeholderKey(field.id)] = field.placeholder
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

  // Also collect from signup and login fields
  if (config.settings?.signupFields) {
    (config.settings.signupFields || []).forEach(collectField)
  }
  if (config.settings?.loginFields) {
    (config.settings.loginFields || []).forEach(collectField)
  }

  return contentToTranslate
}

export function applyTranslationsToField(field: any, translations?: TranslationsMap): any {
  if (!translations) return field
  const cloned = { ...field }
  const label = translations[labelKey(field.id)]
  const placeholder = translations[placeholderKey(field.id)]
  if (label) cloned.label = label
  if (placeholder) cloned.placeholder = placeholder
  if (Array.isArray(field.options)) {
    cloned.options = field.options.map((opt: any, idx: number) => {
      const translation = translations[optionKey(field.id, idx)]
      if (!translation) return opt
      
      if (typeof opt === 'string') {
        return translation
      } else {
        return { ...opt, label: translation }
      }
    })
  }
  if (Array.isArray(field.children)) {
    cloned.children = field.children.map((child: any) => applyTranslationsToField(child, translations))
  }
  if (field.config?.content && translations[labelKey(field.id)]) {
    // keep content if provided, but allow label override
    cloned.config = { ...field.config }
  }
  return cloned
}

export function applyTranslationsToSection(section: any, translations?: TranslationsMap): any {
  if (!translations) return section
  return {
    ...section,
    title: translations[sectionTitleKey(section.id)] || section.title,
    description: translations[sectionDescKey(section.id)] || section.description,
    fields: (section.fields || []).map((f: any) => applyTranslationsToField(f, translations)),
  }
}

export function applyTranslationsToConfig(config: any, lang?: string): any {
  if (!lang) return config
  const translations = config.translations?.[lang]
  if (!translations) return config
  return {
    ...config,
    settings: {
      ...config.settings,
      name: translations[portalNameKey] || config.settings.name,
      signupFields: (config.settings.signupFields || []).map((f: any) => applyTranslationsToField(f, translations)),
      loginFields: (config.settings.loginFields || []).map((f: any) => applyTranslationsToField(f, translations)),
    },
    sections: (config.sections || []).map((s: any) => applyTranslationsToSection(s, translations)),
  }
}

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
  if (Array.isArray(updates.options)) {
    updates.options.forEach((opt: any, idx: number) => {
      const text = typeof opt === 'string' ? opt : opt.label
      existing[optionKey(fieldId, idx)] = text
    })
    // ensure options length matches base
    if (Array.isArray(baseField?.options) && baseField.options.length > updates.options.length) {
      baseField.options.forEach((_: string, idx: number) => {
        if (idx >= updates.options.length) delete existing[optionKey(fieldId, idx)]
      })
    }
  }

  next[lang] = existing
  return next
}

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
