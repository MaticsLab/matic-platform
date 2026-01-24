'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { BlockComponentProps } from '../BlockRenderer';
import type { HeadingBlockConfig } from '@/types/portal-blocks';

interface HeadingBlockProps extends BlockComponentProps {
  block: {
    id: string;
    type: 'heading';
    category: 'layout';
    position: number;
    config: HeadingBlockConfig;
  };
}

export default function HeadingBlock({ block, mode, className }: HeadingBlockProps) {
  const { level = 2, content, align = 'left' } = block.config;
  
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];
  
  const sizeClass = {
    1: 'text-4xl font-bold',
    2: 'text-3xl font-bold',
    3: 'text-2xl font-semibold',
    4: 'text-xl font-semibold',
    5: 'text-lg font-medium',
    6: 'text-base font-medium',
  }[level];
  
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <Tag className={cn(sizeClass, alignClass, 'text-foreground', className)}>
      {content || (mode === 'edit' ? 'Click to edit heading' : '')}
    </Tag>
  );
}
