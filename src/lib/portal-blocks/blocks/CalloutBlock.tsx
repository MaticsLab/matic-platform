'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Lightbulb, Info, AlertTriangle, AlertCircle, CheckCircle, HelpCircle 
} from 'lucide-react';
import type { BlockComponentProps } from '../BlockRenderer';
import type { CalloutBlockConfig } from '@/types/portal-blocks';

interface CalloutBlockProps extends BlockComponentProps {
  block: {
    id: string;
    type: 'callout';
    category: 'layout';
    position: number;
    config: CalloutBlockConfig;
  };
}

const CALLOUT_COLORS = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', title: 'text-blue-900', text: 'text-blue-700' },
  green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', title: 'text-green-900', text: 'text-green-700' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', title: 'text-yellow-900', text: 'text-yellow-700' },
  red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', title: 'text-red-900', text: 'text-red-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', title: 'text-purple-900', text: 'text-purple-700' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-600', title: 'text-gray-900', text: 'text-gray-700' },
};

const CALLOUT_ICONS = {
  lightbulb: Lightbulb,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
  help: HelpCircle,
};

export default function CalloutBlock({ block, mode, className }: CalloutBlockProps) {
  const { title, content, color = 'blue', icon = 'info' } = block.config;
  
  const colors = CALLOUT_COLORS[color] || CALLOUT_COLORS.blue;
  const IconComponent = CALLOUT_ICONS[icon] || Info;
  
  return (
    <div className={cn(
      'flex items-start gap-3 p-4 border rounded-lg',
      colors.bg,
      colors.border,
      className
    )}>
      <IconComponent className={cn('w-5 h-5 mt-0.5 shrink-0', colors.icon)} />
      <div className="flex-1 min-w-0">
        {title && (
          <p className={cn('text-sm font-medium mb-1', colors.title)}>
            {title}
          </p>
        )}
        <div className={cn('text-sm', colors.text)}>
          {content || (mode === 'edit' ? 'Add callout content...' : '')}
        </div>
      </div>
    </div>
  );
}
