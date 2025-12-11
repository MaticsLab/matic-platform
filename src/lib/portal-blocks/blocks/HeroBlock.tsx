'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { BlockComponentProps } from '../BlockRenderer';
import type { HeroBlockConfig } from '@/types/portal-blocks';

interface HeroBlockProps extends BlockComponentProps {
  block: {
    id: string;
    type: 'hero';
    category: 'layout';
    position: number;
    config: HeroBlockConfig;
  };
}

export default function HeroBlock({ block, mode, themeColor, className }: HeroBlockProps) {
  const { 
    title, 
    subtitle, 
    backgroundImage, 
    backgroundColor,
    align = 'center', 
    height = 'medium',
    overlay = false,
    overlayOpacity = 50,
  } = block.config;
  
  const alignClass = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  }[align];
  
  const heightClass = {
    small: 'min-h-[200px]',
    medium: 'min-h-[300px]',
    large: 'min-h-[400px]',
    full: 'min-h-[500px]',
  }[height];
  
  const bgStyle: React.CSSProperties = {};
  if (backgroundImage) {
    bgStyle.backgroundImage = `url(${backgroundImage})`;
    bgStyle.backgroundSize = 'cover';
    bgStyle.backgroundPosition = 'center';
  } else if (backgroundColor) {
    bgStyle.backgroundColor = backgroundColor;
  } else if (themeColor) {
    bgStyle.backgroundColor = themeColor;
  }
  
  const hasImage = !!backgroundImage;
  const textColorClass = hasImage ? 'text-white' : backgroundColor ? 'text-white' : 'text-gray-900';
  
  return (
    <div 
      className={cn(
        'relative flex flex-col justify-center p-8 rounded-xl',
        heightClass,
        alignClass,
        !backgroundImage && !backgroundColor && 'bg-gradient-to-br from-blue-50 to-indigo-100',
        className
      )}
      style={bgStyle}
    >
      {/* Overlay */}
      {overlay && backgroundImage && (
        <div 
          className="absolute inset-0 bg-black rounded-xl"
          style={{ opacity: overlayOpacity / 100 }}
        />
      )}
      
      {/* Content */}
      <div className={cn('relative z-10 max-w-2xl', alignClass)}>
        <h1 className={cn(
          'text-4xl font-bold mb-4',
          textColorClass
        )}>
          {title || (mode === 'edit' ? 'Hero Title' : '')}
        </h1>
        {(subtitle || mode === 'edit') && (
          <p className={cn(
            'text-xl opacity-90',
            textColorClass
          )}>
            {subtitle || (mode === 'edit' ? 'Add a subtitle...' : '')}
          </p>
        )}
      </div>
    </div>
  );
}
