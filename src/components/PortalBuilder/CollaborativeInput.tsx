'use client';

import { useRef } from 'react';

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
 * Simple input component that relies on PortalConfigSyncBridge
 * for all collaboration via Y.Map.
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
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
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
