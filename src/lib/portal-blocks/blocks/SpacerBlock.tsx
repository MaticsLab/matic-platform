'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { BlockComponentProps } from '../BlockRenderer';

interface SpacerBlockProps extends BlockComponentProps {
  block: {
    id: string;
    type: 'spacer';
    category: 'layout';
    position: number;
    config: {
      height?: 'small' | 'medium' | 'large' | 'xlarge';
    };
  };
}

export default function SpacerBlock({ block, mode, className }: SpacerBlockProps) {
  const { height = 'medium' } = block.config;
  
  const heightClass = {
    small: 'h-4',
    medium: 'h-8',
    large: 'h-16',
    xlarge: 'h-24',
  }[height];
  
  return (
    <div 
      className={cn(
        heightClass, 
        mode === 'edit' && 'border border-dashed border-gray-200 rounded bg-gray-50/50',
        className
      )} 
    />
  );
}
