/**
 * Block Registry
 * 
 * Defines all available block types with their metadata, default configurations,
 * and rendering hints. This is the central registry for the portal block system.
 */

import type { BlockType, BlockCategory, BlockTypeDefinition } from '@/types/portal-blocks';

// ============================================================================
// BLOCK TYPE DEFINITIONS
// ============================================================================

export const BLOCK_REGISTRY: Record<BlockType, BlockTypeDefinition> = {
  // ==========================================================================
  // LAYOUT BLOCKS
  // ==========================================================================
  
  'heading': {
    type: 'heading',
    displayName: 'Heading',
    description: 'A section heading or title',
    category: 'layout',
    icon: 'heading',
    defaultConfig: { level: 2, content: 'Heading', align: 'left' },
    isContainer: false,
    configSchema: {
      level: { type: 'select', options: [1, 2, 3, 4, 5, 6], label: 'Level' },
      content: { type: 'text', label: 'Content' },
      align: { type: 'select', options: ['left', 'center', 'right'], label: 'Alignment' },
    },
    collectsData: false,
  },
  
  'paragraph': {
    type: 'paragraph',
    displayName: 'Paragraph',
    description: 'A block of text content',
    category: 'layout',
    icon: 'align-left',
    defaultConfig: { content: '', align: 'left' },
    isContainer: false,
    configSchema: {
      content: { type: 'richtext', label: 'Content' },
      align: { type: 'select', options: ['left', 'center', 'right'], label: 'Alignment' },
    },
    collectsData: false,
  },
  
  'divider': {
    type: 'divider',
    displayName: 'Divider',
    description: 'A horizontal line separator',
    category: 'layout',
    icon: 'minus',
    defaultConfig: {},
    isContainer: false,
    configSchema: {},
    collectsData: false,
  },
  
  'spacer': {
    type: 'spacer',
    displayName: 'Spacer',
    description: 'Empty vertical space',
    category: 'layout',
    icon: 'move-vertical',
    defaultConfig: { height: 'medium' },
    isContainer: false,
    configSchema: {
      height: { type: 'select', options: ['small', 'medium', 'large', 'xlarge'], label: 'Height' },
    },
    collectsData: false,
  },
  
  'callout': {
    type: 'callout',
    displayName: 'Callout',
    description: 'A highlighted information box',
    category: 'layout',
    icon: 'lightbulb',
    defaultConfig: { color: 'blue', icon: 'info', content: '' },
    isContainer: false,
    configSchema: {
      title: { type: 'text', label: 'Title', optional: true },
      content: { type: 'richtext', label: 'Content' },
      color: { type: 'select', options: ['blue', 'green', 'yellow', 'red', 'purple', 'gray'], label: 'Color' },
      icon: { type: 'select', options: ['info', 'warning', 'error', 'success', 'lightbulb', 'help'], label: 'Icon' },
    },
    collectsData: false,
  },
  
  'image': {
    type: 'image',
    displayName: 'Image',
    description: 'Display an image',
    category: 'layout',
    icon: 'image',
    defaultConfig: { src: '', alt: '' },
    isContainer: false,
    configSchema: {
      src: { type: 'image-upload', label: 'Image' },
      alt: { type: 'text', label: 'Alt Text' },
      width: { type: 'select', options: ['auto', 'full', 'half'], label: 'Width' },
    },
    collectsData: false,
  },
  
  'video': {
    type: 'video',
    displayName: 'Video',
    description: 'Embed a video',
    category: 'layout',
    icon: 'video',
    defaultConfig: { url: '' },
    isContainer: false,
    configSchema: {
      url: { type: 'url', label: 'Video URL (YouTube, Vimeo)' },
      autoplay: { type: 'boolean', label: 'Autoplay' },
    },
    collectsData: false,
  },
  
  'hero': {
    type: 'hero',
    displayName: 'Hero Section',
    description: 'A large header section with title and optional background',
    category: 'layout',
    icon: 'layout',
    defaultConfig: { title: 'Welcome', align: 'center', height: 'medium' },
    isContainer: false,
    configSchema: {
      title: { type: 'text', label: 'Title' },
      subtitle: { type: 'text', label: 'Subtitle', optional: true },
      backgroundImage: { type: 'image-upload', label: 'Background Image', optional: true },
      backgroundColor: { type: 'color', label: 'Background Color', optional: true },
      align: { type: 'select', options: ['left', 'center', 'right'], label: 'Alignment' },
      height: { type: 'select', options: ['small', 'medium', 'large', 'full'], label: 'Height' },
      overlay: { type: 'boolean', label: 'Dark Overlay' },
      overlayOpacity: { type: 'range', min: 0, max: 100, label: 'Overlay Opacity' },
    },
    collectsData: false,
  },
  
  // ==========================================================================
  // FIELD BLOCKS
  // ==========================================================================
  
  'text-field': {
    type: 'text-field',
    displayName: 'Short Text',
    description: 'Single line text input',
    category: 'field',
    icon: 'type',
    defaultConfig: { label: 'Text Field', name: '', required: false, width: 'full' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      placeholder: { type: 'text', label: 'Placeholder', optional: true },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['full', 'half', 'third', 'quarter'], label: 'Width' },
      maxLength: { type: 'number', label: 'Max Length', optional: true },
      minLength: { type: 'number', label: 'Min Length', optional: true },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'textarea-field': {
    type: 'textarea-field',
    displayName: 'Long Text',
    description: 'Multi-line text input',
    category: 'field',
    icon: 'align-left',
    defaultConfig: { label: 'Long Text', name: '', required: false, width: 'full' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      placeholder: { type: 'text', label: 'Placeholder', optional: true },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['full', 'half'], label: 'Width' },
      rows: { type: 'number', label: 'Rows', default: 4 },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'email-field': {
    type: 'email-field',
    displayName: 'Email',
    description: 'Email address input',
    category: 'field',
    icon: 'mail',
    defaultConfig: { label: 'Email', name: 'email', required: true, width: 'half' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      placeholder: { type: 'text', label: 'Placeholder', optional: true },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['full', 'half'], label: 'Width' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'value_only', privacyLevel: 'pii' },
  },
  
  'phone-field': {
    type: 'phone-field',
    displayName: 'Phone',
    description: 'Phone number input',
    category: 'field',
    icon: 'phone',
    defaultConfig: { label: 'Phone', name: 'phone', required: false, width: 'half' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['full', 'half'], label: 'Width' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'skip', privacyLevel: 'pii' },
  },
  
  'number-field': {
    type: 'number-field',
    displayName: 'Number',
    description: 'Numeric input',
    category: 'field',
    icon: 'hash',
    defaultConfig: { label: 'Number', name: '', required: false, width: 'half' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['full', 'half', 'third', 'quarter'], label: 'Width' },
      min: { type: 'number', label: 'Minimum', optional: true },
      max: { type: 'number', label: 'Maximum', optional: true },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'url-field': {
    type: 'url-field',
    displayName: 'URL',
    description: 'Website URL input',
    category: 'field',
    icon: 'link',
    defaultConfig: { label: 'Website', name: '', required: false, width: 'full' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      placeholder: { type: 'text', label: 'Placeholder', default: 'https://' },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['full', 'half'], label: 'Width' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'value_only', privacyLevel: 'public' },
  },
  
  'address-field': {
    type: 'address-field',
    displayName: 'Address',
    description: 'Address with autocomplete',
    category: 'field',
    icon: 'map-pin',
    defaultConfig: { label: 'Address', name: 'address', required: false, width: 'full' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'pii' },
  },
  
  'date-field': {
    type: 'date-field',
    displayName: 'Date',
    description: 'Date picker',
    category: 'field',
    icon: 'calendar',
    defaultConfig: { label: 'Date', name: '', required: false, width: 'half' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['full', 'half', 'third'], label: 'Width' },
      minDate: { type: 'date', label: 'Min Date', optional: true },
      maxDate: { type: 'date', label: 'Max Date', optional: true },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'datetime-field': {
    type: 'datetime-field',
    displayName: 'Date & Time',
    description: 'Date and time picker',
    category: 'field',
    icon: 'calendar-clock',
    defaultConfig: { label: 'Date & Time', name: '', required: false, width: 'half' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['full', 'half'], label: 'Width' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'time-field': {
    type: 'time-field',
    displayName: 'Time',
    description: 'Time picker',
    category: 'field',
    icon: 'clock',
    defaultConfig: { label: 'Time', name: '', required: false, width: 'third' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['half', 'third', 'quarter'], label: 'Width' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'select-field': {
    type: 'select-field',
    displayName: 'Dropdown',
    description: 'Single select dropdown',
    category: 'field',
    icon: 'chevron-down',
    defaultConfig: { label: 'Select', name: '', required: false, width: 'half', options: [] },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      width: { type: 'select', options: ['full', 'half', 'third'], label: 'Width' },
      options: { type: 'options-list', label: 'Options' },
      allowCustom: { type: 'boolean', label: 'Allow Custom Value' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'multiselect-field': {
    type: 'multiselect-field',
    displayName: 'Multi-Select',
    description: 'Multiple choice selection',
    category: 'field',
    icon: 'list-checks',
    defaultConfig: { label: 'Multi-Select', name: '', required: false, width: 'full', options: [] },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      options: { type: 'options-list', label: 'Options' },
      minSelections: { type: 'number', label: 'Min Selections', optional: true },
      maxSelections: { type: 'number', label: 'Max Selections', optional: true },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'radio-field': {
    type: 'radio-field',
    displayName: 'Radio Buttons',
    description: 'Single choice radio buttons',
    category: 'field',
    icon: 'circle-dot',
    defaultConfig: { label: 'Choose One', name: '', required: false, options: [] },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      options: { type: 'options-list', label: 'Options' },
      layout: { type: 'select', options: ['vertical', 'horizontal'], label: 'Layout' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'checkbox-field': {
    type: 'checkbox-field',
    displayName: 'Checkbox',
    description: 'Single checkbox or agreement',
    category: 'field',
    icon: 'check-square',
    defaultConfig: { label: 'I agree', name: '', required: false },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'richtext', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'file-field': {
    type: 'file-field',
    displayName: 'File Upload',
    description: 'File attachment upload',
    category: 'field',
    icon: 'upload',
    defaultConfig: { label: 'Upload File', name: '', required: false, width: 'full' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      acceptedTypes: { type: 'multi-select', options: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'], label: 'Accepted Types' },
      maxSize: { type: 'number', label: 'Max Size (MB)', default: 10 },
      maxFiles: { type: 'number', label: 'Max Files', default: 1 },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'skip', privacyLevel: 'sensitive' },
  },
  
  'image-field': {
    type: 'image-field',
    displayName: 'Image Upload',
    description: 'Image file upload',
    category: 'field',
    icon: 'image',
    defaultConfig: { label: 'Upload Image', name: '', required: false, width: 'full' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      maxSize: { type: 'number', label: 'Max Size (MB)', default: 5 },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'skip', privacyLevel: 'sensitive' },
  },
  
  'signature-field': {
    type: 'signature-field',
    displayName: 'Signature',
    description: 'Electronic signature capture',
    category: 'field',
    icon: 'pen-tool',
    defaultConfig: { label: 'Signature', name: 'signature', required: true },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'skip', privacyLevel: 'pii' },
  },
  
  'rating-field': {
    type: 'rating-field',
    displayName: 'Rating',
    description: 'Star rating input',
    category: 'field',
    icon: 'star',
    defaultConfig: { label: 'Rating', name: '', required: false, maxRating: 5 },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      maxRating: { type: 'select', options: [3, 4, 5, 10], label: 'Max Rating' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'rank-field': {
    type: 'rank-field',
    displayName: 'Ranking',
    description: 'Order items by preference',
    category: 'field',
    icon: 'arrow-up-down',
    defaultConfig: { label: 'Rank', name: '', required: false, options: [] },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      required: { type: 'boolean', label: 'Required' },
      options: { type: 'options-list', label: 'Items to Rank' },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  // ==========================================================================
  // CONTAINER BLOCKS
  // ==========================================================================
  
  'section': {
    type: 'section',
    displayName: 'Section',
    description: 'A group of related fields',
    category: 'container',
    icon: 'folder',
    defaultConfig: { title: 'Section', collapsible: false },
    isContainer: true,
    allowedChildren: undefined, // All block types allowed
    configSchema: {
      title: { type: 'text', label: 'Title' },
      description: { type: 'text', label: 'Description', optional: true },
      collapsible: { type: 'boolean', label: 'Collapsible' },
      defaultCollapsed: { type: 'boolean', label: 'Start Collapsed' },
    },
    collectsData: false,
  },
  
  'group': {
    type: 'group',
    displayName: 'Group',
    description: 'Visual grouping of fields',
    category: 'container',
    icon: 'box',
    defaultConfig: {},
    isContainer: true,
    configSchema: {
      showBorder: { type: 'boolean', label: 'Show Border' },
      padding: { type: 'select', options: ['none', 'small', 'medium', 'large'], label: 'Padding' },
    },
    collectsData: false,
  },
  
  'repeater': {
    type: 'repeater',
    displayName: 'Repeater',
    description: 'Repeatable group of fields (e.g., education history)',
    category: 'container',
    icon: 'list-plus',
    defaultConfig: { label: 'Items', name: '', minItems: 0, maxItems: 10 },
    isContainer: true,
    configSchema: {
      label: { type: 'text', label: 'Label' },
      name: { type: 'text', label: 'Field Name' },
      description: { type: 'text', label: 'Description', optional: true },
      minItems: { type: 'number', label: 'Min Items', default: 0 },
      maxItems: { type: 'number', label: 'Max Items', default: 10 },
      itemLabel: { type: 'text', label: 'Item Label (use {index})', default: 'Item {index}' },
      allowReorder: { type: 'boolean', label: 'Allow Reorder', default: true },
    },
    collectsData: true,
    aiSchema: { embeddingStrategy: 'with_label', privacyLevel: 'public' },
  },
  
  'columns': {
    type: 'columns',
    displayName: 'Columns',
    description: 'Multi-column layout',
    category: 'container',
    icon: 'columns',
    defaultConfig: { columns: 2 },
    isContainer: true,
    configSchema: {
      columns: { type: 'select', options: [2, 3, 4], label: 'Number of Columns' },
      gap: { type: 'select', options: ['small', 'medium', 'large'], label: 'Gap' },
    },
    collectsData: false,
  },
  
  'card': {
    type: 'card',
    displayName: 'Card',
    description: 'Bordered card container',
    category: 'container',
    icon: 'credit-card',
    defaultConfig: {},
    isContainer: true,
    configSchema: {
      title: { type: 'text', label: 'Title', optional: true },
      showHeader: { type: 'boolean', label: 'Show Header' },
    },
    collectsData: false,
  },
  
  'accordion': {
    type: 'accordion',
    displayName: 'Accordion',
    description: 'Collapsible content sections',
    category: 'container',
    icon: 'chevron-down',
    defaultConfig: { allowMultiple: false },
    isContainer: true,
    configSchema: {
      allowMultiple: { type: 'boolean', label: 'Allow Multiple Open' },
    },
    collectsData: false,
  },
  
  'tabs': {
    type: 'tabs',
    displayName: 'Tabs',
    description: 'Tabbed content sections',
    category: 'container',
    icon: 'folder-open',
    defaultConfig: {},
    isContainer: true,
    configSchema: {
      defaultTab: { type: 'number', label: 'Default Tab Index', default: 0 },
    },
    collectsData: false,
  },
  
  // ==========================================================================
  // NAVIGATION BLOCKS
  // ==========================================================================
  
  'nav-button': {
    type: 'nav-button',
    displayName: 'Navigation Button',
    description: 'Button to navigate between pages',
    category: 'navigation',
    icon: 'arrow-right',
    defaultConfig: { label: 'Continue', targetPage: '', variant: 'primary' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Button Text' },
      targetPage: { type: 'page-select', label: 'Target Page' },
      variant: { type: 'select', options: ['primary', 'secondary', 'outline', 'ghost'], label: 'Style' },
    },
    collectsData: false,
  },
  
  'nav-link': {
    type: 'nav-link',
    displayName: 'Navigation Link',
    description: 'Text link to another page',
    category: 'navigation',
    icon: 'link',
    defaultConfig: { label: 'Go to page', targetPage: '' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Link Text' },
      targetPage: { type: 'page-select', label: 'Target Page' },
    },
    collectsData: false,
  },
  
  'progress-steps': {
    type: 'progress-steps',
    displayName: 'Progress Steps',
    description: 'Visual step indicator',
    category: 'navigation',
    icon: 'git-branch',
    defaultConfig: { showLabels: true },
    isContainer: false,
    configSchema: {
      showLabels: { type: 'boolean', label: 'Show Step Labels' },
      orientation: { type: 'select', options: ['horizontal', 'vertical'], label: 'Orientation' },
    },
    collectsData: false,
  },
  
  'breadcrumbs': {
    type: 'breadcrumbs',
    displayName: 'Breadcrumbs',
    description: 'Navigation breadcrumb trail',
    category: 'navigation',
    icon: 'chevron-right',
    defaultConfig: {},
    isContainer: false,
    configSchema: {
      separator: { type: 'select', options: ['/', '>', '→', '•'], label: 'Separator' },
    },
    collectsData: false,
  },
  
  // ==========================================================================
  // DISPLAY BLOCKS (Post-Submission)
  // ==========================================================================
  
  'status-card': {
    type: 'status-card',
    displayName: 'Status Card',
    description: 'Application status display',
    category: 'display',
    icon: 'info',
    defaultConfig: { showProgress: true, showTimeline: true, showNextSteps: true },
    isContainer: false,
    configSchema: {
      showProgress: { type: 'boolean', label: 'Show Progress' },
      showTimeline: { type: 'boolean', label: 'Show Timeline' },
      showNextSteps: { type: 'boolean', label: 'Show Next Steps' },
      compactMode: { type: 'boolean', label: 'Compact Mode' },
    },
    collectsData: false,
  },
  
  'progress-bar': {
    type: 'progress-bar',
    displayName: 'Progress Bar',
    description: 'Visual progress indicator',
    category: 'display',
    icon: 'bar-chart',
    defaultConfig: { showPercentage: true },
    isContainer: false,
    configSchema: {
      showPercentage: { type: 'boolean', label: 'Show Percentage' },
      showSteps: { type: 'boolean', label: 'Show Steps' },
      animated: { type: 'boolean', label: 'Animated' },
    },
    collectsData: false,
  },
  
  'data-summary': {
    type: 'data-summary',
    displayName: 'Data Summary',
    description: 'Read-only display of submitted data',
    category: 'display',
    icon: 'file-text',
    defaultConfig: { showAllFields: true },
    isContainer: false,
    configSchema: {
      showAllFields: { type: 'boolean', label: 'Show All Fields' },
      fieldsToShow: { type: 'field-select', label: 'Fields to Show', optional: true },
      allowEdit: { type: 'boolean', label: 'Allow Edit' },
    },
    collectsData: false,
  },
  
  'timeline': {
    type: 'timeline',
    displayName: 'Timeline',
    description: 'Application history timeline',
    category: 'display',
    icon: 'git-commit',
    defaultConfig: {},
    isContainer: false,
    configSchema: {
      showDates: { type: 'boolean', label: 'Show Dates', default: true },
      maxItems: { type: 'number', label: 'Max Items', optional: true },
    },
    collectsData: false,
  },
  
  'message-list': {
    type: 'message-list',
    displayName: 'Messages',
    description: 'Communication thread with staff',
    category: 'display',
    icon: 'message-square',
    defaultConfig: { allowReply: true, showTimestamps: true },
    isContainer: false,
    configSchema: {
      allowReply: { type: 'boolean', label: 'Allow Reply' },
      showTimestamps: { type: 'boolean', label: 'Show Timestamps' },
      maxMessages: { type: 'number', label: 'Max Messages', optional: true },
    },
    collectsData: false,
  },
  
  'document-list': {
    type: 'document-list',
    displayName: 'Documents',
    description: 'List of uploaded documents',
    category: 'display',
    icon: 'file',
    defaultConfig: { allowDownload: true },
    isContainer: false,
    configSchema: {
      allowDownload: { type: 'boolean', label: 'Allow Download' },
      allowUpload: { type: 'boolean', label: 'Allow New Uploads' },
    },
    collectsData: false,
  },
  
  // ==========================================================================
  // AUTH BLOCKS
  // ==========================================================================
  
  'login-form': {
    type: 'login-form',
    displayName: 'Login Form',
    description: 'User authentication form',
    category: 'auth',
    icon: 'log-in',
    defaultConfig: { showForgotPassword: true, showSignupLink: true, redirectTo: 'dashboard' },
    isContainer: true,
    configSchema: {
      showForgotPassword: { type: 'boolean', label: 'Show Forgot Password' },
      showSignupLink: { type: 'boolean', label: 'Show Signup Link' },
      showSocialLogin: { type: 'boolean', label: 'Show Social Login' },
      redirectTo: { type: 'page-select', label: 'Redirect After Login' },
    },
    collectsData: false,
  },
  
  'signup-form': {
    type: 'signup-form',
    displayName: 'Signup Form',
    description: 'New user registration form',
    category: 'auth',
    icon: 'user-plus',
    defaultConfig: { showLoginLink: true, redirectTo: 'dashboard' },
    isContainer: true,
    configSchema: {
      showLoginLink: { type: 'boolean', label: 'Show Login Link' },
      showSocialLogin: { type: 'boolean', label: 'Show Social Login' },
      showTermsCheckbox: { type: 'boolean', label: 'Show Terms Checkbox' },
      termsUrl: { type: 'url', label: 'Terms URL', optional: true },
      privacyUrl: { type: 'url', label: 'Privacy URL', optional: true },
      redirectTo: { type: 'page-select', label: 'Redirect After Signup' },
    },
    collectsData: false,
  },
  
  'password-reset': {
    type: 'password-reset',
    displayName: 'Password Reset',
    description: 'Password reset form',
    category: 'auth',
    icon: 'key',
    defaultConfig: {},
    isContainer: false,
    configSchema: {
      showLoginLink: { type: 'boolean', label: 'Show Login Link' },
    },
    collectsData: false,
  },
  
  'logout-button': {
    type: 'logout-button',
    displayName: 'Logout Button',
    description: 'Button to log out',
    category: 'auth',
    icon: 'log-out',
    defaultConfig: { label: 'Logout' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Button Text' },
      confirmMessage: { type: 'text', label: 'Confirmation Message', optional: true },
    },
    collectsData: false,
  },
  
  // ==========================================================================
  // ACTION BLOCKS
  // ==========================================================================
  
  'submit-button': {
    type: 'submit-button',
    displayName: 'Submit Button',
    description: 'Form submission button',
    category: 'action',
    icon: 'check',
    defaultConfig: { label: 'Submit', redirectTo: 'submitted' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Button Text' },
      loadingLabel: { type: 'text', label: 'Loading Text', default: 'Submitting...' },
      successLabel: { type: 'text', label: 'Success Text', optional: true },
      confirmMessage: { type: 'text', label: 'Confirmation Message', optional: true },
      redirectTo: { type: 'page-select', label: 'Redirect After Submit' },
    },
    collectsData: false,
  },
  
  'save-draft-button': {
    type: 'save-draft-button',
    displayName: 'Save Draft',
    description: 'Save progress button',
    category: 'action',
    icon: 'save',
    defaultConfig: { label: 'Save Draft' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Button Text' },
      showLastSaved: { type: 'boolean', label: 'Show Last Saved Time' },
    },
    collectsData: false,
  },
  
  'cancel-button': {
    type: 'cancel-button',
    displayName: 'Cancel Button',
    description: 'Cancel action button',
    category: 'action',
    icon: 'x',
    defaultConfig: { label: 'Cancel', redirectTo: 'dashboard' },
    isContainer: false,
    configSchema: {
      label: { type: 'text', label: 'Button Text' },
      confirmMessage: { type: 'text', label: 'Confirmation Message', optional: true },
      redirectTo: { type: 'page-select', label: 'Redirect To' },
    },
    collectsData: false,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get block definition by type
 */
export function getBlockDefinition(type: BlockType): BlockTypeDefinition | undefined {
  return BLOCK_REGISTRY[type];
}

/**
 * Get all blocks of a specific category
 */
export function getBlocksByCategory(category: BlockCategory): BlockTypeDefinition[] {
  return Object.values(BLOCK_REGISTRY).filter(block => block.category === category);
}

/**
 * Get all container blocks
 */
export function getContainerBlocks(): BlockTypeDefinition[] {
  return Object.values(BLOCK_REGISTRY).filter(block => block.isContainer);
}

/**
 * Get all field blocks (data collection)
 */
export function getFieldBlocks(): BlockTypeDefinition[] {
  return Object.values(BLOCK_REGISTRY).filter(block => block.collectsData);
}

/**
 * Create a new block with default config
 */
export function createBlock(type: BlockType, overrides?: Partial<Record<string, unknown>>): {
  id: string;
  type: BlockType;
  category: BlockCategory;
  position: number;
  config: Record<string, unknown>;
} {
  const definition = BLOCK_REGISTRY[type];
  if (!definition) {
    throw new Error(`Unknown block type: ${type}`);
  }
  
  return {
    id: crypto.randomUUID(),
    type,
    category: definition.category,
    position: 0,
    config: { ...definition.defaultConfig, ...overrides },
  };
}

/**
 * Category display names and icons
 */
export const BLOCK_CATEGORIES: Record<BlockCategory, { displayName: string; icon: string; description: string }> = {
  layout: { displayName: 'Layout', icon: 'layout', description: 'Visual elements and structure' },
  field: { displayName: 'Fields', icon: 'text-cursor-input', description: 'Data collection inputs' },
  container: { displayName: 'Containers', icon: 'box', description: 'Group and organize blocks' },
  navigation: { displayName: 'Navigation', icon: 'navigation', description: 'Page flow and progress' },
  display: { displayName: 'Display', icon: 'eye', description: 'Read-only data and status' },
  auth: { displayName: 'Authentication', icon: 'lock', description: 'Login and signup' },
  action: { displayName: 'Actions', icon: 'zap', description: 'Buttons and triggers' },
};
