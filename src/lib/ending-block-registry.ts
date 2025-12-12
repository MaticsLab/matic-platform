/**
 * Block Registry - Define all available blocks with their schemas
 * This is the source of truth for block types
 */

import { BlockTypeDefinition, BlockRegistry } from '@/types/ending-blocks'

export const ENDING_BLOCK_REGISTRY: BlockRegistry = {
  icon: {
    label: 'Icon',
    description: 'Decorative icon (check, star, alert, etc)',
    category: 'content',
    icon: 'circle',
    schema: {
      properties: {
        name: {
          type: 'select',
          label: 'Icon',
          description: 'Choose an icon to display',
          enum: ['check-circle', 'x-circle', 'alert-circle', 'info', 'star', 'heart', 'flag', 'zap'],
          default: 'check-circle'
        },
        color: {
          type: 'color',
          label: 'Color',
          default: '#2563eb'
        },
        size: {
          type: 'select',
          label: 'Size',
          enum: ['sm', 'md', 'lg', 'xl'],
          default: 'lg'
        }
      },
      required: ['name']
    },
    defaultProps: {
      name: 'check-circle',
      color: '#2563eb',
      size: 'lg'
    }
  },

  heading: {
    label: 'Heading',
    description: 'Large text heading',
    category: 'content',
    icon: 'heading-2',
    schema: {
      properties: {
        text: {
          type: 'string',
          label: 'Text',
          placeholder: 'Enter heading text'
        },
        level: {
          type: 'select',
          label: 'Level',
          enum: [1, 2, 3, 4],
          default: 1
        },
        align: {
          type: 'select',
          label: 'Alignment',
          enum: ['left', 'center', 'right'],
          default: 'center'
        }
      },
      required: ['text']
    },
    defaultProps: {
      text: 'Thank You!',
      level: 1,
      align: 'center'
    }
  },

  paragraph: {
    label: 'Paragraph',
    description: 'Body text with optional rich formatting',
    category: 'content',
    icon: 'type',
    schema: {
      properties: {
        text: {
          type: 'richtext',
          label: 'Content',
          placeholder: 'Enter text...'
        },
        align: {
          type: 'select',
          label: 'Alignment',
          enum: ['left', 'center', 'right'],
          default: 'center'
        },
        size: {
          type: 'select',
          label: 'Text Size',
          enum: ['sm', 'base', 'lg'],
          default: 'base'
        }
      },
      required: ['text']
    },
    defaultProps: {
      text: 'Your submission has been received.',
      align: 'center',
      size: 'base'
    }
  },

  button: {
    label: 'Button',
    description: 'Interactive button with various actions',
    category: 'interactive',
    icon: 'click',
    schema: {
      properties: {
        text: {
          type: 'string',
          label: 'Button Text',
          placeholder: 'Click me'
        },
        action: {
          type: 'select',
          label: 'Action',
          description: 'What happens when clicked',
          enum: ['submit-another', 'dashboard', 'redirect', 'download', 'email'],
          default: 'submit-another'
        },
        url: {
          type: 'url',
          label: 'URL (for redirect)',
          placeholder: 'https://...'
        },
        variant: {
          type: 'select',
          label: 'Style',
          enum: ['primary', 'secondary', 'outline', 'ghost'],
          default: 'primary'
        },
        fullWidth: {
          type: 'boolean',
          label: 'Full Width',
          default: false
        }
      },
      required: ['text', 'action']
    },
    defaultProps: {
      text: 'Next Step',
      action: 'submit-another',
      variant: 'primary',
      fullWidth: false
    }
  },

  divider: {
    label: 'Divider',
    description: 'Visual separator line',
    category: 'layout',
    icon: 'minus',
    schema: {
      properties: {
        color: {
          type: 'color',
          label: 'Color',
          default: '#e5e7eb'
        },
        spacing: {
          type: 'select',
          label: 'Spacing',
          enum: ['sm', 'md', 'lg'],
          default: 'md'
        }
      },
      required: []
    },
    defaultProps: {
      color: '#e5e7eb',
      spacing: 'md'
    }
  },

  image: {
    label: 'Image',
    description: 'Display an image',
    category: 'media',
    icon: 'image',
    schema: {
      properties: {
        url: {
          type: 'url',
          label: 'Image URL',
          placeholder: 'https://...'
        },
        alt: {
          type: 'string',
          label: 'Alt Text',
          placeholder: 'Description for accessibility'
        },
        width: {
          type: 'number',
          label: 'Width (px)',
          default: 200
        },
        align: {
          type: 'select',
          label: 'Alignment',
          enum: ['left', 'center', 'right'],
          default: 'center'
        }
      },
      required: ['url']
    },
    defaultProps: {
      alt: 'Image',
      width: 200,
      align: 'center'
    }
  },

  callout: {
    label: 'Callout Box',
    description: 'Highlighted informational box',
    category: 'content',
    icon: 'alert-square',
    schema: {
      properties: {
        type: {
          type: 'select',
          label: 'Type',
          enum: ['info', 'success', 'warning', 'error'],
          default: 'info'
        },
        title: {
          type: 'string',
          label: 'Title'
        },
        text: {
          type: 'richtext',
          label: 'Content'
        },
        icon: {
          type: 'boolean',
          label: 'Show Icon',
          default: true
        }
      },
      required: ['text']
    },
    defaultProps: {
      type: 'info',
      icon: true,
      text: 'Important information'
    }
  },

  'button-group': {
    label: 'Button Group',
    description: 'Multiple buttons side by side',
    category: 'interactive',
    icon: 'square-stack',
    schema: {
      properties: {
        buttons: {
          type: 'string', // JSON stringified array
          label: 'Buttons (JSON)',
          placeholder: '[{"text":"Button 1","action":"submit-another"}]'
        },
        layout: {
          type: 'select',
          label: 'Layout',
          enum: ['horizontal', 'vertical', 'stacked'],
          default: 'horizontal'
        }
      },
      required: ['buttons']
    },
    defaultProps: {
      layout: 'horizontal',
      buttons: JSON.stringify([])
    }
  },

  'footer-message': {
    label: 'Footer Message',
    description: 'Small text at bottom (e.g., confirmation note)',
    category: 'content',
    icon: 'message-square',
    schema: {
      properties: {
        text: {
          type: 'string',
          label: 'Message',
          placeholder: 'A confirmation email has been sent...'
        },
        icon: {
          type: 'boolean',
          label: 'Show Icon',
          default: false
        }
      },
      required: ['text']
    },
    defaultProps: {
      text: 'A confirmation email has been sent to your inbox.',
      icon: false
    }
  },

  spacer: {
    label: 'Spacer',
    description: 'Add empty space between elements',
    category: 'layout',
    icon: 'maximize-2',
    schema: {
      properties: {
        height: {
          type: 'number',
          label: 'Height (px)',
          default: 24
        }
      },
      required: []
    },
    defaultProps: {
      height: 24
    }
  }
}

/**
 * Get a block definition by type
 */
export function getBlockDefinition(blockType: string): BlockTypeDefinition | null {
  return ENDING_BLOCK_REGISTRY[blockType] || null
}

/**
 * Get all block definitions for a category
 */
export function getBlocksByCategory(category: string): Array<[string, BlockTypeDefinition]> {
  return Object.entries(ENDING_BLOCK_REGISTRY).filter(([_, def]) => def.category === category)
}

/**
 * Get all available categories
 */
export function getAvailableCategories(): string[] {
  return Array.from(new Set(Object.values(ENDING_BLOCK_REGISTRY).map(def => def.category)))
}
