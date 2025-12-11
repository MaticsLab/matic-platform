'use client';

/**
 * Section Block
 * 
 * A container block that groups other blocks together with optional
 * title, description, and styling.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui-components/card';
import type { BlockComponentProps } from '../BlockRenderer';

interface SectionConfig {
  title?: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  style?: 'card' | 'plain' | 'bordered';
  padding?: 'none' | 'small' | 'medium' | 'large';
}

interface SectionBlock {
  id: string;
  type: 'section';
  category: 'container';
  position: number;
  config: SectionConfig;
  children?: BlockComponentProps['block'][];
}

interface SectionBlockProps extends Omit<BlockComponentProps, 'block'> {
  block: SectionBlock;
  renderChildren?: (children: BlockComponentProps['block'][]) => React.ReactNode;
}

export default function SectionBlock({ 
  block, 
  mode, 
  renderChildren,
  className 
}: SectionBlockProps) {
  const { 
    title, 
    description, 
    collapsible = false,
    defaultCollapsed = false,
    style = 'card',
    padding = 'medium',
  } = block.config;
  
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  
  const paddingClass = {
    none: 'p-0',
    small: 'p-2',
    medium: 'p-4',
    large: 'p-6',
  }[padding];
  
  const content = (
    <>
      {block.children && renderChildren?.(block.children)}
      {!block.children?.length && mode === 'edit' && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400">
          Drag blocks here
        </div>
      )}
    </>
  );
  
  if (style === 'plain') {
    return (
      <div className={cn('space-y-4', className)}>
        {(title || description) && (
          <div className="space-y-1">
            {title && <h3 className="text-lg font-semibold">{title}</h3>}
            {description && <p className="text-sm text-gray-500">{description}</p>}
          </div>
        )}
        <div className={cn(paddingClass)}>
          {!isCollapsed && content}
        </div>
      </div>
    );
  }
  
  if (style === 'bordered') {
    return (
      <div className={cn('border border-gray-200 rounded-lg', className)}>
        {(title || description) && (
          <div 
            className={cn(
              'px-4 py-3 border-b border-gray-200 flex items-center justify-between',
              collapsible && 'cursor-pointer hover:bg-gray-50'
            )}
            onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
          >
            <div>
              {title && <h3 className="font-medium">{title}</h3>}
              {description && <p className="text-sm text-gray-500">{description}</p>}
            </div>
            {collapsible && (
              <span className="text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
            )}
          </div>
        )}
        <div className={cn(paddingClass, isCollapsed && 'hidden')}>
          {content}
        </div>
      </div>
    );
  }
  
  // Card style (default)
  return (
    <Card className={cn(className)}>
      {(title || description) && (
        <CardHeader
          className={cn(collapsible && 'cursor-pointer hover:bg-gray-50')}
          onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
        >
          <div className="flex items-center justify-between">
            <div>
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {collapsible && (
              <span className="text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn(paddingClass, isCollapsed && 'hidden')}>
        {content}
      </CardContent>
    </Card>
  );
}
