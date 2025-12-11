/**
 * Block Settings Panel
 * 
 * Right sidebar panel for editing the selected block's properties.
 * Dynamically renders config fields based on block type.
 */

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import { Label } from '@/ui-components/label';
import { Switch } from '@/ui-components/switch';
import { Textarea } from '@/ui-components/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui-components/select';
import { Separator } from '@/ui-components/separator';
import { ScrollArea } from '@/ui-components/scroll-area';
import { X, Settings, Trash2, Copy, Eye, EyeOff, Plus, GripVertical } from 'lucide-react';
import { getBlockDefinition } from '@/lib/portal-blocks/registry';
import type { Block, BlockType } from '@/types/portal-blocks';

interface BlockSettingsPanelProps {
  /** List of blocks to search for selected block */
  blocks: Block[];
  /** The ID of the selected block */
  selectedBlockId: string | null;
  /** Callback when block is updated */
  onUpdateBlock: (blockId: string, updates: Partial<Block>) => void;
  /** Callback to delete block */
  onDeleteBlock?: (blockId: string) => void;
  /** Callback to duplicate block */
  onDuplicateBlock?: (blockId: string) => void;
  /** Callback to close panel */
  onClose: () => void;
}

// Helper to find block by ID in a flat or nested structure
function findBlock(blocks: Block[], id: string): Block | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    if ('children' in block && Array.isArray((block as any).children)) {
      const found = findBlock((block as any).children, id);
      if (found) return found;
    }
  }
  return null;
}

