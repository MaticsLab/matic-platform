/**
 * Evaluates conditions against form submission data
 * All conditions must be met (AND logic)
 */

export interface Condition {
  fieldId: string
  operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'in' | 'notIn' | 'gt' | 'gte' | 'lt' | 'lte' | 'isEmpty' | 'isNotEmpty' | 'startsWith' | 'endsWith'
  value?: any
}

export interface Ending {
  id: string
  label: string
  content?: string
  redirectUrl?: string
  isActive?: boolean
  conditions?: Condition[]
}

/**
 * Evaluates a single condition against submission data
 */
function evaluateCondition(condition: Condition, submissionData: Record<string, any>): boolean {
  const fieldValue = submissionData[condition.fieldId]
  const conditionValue = condition.value

  switch (condition.operator) {
    case 'equals':
      return fieldValue === conditionValue

    case 'notEquals':
      return fieldValue !== conditionValue

    case 'contains':
      if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
        return fieldValue.includes(conditionValue)
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(v => String(v).includes(String(conditionValue)))
      }
      return false

    case 'notContains':
      if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
        return !fieldValue.includes(conditionValue)
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some(v => String(v).includes(String(conditionValue)))
      }
      return true

    case 'startsWith':
      if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
        return fieldValue.startsWith(conditionValue)
      }
      return false

    case 'endsWith':
      if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
        return fieldValue.endsWith(conditionValue)
      }
      return false

    case 'in':
      if (Array.isArray(conditionValue)) {
        if (Array.isArray(fieldValue)) {
          return fieldValue.some(v => conditionValue.includes(v))
        }
        return conditionValue.includes(fieldValue)
      }
      return false

    case 'notIn':
      if (Array.isArray(conditionValue)) {
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some(v => conditionValue.includes(v))
        }
        return !conditionValue.includes(fieldValue)
      }
      return true

    case 'gt':
      return Number(fieldValue) > Number(conditionValue)

    case 'gte':
      return Number(fieldValue) >= Number(conditionValue)

    case 'lt':
      return Number(fieldValue) < Number(conditionValue)

    case 'lte':
      return Number(fieldValue) <= Number(conditionValue)

    case 'isEmpty':
      return !fieldValue || fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0)

    case 'isNotEmpty':
      return !!fieldValue && fieldValue !== '' && (!Array.isArray(fieldValue) || fieldValue.length > 0)

    default:
      return false
  }
}

/**
 * Finds the matching ending for submission data
 * Returns the first active ending where ALL conditions match
 * Falls back to defaultEnding if provided
 */
export function findMatchingEnding(
  endings: Ending[],
  submissionData: Record<string, any>,
  defaultEndingId?: string | null
): Ending | null {
  // Get active endings
  const activeEndings = endings.filter(e => e.isActive !== false)

  // Try to find an ending with matching conditions
  for (const ending of activeEndings) {
    if (!ending.conditions || ending.conditions.length === 0) {
      // Ending with no conditions always matches (use as fallback)
      continue
    }

    // Check if all conditions are met
    const allConditionsMet = ending.conditions.every(condition =>
      evaluateCondition(condition, submissionData)
    )

    if (allConditionsMet) {
      return ending
    }
  }

  // Try default ending if specified
  if (defaultEndingId) {
    const defaultEnding = activeEndings.find(e => e.id === defaultEndingId)
    if (defaultEnding) {
      return defaultEnding
    }
  }

  // Return first ending with no conditions as fallback
  const fallbackEnding = activeEndings.find(e => !e.conditions || e.conditions.length === 0)
  if (fallbackEnding) {
    return fallbackEnding
  }

  // Return first active ending if nothing else matched
  return activeEndings[0] || null
}

/**
 * Evaluates all conditions for debugging/testing
 */
export function evaluateAllConditions(
  ending: Ending,
  submissionData: Record<string, any>
): { condition: Condition; result: boolean }[] {
  if (!ending.conditions) return []

  return ending.conditions.map(condition => ({
    condition,
    result: evaluateCondition(condition, submissionData)
  }))
}
