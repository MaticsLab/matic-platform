/**
 * Unified Field System
 * 
 * This module provides a unified interface for rendering fields across all contexts:
 * - Table grid view (display and inline edit)
 * - Forms and portals (input mode)
 * - Review and display (read-only)
 * - Builders and previews
 * 
 * Usage:
 * ```tsx
 * import { FieldRenderer, TableCellRenderer, FormFieldRenderer } from '@/components/Fields';
 * 
 * // In a table
 * <TableCellRenderer field={field} value={row.data[field.name]} onChange={handleChange} />
 * 
 * // In a form
 * <FormFieldRenderer field={field} value={formData[field.name]} onChange={handleChange} />
 * 
 * // Direct usage
 * <FieldRenderer field={field} value={value} mode="display" context="review" />
 * ```
 */

// Main components
export {
  FieldRenderer,
  TableCellRenderer,
  FormFieldRenderer,
  PortalFieldRenderer,
  ReviewFieldRenderer,
} from './FieldRenderer';

// Types
export type {
  FieldRendererProps,
  FieldRenderMode,
  FieldRenderContext,
  FieldRendererComponent,
  FieldRendererRegistryEntry,
  MergedFieldConfig,
} from './types';

// Registry utilities
export {
  getFieldType,
  getFieldTypeSync,
  getAllFieldTypes,
  getFieldTypesByCategory,
  mergeFieldConfig,
  isContainerType,
  preloadFieldTypes,
  clearFieldTypeCache,
  getFieldTypeIcon,
  getFieldTypeColor,
} from './registry';

// Hooks
export {
  useFieldTypes,
  useFieldType,
  usePreloadFieldTypes,
} from './useFieldTypes';

// Individual renderers (for advanced use cases)
export { TextRenderer } from './renderers/TextRenderer';
export { NumberRenderer } from './renderers/NumberRenderer';
export { SelectRenderer } from './renderers/SelectRenderer';
export { DateRenderer } from './renderers/DateRenderer';
export { CheckboxRenderer } from './renderers/CheckboxRenderer';
export { FileRenderer } from './renderers/FileRenderer';
export { LinkRenderer } from './renderers/LinkRenderer';
export { LookupRenderer } from './renderers/LookupRenderer';
export { RollupRenderer } from './renderers/RollupRenderer';
export { FormulaRenderer } from './renderers/FormulaRenderer';
export { RepeaterRenderer } from './renderers/RepeaterRenderer';
export { SectionRenderer } from './renderers/SectionRenderer';
export { AddressRenderer } from './renderers/AddressRenderer';
export { RankRenderer } from './renderers/RankRenderer';
export { LayoutRenderer } from './renderers/LayoutRenderer';

// Portal adapter (for bridging portal Field type to unified renderer)
export {
  PortalFieldAdapter,
  canUseUnifiedRenderer,
  renderPortalField,
} from './PortalFieldAdapter';

// Table cell adapter (for bridging table columns to unified renderer)
export {
  TableCellAdapter,
  tableColumnToField,
} from './TableCellAdapter';
