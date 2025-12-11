/**
 * AI Translation Service
 * 
 * Handles translation of portal content using the Go backend's AI service.
 * Supports both legacy (flat) and new (i18next) translation formats.
 */

import { goClient } from '@/lib/api/go-client'
import type { TranslationResource, FieldTranslation } from '@/lib/i18n/types'

// ============================================
// Legacy Format Translation (Deprecated)
// ============================================

/**
 * Translate a single batch in legacy format
 * @deprecated Use translateResourceBatch instead
 */
async function translateBatch(
  content: Record<string, string>,
  targetLanguage: string
): Promise<Record<string, string>> {
  console.log(`📤 Sending batch of ${Object.keys(content).length} items to Backend...`)
  
  try {
    const response = await goClient.post<{ translations: Record<string, string> }>('/ai/translate', {
      content,
      target_language: targetLanguage,
      format: 'legacy'
    })
    return response.translations
  } catch (error: any) {
    console.error('❌ Translation error:', error)
    throw new Error(`Failed to translate batch: ${error.message}`)
  }
}

/**
 * Translate content in legacy format
 * @deprecated Use translateResource instead
 */
export async function translateContent(
  content: Record<string, string>,
  targetLanguage: string
): Promise<Record<string, string>> {
  const entries = Object.entries(content)
  if (entries.length === 0) {
    return {}
  }

  // Chunk size to stay safely within token limits
  // 40 items * ~50 tokens/item = ~2000 tokens, well within 4000 limit
  const CHUNK_SIZE = 40
  const chunks = []
  
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunkEntries = entries.slice(i, i + CHUNK_SIZE)
    chunks.push(Object.fromEntries(chunkEntries))
  }

  console.log(`📦 Split content into ${chunks.length} chunks for translation`)

  const results = await Promise.all(
    chunks.map((chunk, index) => 
      translateBatch(chunk, targetLanguage)
        .then(res => {
          console.log(`✅ Chunk ${index + 1}/${chunks.length} completed`)
          return res
        })
        .catch(err => {
          console.error(`❌ Chunk ${index + 1}/${chunks.length} failed:`, err)
          throw err
        })
    )
  )

  // Merge all results
  return results.reduce((acc, curr) => ({ ...acc, ...curr }), {})
}

// ============================================
// New Format Translation (i18next)
// ============================================

/**
 * Flatten a TranslationResource into key-value pairs for AI translation
 */
function flattenResource(resource: TranslationResource): Record<string, string> {
  const flat: Record<string, string> = {}
  
  // Portal
  if (resource.portal.name) flat['portal.name'] = resource.portal.name
  if (resource.portal.description) flat['portal.description'] = resource.portal.description
  
  // Sections
  for (const [sectionId, section] of Object.entries(resource.sections || {})) {
    if (section.title) flat[`sections.${sectionId}.title`] = section.title
    if (section.description) flat[`sections.${sectionId}.description`] = section.description
  }
  
  // Fields
  for (const [fieldId, field] of Object.entries(resource.fields || {})) {
    if (field.label) flat[`fields.${fieldId}.label`] = field.label
    if (field.placeholder) flat[`fields.${fieldId}.placeholder`] = field.placeholder
    if (field.description) flat[`fields.${fieldId}.description`] = field.description
    if (field.options) {
      field.options.forEach((opt, idx) => {
        flat[`fields.${fieldId}.options.${idx}`] = opt
      })
    }
  }
  
  return flat
}

/**
 * Unflatten key-value pairs back into a TranslationResource
 */
function unflattenResource(flat: Record<string, string>): TranslationResource {
  const resource: TranslationResource = {
    portal: { name: '' },
    sections: {},
    fields: {}
  }
  
  const fieldOptions: Record<string, { index: number; value: string }[]> = {}
  
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.')
    
    if (parts[0] === 'portal') {
      if (parts[1] === 'name') resource.portal.name = value
      if (parts[1] === 'description') resource.portal.description = value
    }
    
    if (parts[0] === 'sections' && parts.length >= 3) {
      const sectionId = parts[1]
      if (!resource.sections[sectionId]) {
        resource.sections[sectionId] = { title: '' }
      }
      if (parts[2] === 'title') resource.sections[sectionId].title = value
      if (parts[2] === 'description') resource.sections[sectionId].description = value
    }
    
    if (parts[0] === 'fields' && parts.length >= 3) {
      const fieldId = parts[1]
      if (!resource.fields[fieldId]) {
        resource.fields[fieldId] = { label: '' }
      }
      
      if (parts[2] === 'label') resource.fields[fieldId].label = value
      if (parts[2] === 'placeholder') resource.fields[fieldId].placeholder = value
      if (parts[2] === 'description') resource.fields[fieldId].description = value
      
      if (parts[2] === 'options' && parts.length === 4) {
        const optionIndex = parseInt(parts[3], 10)
        if (!fieldOptions[fieldId]) fieldOptions[fieldId] = []
        fieldOptions[fieldId].push({ index: optionIndex, value })
      }
    }
  }
  
  // Process options
  for (const [fieldId, options] of Object.entries(fieldOptions)) {
    if (!resource.fields[fieldId]) {
      resource.fields[fieldId] = { label: '' }
    }
    resource.fields[fieldId].options = options
      .sort((a, b) => a.index - b.index)
      .map(o => o.value)
  }
  
  return resource
}

/**
 * Translate a TranslationResource to target language
 */
export async function translateResource(
  resource: TranslationResource,
  targetLanguage: string
): Promise<TranslationResource> {
  // Flatten the resource for translation
  const flatContent = flattenResource(resource)
  
  if (Object.keys(flatContent).length === 0) {
    return {
      portal: { name: '' },
      sections: {},
      fields: {}
    }
  }
  
  console.log(`🌐 Translating resource to ${targetLanguage}...`)
  console.log(`📊 Total items to translate: ${Object.keys(flatContent).length}`)
  
  // Use existing batch translation logic
  const translatedFlat = await translateContent(flatContent, targetLanguage)
  
  // Unflatten back to resource structure
  return unflattenResource(translatedFlat)
}

/**
 * Translate a single field's content
 */
export async function translateField(
  field: FieldTranslation,
  targetLanguage: string
): Promise<FieldTranslation> {
  const content: Record<string, string> = {}
  
  if (field.label) content['label'] = field.label
  if (field.placeholder) content['placeholder'] = field.placeholder
  if (field.description) content['description'] = field.description
  if (field.options) {
    field.options.forEach((opt, idx) => {
      content[`option_${idx}`] = opt
    })
  }
  
  const translated = await translateContent(content, targetLanguage)
  
  const result: FieldTranslation = {
    label: translated['label'] || field.label
  }
  
  if (translated['placeholder']) result.placeholder = translated['placeholder']
  if (translated['description']) result.description = translated['description']
  
  if (field.options) {
    result.options = field.options.map((_, idx) => 
      translated[`option_${idx}`] || field.options![idx]
    )
  }
  
  return result
}
