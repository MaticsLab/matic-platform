'use client';

/**
 * Layout Field Renderer
 * Handles: divider, heading, paragraph, callout
 * 
 * These are display-only fields that don't have values.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Separator } from '@/ui-components/separator';
import { 
  Lightbulb, Info, AlertTriangle, AlertCircle, CheckCircle, HelpCircle 
} from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { safeFieldString } from '../types';

const LAYOUT_SUBTYPES = [
  'divider',
  'heading',
  'paragraph',
  'callout',
] as const;

// Callout color configurations
const CALLOUT_COLORS: Record<string, { bg: string; border: string; icon: string; title: string; text: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', title: 'text-blue-900', text: 'text-blue-700' },
  green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', title: 'text-green-900', text: 'text-green-700' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', title: 'text-yellow-900', text: 'text-yellow-700' },
  red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', title: 'text-red-900', text: 'text-red-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', title: 'text-purple-900', text: 'text-purple-700' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-600', title: 'text-gray-900', text: 'text-gray-700' },
};

const CALLOUT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  lightbulb: Lightbulb,
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
  help: HelpCircle,
};

function DividerRenderer({ className }: { className?: string }) {
  return (
    <div className={cn('w-full py-4', className)}>
      <hr className="border-t border-gray-200" />
    </div>
  );
}

function HeadingRenderer({ 
  label, 
  className 
}: { 
  label: string; 
  className?: string;
}) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-900 mt-4 mb-2', className)}>
      {label}
    </h3>
  );
}

function ParagraphRenderer({ 
  content, 
  className 
}: { 
  content: string; 
  className?: string;
}) {
  // Check if content has HTML tags (rich text)
  const isRichText = /<[a-z][\s\S]*>/i.test(content);
  
  if (isRichText) {
    return (
      <div 
        className={cn(
          'prose prose-sm max-w-none text-gray-600 mb-4',
          '[&_a]:text-blue-600 [&_a]:underline',
          '[&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:list-decimal [&_ol]:pl-5',
          className
        )}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  
  return (
    <p className={cn('text-gray-600 text-sm leading-relaxed mb-4', className)}>
      {content}
    </p>
  );
}

function CalloutRenderer({ 
  label,
  description,
  color = 'blue',
  icon = 'lightbulb',
  className,
}: { 
  label: string;
  description?: string;
  color?: string;
  icon?: string;
  className?: string;
}) {
  const colors = CALLOUT_COLORS[color] || CALLOUT_COLORS.blue;
  const CalloutIcon = CALLOUT_ICONS[icon] || Lightbulb;
  
  return (
    <div className={cn(
      'flex items-start gap-3 p-4 border rounded-lg my-4',
      colors.bg,
      colors.border,
      className
    )}>
      <CalloutIcon className={cn('w-5 h-5 mt-0.5 shrink-0', colors.icon)} />
      <div>
        <p className={cn('text-sm font-medium', colors.title)}>{label}</p>
        {description && (
          <p className={cn('text-sm mt-1', colors.text)}>{description}</p>
        )}
      </div>
    </div>
  );
}

export function LayoutRenderer(props: FieldRendererProps): React.ReactElement | null {
  const {
    field,
    config,
    className,
  } = props;

  const fieldType = field.field_type_id || field.type || '';

  switch (fieldType) {
    case 'divider':
      return <DividerRenderer className={className} />;
      
    case 'heading':
      return <HeadingRenderer label={safeFieldString(field.label)} className={className} />;
      
    case 'paragraph':
      return (
        <ParagraphRenderer 
          content={config?.content || safeFieldString(field.label) || ''} 
          className={className} 
        />
      );
      
    case 'callout':
      return (
        <CalloutRenderer
          label={safeFieldString(field.label)}
          description={safeFieldString(config?.description || field.description)}
          color={config?.color}
          icon={config?.icon}
          className={className}
        />
      );
      
    default:
      return null;
  }
}

// Export supported types for registration
export const LAYOUT_FIELD_TYPES = LAYOUT_SUBTYPES;
