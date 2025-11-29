import { goClient } from './go-client'
import { FieldTypeRegistry } from '@/types/field-registry'

export interface FieldTypeSummary {
  id: string
  category: string
  label: string
  description: string
  icon: string
  color: string
  is_container: boolean
}

export interface FieldTypesToolbox {
  primitive: FieldTypeSummary[]
  container: FieldTypeSummary[]
  layout: FieldTypeSummary[]
  special: FieldTypeSummary[]
}

export const fieldTypesClient = {
  // Get all field types from registry
  list: (options?: { category?: string; module_id?: string }) => {
    const params = new URLSearchParams()
    if (options?.category) params.append('category', options.category)
    if (options?.module_id) params.append('module_id', options.module_id)
    const queryString = params.toString()
    return goClient.get<FieldTypeRegistry[]>(`/field-types${queryString ? '?' + queryString : ''}`)
  },

  // Get single field type by ID
  get: (id: string) => 
    goClient.get<FieldTypeRegistry>(`/field-types/${id}`),

  // Get field types grouped by category for the toolbox
  getToolbox: () => 
    goClient.get<FieldTypesToolbox>('/field-types/toolbox'),
}

// Default field type icons (used if icon not in registry)
export const FIELD_TYPE_ICONS: Record<string, string> = {
  text: 'Type',
  textarea: 'AlignLeft',
  email: 'Mail',
  phone: 'Phone',
  url: 'Link2',
  address: 'MapPin',
  number: 'Hash',
  date: 'Calendar',
  datetime: 'CalendarClock',
  time: 'Clock',
  select: 'ChevronDown',
  multiselect: 'ListChecks',
  checkbox: 'CheckSquare',
  radio: 'Circle',
  file: 'FileUp',
  image: 'Image',
  link: 'Link',
  lookup: 'Search',
  rollup: 'Calculator',
  formula: 'FunctionSquare',
  repeater: 'List',
  group: 'Folder',
  section: 'LayoutGrid',
  heading: 'Heading',
  paragraph: 'Text',
  divider: 'Minus',
  signature: 'PenTool',
  rating: 'Star',
  rank: 'ArrowUpDown',
}

// Get icon for a field type (from registry or fallback)
export function getFieldTypeIcon(fieldType: FieldTypeSummary | string): string {
  if (typeof fieldType === 'string') {
    return FIELD_TYPE_ICONS[fieldType] || 'Box'
  }
  return fieldType.icon || FIELD_TYPE_ICONS[fieldType.id] || 'Box'
}
