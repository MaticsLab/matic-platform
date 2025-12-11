/**
 * Portal Blocks Module
 * 
 * Composable block-based system for building portals with:
 * - Layout blocks (headings, paragraphs, dividers, etc.)
 * - Field blocks (text inputs, selects, file uploads, etc.)
 * - Container blocks (sections, repeaters)
 * - Display blocks (status cards, progress bars, messages)
 * - Auth blocks (login, signup forms)
 * - Action blocks (submit, save draft buttons)
 */

// Types
export * from '@/types/portal-blocks';

// Block registry
export { 
  BLOCK_REGISTRY,
  BLOCK_CATEGORIES,
  getBlockDefinition,
  getBlocksByCategory,
  getFieldBlocks,
  createBlock,
} from './registry';

// Renderers
export {
  BlockRenderer,
  PageRenderer,
  PortalRenderer,
  type BlockRendererProps,
  type BlockComponentProps,
  type BlockRenderMode,
  type PageRendererProps,
  type PortalRendererProps,
} from './BlockRenderer';

// Adapter (Section/Field <-> Block conversion)
export {
  fieldToBlock,
  sectionToBlocks,
  blockToField,
  blocksToSection,
  createFieldBlock,
  findBlockById,
  updateBlockInTree,
  deleteBlockFromTree,
  insertBlockAt,
  moveBlock,
} from './adapter';
