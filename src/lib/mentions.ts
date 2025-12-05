/**
 * Utility functions for handling field mentions in portal forms
 */

export interface FormValues {
  [fieldId: string]: any
}

/**
 * Replace mentions in text with actual field values
 * Mentions are in format: {Field Label}
 */
export function replaceMentions(text: string, formValues: FormValues, fieldMap?: Map<string, string>): string {
  if (!text) return text

  // Match {anything} pattern
  return text.replace(/\{([^}]+)\}/g, (match, fieldLabel) => {
    if (!fieldMap) return match

    // Find the field ID by label
    const fieldId = fieldMap.get(fieldLabel)
    if (!fieldId || !formValues[fieldId]) return match

    const value = formValues[fieldId]
    
    // Convert value to string
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value)
    }
    return String(value || '')
  })
}

/**
 * Create a map from field label to field ID for easy lookup
 */
export function createFieldLabelMap(fields: Array<{ id: string; label: string }>): Map<string, string> {
  const map = new Map<string, string>()
  fields.forEach(field => {
    map.set(field.label, field.id)
  })
  return map
}

/**
 * Extract all mentions from text
 */
export function extractMentions(text: string): string[] {
  const matches = text.match(/\{([^}]+)\}/g) || []
  return matches.map(m => m.slice(1, -1)) // Remove { }
}

/**
 * Check if text contains any mentions
 */
export function hasMentions(text: string): boolean {
  return /\{[^}]+\}/.test(text)
}
