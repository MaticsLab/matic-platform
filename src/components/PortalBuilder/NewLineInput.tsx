'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ============================================================================
// NEW LINE INPUT - Doc-like typing experience
// ============================================================================

interface NewLineInputProps {
  onOpenSlashMenu: (position: { top: number; left: number }) => void;
  onQueryChange?: (query: string) => void;
  isMenuOpen?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function NewLineInput({ onOpenSlashMenu, onQueryChange, isMenuOpen, placeholder = "Type '/' for commands...", autoFocus }: NewLineInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear value when menu closes
  useEffect(() => {
    if (!isMenuOpen && value.startsWith('/')) {
      setValue('');
    }
  }, [isMenuOpen, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // If value starts with '/', handle slash commands
    if (newValue.startsWith('/')) {
      if (!isMenuOpen) {
        // Open menu at input position
        const rect = inputRef.current?.getBoundingClientRect();
        if (rect) {
          onOpenSlashMenu({ top: rect.bottom + 4, left: rect.left });
        }
      }
      // Update query (everything after the /)
      onQueryChange?.(newValue.slice(1));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setValue('');
      inputRef.current?.blur();
    }
  };

  return (
    <div
      className={cn(
        "py-2 px-1 rounded-lg transition-all cursor-text",
        isFocused ? "bg-gray-50" : "hover:bg-gray-50/50"
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          // Delay clearing to allow menu interactions
          setTimeout(() => setValue(''), 200);
        }}
        placeholder={isFocused ? "Type '/' for commands" : placeholder}
        className="w-full bg-transparent border-none outline-none text-gray-600 placeholder:text-gray-400 text-sm"
        autoFocus={autoFocus}
      />
    </div>
  );
}
