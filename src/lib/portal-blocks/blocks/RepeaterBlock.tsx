'use client';

/**
 * Repeater Block
 * 
 * A container block that allows users to add multiple instances
 * of the same set of child blocks (like employment history, education, etc.)
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui-components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import type { BlockComponentProps } from '../BlockRenderer';

interface RepeaterConfig {
  title?: string;
  description?: string;
  minItems?: number;
  maxItems?: number;
  addButtonLabel?: string;
  itemLabel?: string;
  collapsible?: boolean;
}

interface RepeaterBlock {
  id: string;
  type: 'repeater';
  category: 'container';
  position: number;
  config: RepeaterConfig;
  children?: BlockComponentProps['block'][];
}

interface RepeaterBlockProps extends Omit<BlockComponentProps, 'block'> {
  block: RepeaterBlock;
  renderChildren?: (children: BlockComponentProps['block'][], itemIndex: number) => React.ReactNode;
}

export default function RepeaterBlock({ 
  block, 
  mode, 
  values,
  onChange,
  renderChildren,
  className 
}: RepeaterBlockProps) {
  const { 
    title, 
    description,
    minItems = 0,
    maxItems = 10,
    addButtonLabel = 'Add Item',
    itemLabel = 'Item',
    collapsible = true,
  } = block.config;
  
  // Get current items from values
  const fieldName = `repeater_${block.id}`;
  const items: Record<string, unknown>[] = (values?.[fieldName] as Record<string, unknown>[]) || [];
  const [collapsedItems, setCollapsedItems] = React.useState<Set<number>>(new Set());
  
  const addItem = () => {
    if (items.length >= maxItems) return;
    const newItems = [...items, {}];
    onChange?.(fieldName, newItems);
  };
  
  const removeItem = (index: number) => {
    if (items.length <= minItems) return;
    const newItems = items.filter((_, i) => i !== index);
    onChange?.(fieldName, newItems);
  };
  
  const toggleCollapse = (index: number) => {
    const newCollapsed = new Set(collapsedItems);
    if (newCollapsed.has(index)) {
      newCollapsed.delete(index);
    } else {
      newCollapsed.add(index);
    }
    setCollapsedItems(newCollapsed);
  };
  
  const canAdd = items.length < maxItems;
  const canRemove = items.length > minItems;
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      {(title || description) && (
        <div className="space-y-1">
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      
      {/* Items */}
      <div className="space-y-3">
        {items.length === 0 && mode === 'edit' && (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
            <p>No items yet</p>
            <p className="text-sm">Click &quot;{addButtonLabel}&quot; to add the first item</p>
          </div>
        )}
        
        {items.map((item, index) => (
          <Card key={index} className="relative">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <CardTitle className="text-base">
                    {itemLabel} {index + 1}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {collapsible && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCollapse(index)}
                    >
                      {collapsedItems.has(index) ? '▶' : '▼'}
                    </Button>
                  )}
                  {canRemove && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {!collapsedItems.has(index) && (
              <CardContent className="pt-0">
                {block.children && renderChildren?.(block.children, index)}
                {!block.children?.length && mode === 'edit' && (
                  <div className="border-2 border-dashed border-border rounded-lg p-4 text-center text-muted-foreground text-sm">
                    Define repeater fields
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
      
      {/* Add Button */}
      {canAdd && mode !== 'preview' && (
        <Button
          type="button"
          variant="outline"
          onClick={addItem}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          {addButtonLabel}
        </Button>
      )}
      
      {/* Limits info */}
      {mode === 'edit' && (
        <p className="text-xs text-muted-foreground text-center">
          {minItems > 0 && `Minimum: ${minItems} · `}
          Maximum: {maxItems} items
        </p>
      )}
    </div>
  );
}
