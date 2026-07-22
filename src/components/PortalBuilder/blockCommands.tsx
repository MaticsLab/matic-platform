import React from 'react';
import {
  Type, AlignLeft, Hash, Mail, Phone, Calendar,
  CheckSquare, List, Upload, Heading, ToggleLeft,
  FileText, Star, MapPin, Layers, Repeat, Image,
  Link, Clock, Minus, AlertCircle, UserPlus
} from 'lucide-react';
import { FieldType } from '@/types/portal';

// ============================================================================
// BLOCK COMMANDS - Organized by Category
// ============================================================================

export interface BlockCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  fieldType: FieldType;
  category: string;
  keywords?: string[];
  defaultConfig?: Record<string, unknown>;
}

export const BLOCK_COMMANDS: BlockCommand[] = [
  // Basic
  { id: 'text', label: 'Text Input', description: 'Single line text field', icon: <Type className="w-4 h-4" />, fieldType: 'text', category: 'Basic', keywords: ['short', 'input', 'field'] },
  { id: 'textarea', label: 'Text Area', description: 'Multi-line text field', icon: <AlignLeft className="w-4 h-4" />, fieldType: 'textarea', category: 'Basic', keywords: ['paragraph', 'multiline'] },
  { id: 'number', label: 'Number', description: 'Numeric input', icon: <Hash className="w-4 h-4" />, fieldType: 'number', category: 'Basic', keywords: ['integer', 'decimal'] },
  { id: 'email', label: 'Email', description: 'Email with validation', icon: <Mail className="w-4 h-4" />, fieldType: 'email', category: 'Basic' },
  { id: 'phone', label: 'Phone', description: 'Phone number field', icon: <Phone className="w-4 h-4" />, fieldType: 'phone', category: 'Basic', keywords: ['telephone', 'mobile'] },
  { id: 'url', label: 'URL', description: 'Website URL field', icon: <Link className="w-4 h-4" />, fieldType: 'url', category: 'Basic', keywords: ['link', 'website'] },

  // Selection
  { id: 'select', label: 'Dropdown', description: 'Single option selection', icon: <List className="w-4 h-4" />, fieldType: 'select', category: 'Selection', defaultConfig: { options: ['Option 1', 'Option 2', 'Option 3'] } },
  { id: 'multiselect', label: 'Multi-Select', description: 'Multiple option selection', icon: <CheckSquare className="w-4 h-4" />, fieldType: 'multiselect', category: 'Selection', defaultConfig: { options: ['Option 1', 'Option 2', 'Option 3'] } },
  { id: 'radio', label: 'Single Choice', description: 'Radio button options', icon: <ToggleLeft className="w-4 h-4" />, fieldType: 'radio', category: 'Selection', defaultConfig: { options: ['Option 1', 'Option 2'] } },
  { id: 'checkbox', label: 'Checkbox', description: 'True/false toggle', icon: <CheckSquare className="w-4 h-4" />, fieldType: 'checkbox', category: 'Selection' },

  // Date & Time
  { id: 'date', label: 'Date', description: 'Date picker', icon: <Calendar className="w-4 h-4" />, fieldType: 'date', category: 'Date & Time' },
  { id: 'time', label: 'Time', description: 'Time picker', icon: <Clock className="w-4 h-4" />, fieldType: 'time', category: 'Date & Time' },
  { id: 'datetime', label: 'Date & Time', description: 'Date and time picker', icon: <Calendar className="w-4 h-4" />, fieldType: 'datetime', category: 'Date & Time' },

  // Media
  { id: 'file', label: 'File Upload', description: 'File upload field', icon: <Upload className="w-4 h-4" />, fieldType: 'file', category: 'Media', keywords: ['attachment', 'document'] },
  { id: 'image', label: 'Image Upload', description: 'Image upload field', icon: <Image className="w-4 h-4" />, fieldType: 'image', category: 'Media', keywords: ['photo', 'picture'] },

  // Layout
  { id: 'heading', label: 'Heading', description: 'Section heading', icon: <Heading className="w-4 h-4" />, fieldType: 'heading', category: 'Layout', keywords: ['title', 'h1', 'h2', 'h3'] },
  { id: 'paragraph', label: 'Paragraph', description: 'Display text', icon: <FileText className="w-4 h-4" />, fieldType: 'paragraph', category: 'Layout', keywords: ['text', 'description'] },
  { id: 'divider', label: 'Divider', description: 'Visual divider', icon: <Minus className="w-4 h-4" />, fieldType: 'divider', category: 'Layout', keywords: ['separator', 'hr'] },
  { id: 'callout', label: 'Callout Box', description: 'Highlighted message', icon: <AlertCircle className="w-4 h-4" />, fieldType: 'callout', category: 'Layout', keywords: ['info', 'warning', 'note'] },

  // Advanced
  { id: 'address', label: 'Address', description: 'Address with autocomplete', icon: <MapPin className="w-4 h-4" />, fieldType: 'address', category: 'Advanced', keywords: ['location'] },
  { id: 'rating', label: 'Rating', description: 'Star rating (1-5)', icon: <Star className="w-4 h-4" />, fieldType: 'rating', category: 'Advanced', keywords: ['stars', 'score'] },
  { id: 'group', label: 'Group', description: 'Field group', icon: <Layers className="w-4 h-4" />, fieldType: 'group', category: 'Advanced', defaultConfig: { columns: 2 } },
  { id: 'repeater', label: 'Repeater', description: 'Repeatable section', icon: <Repeat className="w-4 h-4" />, fieldType: 'repeater', category: 'Advanced', defaultConfig: { minItems: 0, maxItems: 10 } },
  { id: 'recommendation', label: 'Reference', description: 'Request references/recommendations', icon: <UserPlus className="w-4 h-4" />, fieldType: 'recommendation', category: 'Advanced', keywords: ['letter', 'reference', 'recommendation', 'lor'] },
];

export const CATEGORIES = ['Basic', 'Selection', 'Date & Time', 'Media', 'Layout', 'Advanced'];
