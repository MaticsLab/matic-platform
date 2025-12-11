'use client';

/**
 * Submit Button Block
 * 
 * Form submission button with configurable behavior,
 * validation, and redirect options.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui-components/button';
import { Loader2, Send, Check, ArrowRight } from 'lucide-react';
import type { BlockComponentProps } from '../BlockRenderer';

interface SubmitConfig {
  label?: string;
  loadingLabel?: string;
  successLabel?: string;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
  fullWidth?: boolean;
  icon?: 'send' | 'check' | 'arrow' | 'none';
  iconPosition?: 'left' | 'right';
  redirectTo?: string;
  confirmMessage?: string;
  showConfirmDialog?: boolean;
}

interface SubmitButtonBlockProps extends BlockComponentProps {
  block: BlockComponentProps['block'] & {
    type: 'submit-button';
    category: 'action';
    config: SubmitConfig;
  };
}

const ICONS = {
  send: Send,
  check: Check,
  arrow: ArrowRight,
  none: null,
};

export default function SubmitButtonBlock({ 
  block, 
  mode, 
  themeColor,
  onAction,
  className 
}: SubmitButtonBlockProps) {
  const { 
    label = 'Submit',
    loadingLabel = 'Submitting...',
    successLabel = 'Submitted!',
    variant = 'default',
    size = 'default',
    fullWidth = true,
    icon = 'send',
    iconPosition = 'right',
    redirectTo,
    confirmMessage,
    showConfirmDialog = false,
  } = block.config;
  
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success'>('idle');
  
  const IconComponent = ICONS[icon];
  
  const handleClick = async () => {
    if (mode === 'preview' || mode === 'edit') return;
    if (status === 'loading') return;
    
    // Confirmation dialog
    if (showConfirmDialog && confirmMessage) {
      const confirmed = window.confirm(confirmMessage);
      if (!confirmed) return;
    }
    
    setStatus('loading');
    
    try {
      await onAction?.('submit', { redirectTo });
      setStatus('success');
      
      // Reset after a delay
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      setStatus('idle');
    }
  };
  
  const currentLabel = status === 'loading' 
    ? loadingLabel 
    : status === 'success' 
      ? successLabel 
      : label;
  
  const buttonStyle = variant === 'default' && themeColor 
    ? { backgroundColor: themeColor } 
    : undefined;
  
  return (
    <div className={cn(fullWidth ? 'w-full' : 'inline-block', className)}>
      <Button
        type={mode === 'view' ? 'submit' : 'button'}
        variant={variant}
        size={size}
        className={cn(fullWidth && 'w-full')}
        style={buttonStyle}
        disabled={status === 'loading' || mode === 'preview'}
        onClick={handleClick}
      >
        {/* Loading spinner */}
        {status === 'loading' && (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        )}
        
        {/* Left icon */}
        {IconComponent && iconPosition === 'left' && status === 'idle' && (
          <IconComponent className="h-4 w-4 mr-2" />
        )}
        
        {/* Success icon */}
        {status === 'success' && (
          <Check className="h-4 w-4 mr-2" />
        )}
        
        {currentLabel}
        
        {/* Right icon */}
        {IconComponent && iconPosition === 'right' && status === 'idle' && (
          <IconComponent className="h-4 w-4 ml-2" />
        )}
      </Button>
      
      {/* Edit mode info */}
      {mode === 'edit' && (
        <p className="text-xs text-gray-400 text-center mt-2 italic">
          {redirectTo ? `Redirects to: ${redirectTo}` : 'Submits the form'}
        </p>
      )}
    </div>
  );
}