export function BlockSettingsPanel({
  blocks,
  selectedBlockId,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onClose,
}: BlockSettingsPanelProps) {
  const block = selectedBlockId ? findBlock(blocks, selectedBlockId) : null;
  
  if (!block) {
    return (
      <div className="p-4 text-center text-gray-500">
        Select a block to edit its settings
      </div>
    );
  }

  const definition = getBlockDefinition(block.type);
  const config = block.config as Record<string, unknown>;

  const updateConfig = (key: string, value: unknown) => {
    onUpdateBlock(block.id, {
      config: { ...config, [key]: value },
    });
  };

  if (!definition) {
    return (
      <div className="p-4 text-center text-gray-500">
        Unknown block type: {block.type}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600">
            {definition.icon}
          </div>
          <div>
            <h3 className="font-medium text-sm">{definition.displayName}</h3>
            <p className="text-xs text-gray-500">{block.category}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Common Field Settings */}
          {block.category === 'field' && (
            <FieldBlockSettings config={config} updateConfig={updateConfig} />
          )}

          {/* Layout Block Settings */}
          {block.category === 'layout' && (
            <LayoutBlockSettings 
              blockType={block.type} 
              config={config} 
              updateConfig={updateConfig} 
            />
          )}

          {/* Container Block Settings */}
          {block.category === 'container' && (
            <ContainerBlockSettings config={config} updateConfig={updateConfig} />
          )}

          {/* Display Block Settings */}
          {block.category === 'display' && (
            <DisplayBlockSettings config={config} updateConfig={updateConfig} />
          )}

          {/* Action Block Settings */}
          {block.category === 'action' && (
            <ActionBlockSettings config={config} updateConfig={updateConfig} />
          )}

          <Separator />

          {/* Visibility Settings */}
          <div className="space-y-3">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Visibility
            </Label>
            <div className="flex items-center justify-between">
              <span className="text-sm">Hidden</span>
              <Switch
                checked={config.hidden === true}
                onCheckedChange={(checked) => updateConfig('hidden', checked)}
              />
            </div>
            <p className="text-xs text-gray-400">
              Hidden blocks won't appear in the public portal
            </p>
          </div>

          {/* Advanced ID */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Block ID
            </Label>
            <Input
              value={block.id}
              disabled
              className="font-mono text-xs bg-gray-50"
            />
          </div>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className="p-4 border-t space-y-2">
        <div className="flex gap-2">
          {onDuplicateBlock && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onDuplicateBlock(block.id)}
            >
              <Copy className="w-3 h-3 mr-1.5" />
              Duplicate
            </Button>
          )}
          {onDeleteBlock && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => onDeleteBlock(block.id)}
            >
              <Trash2 className="w-3 h-3 mr-1.5" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FIELD BLOCK SETTINGS
// ============================================================================

interface FieldSettingsProps {
  config: Record<string, unknown>;
  updateConfig: (key: string, value: unknown) => void;
}

function FieldBlockSettings({ config, updateConfig }: FieldSettingsProps) {
  return (
    <>
      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          value={(config.label as string) || ''}
          onChange={(e) => updateConfig('label', e.target.value)}
          placeholder="Enter field label"
        />
      </div>

      {/* Field Name (for form data) */}
      <div className="space-y-2">
        <Label htmlFor="name">Field Name</Label>
        <Input
          id="name"
          value={(config.name as string) || ''}
          onChange={(e) => updateConfig('name', e.target.value)}
          placeholder="field_name"
          className="font-mono text-sm"
        />
        <p className="text-xs text-gray-400">
          Used in form data and API. Use snake_case.
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={(config.description as string) || ''}
          onChange={(e) => updateConfig('description', e.target.value)}
          placeholder="Help text shown below the field"
          rows={2}
        />
      </div>

      {/* Placeholder */}
      <div className="space-y-2">
        <Label htmlFor="placeholder">Placeholder</Label>
        <Input
          id="placeholder"
          value={(config.placeholder as string) || ''}
          onChange={(e) => updateConfig('placeholder', e.target.value)}
          placeholder="Placeholder text"
        />
      </div>

      <Separator />

      {/* Required */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Required</Label>
          <p className="text-xs text-gray-400">Field must be filled</p>
        </div>
        <Switch
          checked={config.required === true}
          onCheckedChange={(checked) => updateConfig('required', checked)}
        />
      </div>

      {/* Width */}
      <div className="space-y-2">
        <Label>Width</Label>
        <Select
          value={(config.width as string) || 'full'}
          onValueChange={(value) => updateConfig('width', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Width</SelectItem>
            <SelectItem value="half">Half Width</SelectItem>
            <SelectItem value="third">One Third</SelectItem>
            <SelectItem value="quarter">One Quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Options (for select/radio/checkbox) */}
      {config.options !== undefined && (
        <OptionsEditor
          options={(config.options as string[]) || []}
          onChange={(options) => updateConfig('options', options)}
        />
      )}
    </>
  );
}

// ============================================================================
// LAYOUT BLOCK SETTINGS
// ============================================================================

function LayoutBlockSettings({ 
  blockType, 
  config, 
  updateConfig 
}: FieldSettingsProps & { blockType: BlockType }) {
  
  if (blockType === 'heading') {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="content">Heading Text</Label>
          <Input
            id="content"
            value={(config.content as string) || ''}
            onChange={(e) => updateConfig('content', e.target.value)}
            placeholder="Enter heading"
          />
        </div>
        <div className="space-y-2">
          <Label>Level</Label>
          <Select
            value={String(config.level || 2)}
            onValueChange={(value) => updateConfig('level', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">H1 - Extra Large</SelectItem>
              <SelectItem value="2">H2 - Large</SelectItem>
              <SelectItem value="3">H3 - Medium</SelectItem>
              <SelectItem value="4">H4 - Small</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Alignment</Label>
          <Select
            value={(config.align as string) || 'left'}
            onValueChange={(value) => updateConfig('align', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  if (blockType === 'paragraph') {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="content">Text</Label>
          <Textarea
            id="content"
            value={(config.content as string) || ''}
            onChange={(e) => updateConfig('content', e.target.value)}
            placeholder="Enter paragraph text"
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <Label>Alignment</Label>
          <Select
            value={(config.align as string) || 'left'}
            onValueChange={(value) => updateConfig('align', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="right">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  if (blockType === 'callout') {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={(config.title as string) || ''}
            onChange={(e) => updateConfig('title', e.target.value)}
            placeholder="Callout title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            value={(config.content as string) || ''}
            onChange={(e) => updateConfig('content', e.target.value)}
            placeholder="Callout message"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <Select
            value={(config.color as string) || 'blue'}
            onValueChange={(value) => updateConfig('color', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="blue">Blue - Info</SelectItem>
              <SelectItem value="green">Green - Success</SelectItem>
              <SelectItem value="yellow">Yellow - Warning</SelectItem>
              <SelectItem value="red">Red - Error</SelectItem>
              <SelectItem value="purple">Purple</SelectItem>
              <SelectItem value="gray">Gray</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Icon</Label>
          <Select
            value={(config.icon as string) || 'info'}
            onValueChange={(value) => updateConfig('icon', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="lightbulb">Lightbulb</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="help">Help</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    );
  }

  if (blockType === 'spacer') {
    return (
      <div className="space-y-2">
        <Label>Height</Label>
        <Select
          value={(config.height as string) || 'medium'}
          onValueChange={(value) => updateConfig('height', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small (16px)</SelectItem>
            <SelectItem value="medium">Medium (32px)</SelectItem>
            <SelectItem value="large">Large (48px)</SelectItem>
            <SelectItem value="xlarge">Extra Large (64px)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }

  return null;
}

// ============================================================================
// CONTAINER BLOCK SETTINGS
// ============================================================================

function ContainerBlockSettings({ config, updateConfig }: FieldSettingsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Section Title</Label>
        <Input
          id="title"
          value={(config.title as string) || ''}
          onChange={(e) => updateConfig('title', e.target.value)}
          placeholder="Section title"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={(config.description as string) || ''}
          onChange={(e) => updateConfig('description', e.target.value)}
          placeholder="Section description"
          rows={2}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Collapsible</Label>
        <Switch
          checked={config.collapsible === true}
          onCheckedChange={(checked) => updateConfig('collapsible', checked)}
        />
      </div>
    </>
  );
}

// ============================================================================
// DISPLAY BLOCK SETTINGS
// ============================================================================

function DisplayBlockSettings({ config, updateConfig }: FieldSettingsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={(config.title as string) || ''}
          onChange={(e) => updateConfig('title', e.target.value)}
          placeholder="Block title"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Show Progress</Label>
        <Switch
          checked={config.showProgress !== false}
          onCheckedChange={(checked) => updateConfig('showProgress', checked)}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label>Show Timeline</Label>
        <Switch
          checked={config.showTimeline !== false}
          onCheckedChange={(checked) => updateConfig('showTimeline', checked)}
        />
      </div>
    </>
  );
}

// ============================================================================
// ACTION BLOCK SETTINGS
// ============================================================================

function ActionBlockSettings({ config, updateConfig }: FieldSettingsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="label">Button Label</Label>
        <Input
          id="label"
          value={(config.label as string) || ''}
          onChange={(e) => updateConfig('label', e.target.value)}
          placeholder="Submit"
        />
      </div>
      <div className="space-y-2">
        <Label>Button Style</Label>
        <Select
          value={(config.variant as string) || 'default'}
          onValueChange={(value) => updateConfig('variant', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Primary</SelectItem>
            <SelectItem value="secondary">Secondary</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label>Full Width</Label>
        <Switch
          checked={config.fullWidth !== false}
          onCheckedChange={(checked) => updateConfig('fullWidth', checked)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="redirectTo">Redirect After Submit</Label>
        <Input
          id="redirectTo"
          value={(config.redirectTo as string) || ''}
          onChange={(e) => updateConfig('redirectTo', e.target.value)}
          placeholder="/thank-you"
        />
      </div>
    </>
  );
}

// ============================================================================
// OPTIONS EDITOR (for select/multiselect/radio)
// ============================================================================

interface OptionsEditorProps {
  options: string[];
  onChange: (options: string[]) => void;
}

function OptionsEditor({ options, onChange }: OptionsEditorProps) {
  const addOption = () => {
    onChange([...options, `Option ${options.length + 1}`]);
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    onChange(newOptions);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <Label>Options</Label>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
            <Input
              value={option}
              onChange={(e) => updateOption(index, e.target.value)}
              className="flex-1"
            />
            <button
              onClick={() => removeOption(index)}
              className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addOption}
        className="w-full"
      >
        <Plus className="w-3 h-3 mr-1.5" />
        Add Option
      </Button>
    </div>
  );
}

export default BlockSettingsPanel;
