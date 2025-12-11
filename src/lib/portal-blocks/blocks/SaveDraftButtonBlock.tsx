'use client';

/**
 * Save Draft Button Block
 * 
 * Button for saving application progress without submitting.
 * Useful for long forms that users might want to complete later.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui-components/button';
import { Loader2, Save, Check, Clock } from 'lucide-react';
import type { BlockComponentProps } from '../BlockRenderer';

interface SaveDraftConfig {
  label?: string;
  loadingLabel?: string;
  successLabel?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
  fullWidth?: boolean;
  showLastSaved?: boolean;
  autoSaveInterval?: number; // in seconds, 0 = disabled
}

interface SaveDraftButtonBlockProps extends BlockComponentProps {
  block: BlockComponentProps['block'] & {
    type: 'save-draft-button';
    category: 'action';
    config: SaveDraftConfig;
  };
}

export default function SaveDraftButtonBlock({ 
  block, 
  mode, 
  context,
  onAction,
  className 
}: SaveDraftButtonBlockProps) {
  const { 
    label = 'Save Draft',
    loadingLabel = 'Saving...',
    successLabel = 'Saved!',
    variant = 'outline',
    size = 'default',
    fullWidth = false,
    showLastSaved = true,
    autoSaveInterval = 0,
  } = block.config;
  
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success'>('idle');
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  
  // Auto-save functionality
  React.useEffect(() => {
    if (autoSaveInterval <= 0 || mode !== 'view') return;
    
    const interval = setInterval(() => {
      handleSave();
    }, autoSaveInterval * 1000);
    
    return () => clearInterval(interval);
  }, [autoSaveInterval, mode]);
  
  const handleSave = async () => {
    if (mode === 'preview' || mode === 'edit') return;
    if (status === 'loading') return;
    
    setStatus('loading');
    
    try {
      await onAction?.('saveDraft', {});
      setStatus('success');
      setLastSaved(new Date());
      
      // Reset to idle after showing success
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
  
  const formatLastSaved = (date: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  return (
    <div className={cn('flex items-center gap-3', fullWidth && 'w-full', className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(fullWidth && 'flex-1')}
        disabled={status === 'loading' || mode === 'preview'}
        onClick={handleSave}
      >
        {status === 'loading' ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : status === 'success' ? (
          <Check className="h-4 w-4 mr-2 text-green-500" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        {currentLabel}
      </Button>
      
      {/* Last saved indicator */}
      {showLastSaved && lastSaved && status === 'idle' && (
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatLastSaved(lastSaved)}
        </span>
      )}
      
      {/* Auto-save indicator */}
      {autoSaveInterval > 0 && mode === 'edit' && (
        <span className="text-xs text-gray-400">
          Auto-saves every {autoSaveInterval}s
        </span>
      )}
    </div>
  );
}
