'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { BlockComponentProps } from '../BlockRenderer';
import type { ParagraphBlockConfig } from '@/types/portal-blocks';

interface ParagraphBlockProps extends BlockComponentProps {
  block: {
    id: string;
    type: 'paragraph';
    category: 'layout';
    position: number;
    config: ParagraphBlockConfig;
  };
}

export default function ParagraphBlock({ block, mode, className }: ParagraphBlockProps) {
  const { content, align = 'left' } = block.config;
  
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  }[align];
  
  // Check if content has HTML tags (rich text)
  const isRichText = /<[a-z][\s\S]*>/i.test(content || '');
  
  if (!content && mode !== 'edit') {
    return null;
  }
  
  if (isRichText) {
    return (
      <div 
        className={cn(
          'prose prose-sm max-w-none text-gray-600',
          '[&_a]:text-blue-600 [&_a]:underline',
          '[&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:list-decimal [&_ol]:pl-5',
          alignClass,
          className
        )}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  
  return (
    <p className={cn('text-gray-600 text-base leading-relaxed', alignClass, className)}>
      {content || (mode === 'edit' ? 'Click to add paragraph text...' : '')}
    </p>
  );
}
