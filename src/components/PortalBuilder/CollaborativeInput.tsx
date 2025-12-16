'use client';

import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import { useYDoc } from './CollaborationProvider';

interface CollaborativeInputProps {
  fieldId: string;
  fieldKey: 'label' | 'description';
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
}

/**
 * Input component that syncs text character-by-character via Yjs
 * for true Google Docs-style collaboration.
 * 
 * IMPORTANT: This component manages its own state via Y.Text and only
 * calls onChange to update the parent when receiving REMOTE changes.
 * Local changes go directly to Y.Text and are synced via PortalConfigSyncBridge.
 */
export function CollaborativeInput({
  fieldId,
  fieldKey,
  value,
  onChange,
  className,
  style,
  placeholder,
  onClick,
  onFocus,
}: CollaborativeInputProps) {
  const ydoc = useYDoc();
  const inputRef = useRef<HTMLInputElement>(null);
  const yTextRef = useRef<Y.Text | null>(null);
  const lastRemoteValueRef = useRef<string>('');
  
  // Initialize Y.Text for this specific field
  useEffect(() => {
    if (!ydoc) return;
    
    const yText = ydoc.getText(`field-${fieldId}-${fieldKey}`);
    yTextRef.current = yText;
    
    // Sync Y.Text with prop value if different
    const currentYText = yText.toString();
    if (currentYText !== value && value !== undefined) {
      ydoc.transact(() => {
        if (yText.length > 0) {
          yText.delete(0, yText.length);
        }
        if (value) {
          yText.insert(0, value);
        }
      });
    }
    
    // Observer for remote changes (from other users)
    const observer = (event: Y.YTextEvent) => {
      // Skip local transactions (changes we made ourselves)
      if (event.transaction.local) {
        return;
      }
      
      const text = yText.toString();
      
      // Skip if this is the same value we already have
      if (text === lastRemoteValueRef.current) return;
      
      console.log(`[Collab] 📥 Remote edit for field ${fieldId}-${fieldKey}:`, text);
      lastRemoteValueRef.current = text;
      const input = inputRef.current;
      
      // Preserve cursor position during remote updates
      const cursorPos = input?.selectionStart || 0;
      
      // Update parent state
      onChange(text);
      
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        if (input && document.activeElement === input) {
          input.setSelectionRange(cursorPos, cursorPos);
        }
      });
    };
    
    yText.observe(observer);
    
    return () => {
      yText.unobserve(observer);
    };
  }, [ydoc, fieldId, fieldKey, value, onChange]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const yText = yTextRef.current;
    
    if (!yText || !ydoc) {
      // Fallback if no Yjs - directly update parent
      onChange(newValue);
      return;
    }
    
    const oldValue = yText.toString();
    if (newValue === oldValue) return;
    
    // Update last remote value to prevent echo
    lastRemoteValueRef.current = newValue;
    
    // Immediately update parent to reflect change in local state
    // This prevents cursor jumping while typing
    onChange(newValue);
    
    // Update Y.Text - this will sync to other clients
    // Mark as local to prevent our own observer from firing
    ydoc.transact(() => {
      if (yText.length > 0) {
        yText.delete(0, yText.length);
      }
      if (newValue.length > 0) {
        yText.insert(0, newValue);
      }
    });
  };
  
  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={handleChange}
      onClick={onClick}
      onFocus={onFocus}
      className={className}
      style={style}
      placeholder={placeholder}
    />
  );
}
