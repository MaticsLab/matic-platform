/**
 * Ending Pages - JSON Schema Block System
 * Enterprise-grade block-based content builder for customizable ending pages
 */

// Core block schema definition
export interface PropertySchema {
  type: 'string' | 'number' | 'boolean' | 'color' | 'select' | 'richtext' | 'url'
  label: string
  description?: string
  default?: any
  enum?: any[]
  placeholder?: string
  required?: boolean
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string
  }
}

export interface BlockTypeDefinition {
  label: string
  description?: string
  category: 'content' | 'interactive' | 'layout' | 'media'
  icon?: string
  schema: {
    properties: Record<string, PropertySchema>
    required: string[]
  }
  defaultProps?: Record<string, any>
}

// Individual block instance
export interface EndingBlock {
  id: string
  blockType: string
  
  // Block properties stored as key-value pairs
  props: Record<string, any>
  
  // Conditional rendering
  conditions?: Array<{
    fieldId: string
    operator: 'equals' | 'notEquals' | 'contains' | 'isEmpty' | 'isNotEmpty'
    value?: any
  }>
  
  // Display metadata
  metadata: {
    order: number
    hidden?: boolean
    locked?: boolean
  }
  
  // Styling
  styles?: {
    marginTop?: number
    marginBottom?: number
    marginLeft?: number
    marginRight?: number
    paddingTop?: number
    paddingBottom?: number
    customClass?: string
  }
}

// Complete ending page configuration
export interface EndingPageConfig {
  id: string
  formId: string
  name: string
  description?: string
  
  // Blocks in this ending
  blocks: EndingBlock[]
  
  // Global settings
  settings: {
    layout: 'centered' | 'split' | 'card' | 'minimal'
    maxWidth: number // px
    padding: {
      top: number
      right: number
      bottom: number
      left: number
    }
    backgroundColor: string
    minHeight?: number
  }
  
  // Theme
  theme: {
    colorPrimary: string
    colorSecondary: string
    colorText: string
    colorSubtext: string
    fontFamily: 'inter' | 'roboto' | 'serif' | 'mono'
    borderRadius: number
  }
  
  // Routing logic
  conditions?: Array<{
    fieldId: string
    operator: string
    value?: any
  }>
  
  // Metadata
  isDefault?: boolean
  version: number
  status: 'draft' | 'published'
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

// For API responses
export interface EndingPageWithForm extends EndingPageConfig {
  formId: string
}

// Block registry type
export type BlockRegistry = Record<string, BlockTypeDefinition>
