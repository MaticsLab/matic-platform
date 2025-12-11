/**
 * Adapter to convert between legacy Section/Field format and new Block format
 * This allows PortalEditor to work with both formats during migration
 */

import { 
  Block, 
  BlockType, 
  FieldBlockConfig,
  TextFieldBlockConfig,
  SelectFieldBlockConfig, 
  SectionBlockConfig,
  RepeaterBlockConfig,
  RepeaterBlock,
  SectionBlock,
  HeadingBlockConfig,
  ParagraphBlockConfig,
  BaseBlock,
  BlockCategory
} from '@/types/portal-blocks';
import { Section, Field } from '@/types/portal';

/**
 * Create a base block with default values
 */
function createBaseBlock<TConfig>(
  id: string,
  type: BlockType,
  category: BlockCategory,
  config: TConfig,
  position: number = 0
): BaseBlock<TConfig> {
  return {
    id,
    type,
    category,
    position,
    config,
  };
}

/**
 * Convert a Field to a Block
 */
export function fieldToBlock(field: Field, position: number = 0): Block {
  // Map field types to block types
  const fieldTypeMap: Record<string, { type: BlockType; category: BlockCategory }> = {
    text: { type: 'text-field', category: 'field' },
    textarea: { type: 'textarea-field', category: 'field' },
    email: { type: 'email-field', category: 'field' },
    phone: { type: 'phone-field', category: 'field' },
    number: { type: 'number-field', category: 'field' },
    date: { type: 'date-field', category: 'field' },
    select: { type: 'select-field', category: 'field' },
    checkbox: { type: 'checkbox-field', category: 'field' },
    file: { type: 'file-field', category: 'field' },
    radio: { type: 'radio-field', category: 'field' },
    multiselect: { type: 'multiselect-field', category: 'field' },
    address: { type: 'address-field', category: 'field' },
    signature: { type: 'signature-field', category: 'field' },
    repeater: { type: 'repeater', category: 'container' },
    group: { type: 'group', category: 'container' },
    rating: { type: 'rating-field', category: 'field' },
    rank: { type: 'rank-field', category: 'field' },
  };

  const blockInfo = fieldTypeMap[field.type] || { type: 'text-field' as BlockType, category: 'field' as BlockCategory };
  
  // Handle repeater/group fields with children
  if (field.type === 'repeater') {
    const childBlocks = (field.children || []).map((child, idx) => fieldToBlock(child, idx));
    
    const config: RepeaterBlockConfig = {
      label: field.label,
      name: field.id,
      description: field.description,
      minItems: field.config?.minItems || 1,
      maxItems: field.config?.maxItems || 10,
      itemLabel: field.config?.addButtonText || 'Item #{index}',
      required: field.required,
    };

    return {
      ...createBaseBlock(field.id, 'repeater', 'container', config, position),
      children: childBlocks,
    } as Block;
  }

  if (field.type === 'group') {
    const childBlocks = (field.children || []).map((child, idx) => fieldToBlock(child, idx));
    
    const config: SectionBlockConfig = {
      title: field.label,
      description: field.description,
    };

    return {
      ...createBaseBlock(field.id, 'group', 'container', config, position),
      children: childBlocks,
    } as Block;
  }

  // Build base field config
  const baseConfig: FieldBlockConfig = {
    label: field.label,
    name: field.id,
    placeholder: field.placeholder,
    description: field.description,
    required: field.required,
    width: field.width === 'full' ? 'full' : field.width === 'half' ? 'half' : 'full',
    validation: field.validation,
  };

  // Add type-specific config
  if (field.type === 'select' || field.type === 'radio' || field.type === 'multiselect') {
    const options = (field.options || field.config?.options || []).map((opt: string | { value: string; label: string }) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
    
    const selectConfig: SelectFieldBlockConfig = {
      ...baseConfig,
      options,
    };
    
    return createBaseBlock(field.id, blockInfo.type, blockInfo.category, selectConfig, position) as Block;
  }

  if (field.type === 'text') {
    const textConfig: TextFieldBlockConfig = {
      ...baseConfig,
      maxLength: field.config?.maxLength,
      minLength: field.config?.minLength,
      pattern: field.config?.pattern,
    };
    
    return createBaseBlock(field.id, blockInfo.type, blockInfo.category, textConfig, position) as Block;
  }

  // Default field block
  return createBaseBlock(field.id, blockInfo.type, blockInfo.category, baseConfig, position) as Block;
}

/**
 * Convert a Section to an array of Blocks
 */
export function sectionToBlocks(section: Section): Block[] {
  const blocks: Block[] = [];

  // Add section title as heading block
  if (section.title) {
    const headingBlock: BaseBlock<HeadingBlockConfig> = {
      id: `${section.id}-title`,
      type: 'heading',
      category: 'layout',
      position: 0,
      config: {
        level: 2,
        content: section.title,
        align: 'left',
      },
    };
    blocks.push(headingBlock as Block);
  }

  // Add section description as paragraph block
  if (section.description) {
    const paragraphBlock: BaseBlock<ParagraphBlockConfig> = {
      id: `${section.id}-description`,
      type: 'paragraph',
      category: 'layout',
      position: 1,
      config: {
        content: section.description,
        align: 'left',
      },
    };
    blocks.push(paragraphBlock as Block);
  }

  // Convert each field to a block
  section.fields.forEach((field, idx) => {
    blocks.push(fieldToBlock(field, idx + 2));
  });

  return blocks;
}

/**
 * Convert a Block back to a Field
 */
export function blockToField(block: Block): Field | null {
  // Check if it's a field block
  const fieldTypes = [
    'text-field', 'textarea-field', 'email-field', 'phone-field',
    'number-field', 'date-field', 'select-field', 'checkbox-field',
    'file-field', 'radio-field', 'multiselect-field', 'repeater'
  ];
  
  if (!fieldTypes.includes(block.type)) {
    return null;
  }

  // Map block types back to field types
  const blockTypeMap: Record<string, string> = {
    'text-field': 'text',
    'textarea-field': 'textarea',
    'email-field': 'email',
    'phone-field': 'phone',
    'number-field': 'number',
    'date-field': 'date',
    'select-field': 'select',
    'checkbox-field': 'checkbox',
    'file-field': 'file',
    'radio-field': 'radio',
    'multiselect-field': 'multiselect',
    'repeater': 'repeater',
  };

  const fieldType = blockTypeMap[block.type] || 'text';
  const config = block.config as FieldBlockConfig;

  const field: Field = {
    id: config.name || block.id,
    type: fieldType as Field['type'],
    label: config.label || 'Untitled Field',
    placeholder: config.placeholder,
    description: config.description,
    required: config.required || false,
    width: config.width || 'full',
    validation: config.validation,
  };

  // Add options for select types
  if (block.type === 'select-field' || block.type === 'radio-field' || block.type === 'multiselect-field') {
    const selectConfig = block.config as SelectFieldBlockConfig;
    if (selectConfig.options) {
      field.options = selectConfig.options.map(opt => opt.value);
    }
  }

  // Handle repeater with children
  if (block.type === 'repeater' && 'children' in block) {
    const repeaterBlock = block as RepeaterBlock;
    field.children = repeaterBlock.children
      .map((child: Block) => blockToField(child))
      .filter((f): f is Field => f !== null);
  }

  return field;
}

/**
 * Convert Blocks back to a Section
 */
export function blocksToSection(sectionId: string, blocks: Block[], originalSection?: Section): Section {
  let title = originalSection?.title || '';
  let description = originalSection?.description || '';
  const fields: Field[] = [];

  blocks.forEach(block => {
    // Extract title from heading block
    if (block.type === 'heading' && block.id.endsWith('-title')) {
      title = (block.config as HeadingBlockConfig).content;
      return;
    }

    // Extract description from paragraph block
    if (block.type === 'paragraph' && block.id.endsWith('-description')) {
      description = (block.config as ParagraphBlockConfig).content;
      return;
    }

    // Convert field blocks
    const field = blockToField(block);
    if (field) {
      fields.push(field);
    }
  });

  return {
    id: sectionId,
    title,
    description,
    sectionType: originalSection?.sectionType || 'form',
    fields,
  };
}

/**
 * Create a new block from a field type
 */
export function createFieldBlock(fieldType: string, id?: string): Block {
  const blockId = id || `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const typeMap: Record<string, { type: BlockType; category: BlockCategory }> = {
    text: { type: 'text-field', category: 'field' },
    textarea: { type: 'textarea-field', category: 'field' },
    email: { type: 'email-field', category: 'field' },
    phone: { type: 'phone-field', category: 'field' },
    number: { type: 'number-field', category: 'field' },
    date: { type: 'date-field', category: 'field' },
    select: { type: 'select-field', category: 'field' },
    checkbox: { type: 'checkbox-field', category: 'field' },
    file: { type: 'file-field', category: 'field' },
    radio: { type: 'radio-field', category: 'field' },
    multiselect: { type: 'multiselect-field', category: 'field' },
  };

  const blockInfo = typeMap[fieldType] || { type: 'text-field' as BlockType, category: 'field' as BlockCategory };
  
  const config: FieldBlockConfig = {
    label: 'New Field',
    name: blockId,
    required: false,
    width: 'full',
  };
  
  return createBaseBlock(blockId, blockInfo.type, blockInfo.category, config, 0) as Block;
}

/**
 * Check if a block has children (is a container block)
 */
function hasChildren(block: Block): block is SectionBlock | RepeaterBlock {
  return block.type === 'section' || block.type === 'repeater' || block.type === 'group';
}

/**
 * Find a block by ID in a tree of blocks
 */
export function findBlockById(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) {
      return block;
    }
    if (hasChildren(block)) {
      const found = findBlockById(block.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Update a block in a tree of blocks
 */
export function updateBlockInTree(
  blocks: Block[], 
  id: string, 
  updates: Partial<BaseBlock<Record<string, unknown>>>
): Block[] {
  return blocks.map(block => {
    if (block.id === id) {
      return { 
        ...block, 
        ...updates,
        config: updates.config ? { ...block.config, ...updates.config } : block.config,
      } as Block;
    }
    if (hasChildren(block)) {
      return {
        ...block,
        children: updateBlockInTree(block.children, id, updates),
      } as Block;
    }
    return block;
  });
}

/**
 * Delete a block from a tree of blocks
 */
export function deleteBlockFromTree(blocks: Block[], id: string): Block[] {
  return blocks
    .filter(block => block.id !== id)
    .map(block => {
      if (hasChildren(block)) {
        return {
          ...block,
          children: deleteBlockFromTree(block.children, id),
        } as Block;
      }
      return block;
    });
}

/**
 * Insert a block at a specific position
 */
export function insertBlockAt(blocks: Block[], block: Block, index: number): Block[] {
  const newBlocks = [...blocks];
  newBlocks.splice(index, 0, block);
  return newBlocks;
}

/**
 * Move a block to a new position
 */
export function moveBlock(blocks: Block[], fromIndex: number, toIndex: number): Block[] {
  const newBlocks = [...blocks];
  const [removed] = newBlocks.splice(fromIndex, 1);
  newBlocks.splice(toIndex, 0, removed);
  return newBlocks;
}
