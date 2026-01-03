'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectOption {
  value: string;
  label?: string;
  color?: string;
}

interface SelectCellProps {
  value: string | string[] | null;
  options: SelectOption[] | string[];
  isMulti?: boolean;
  isSelected?: boolean;
  isEditing?: boolean;
  onChange?: (value: string | string[]) => void;
  onSave?: (value: string | string[]) => void;
  onClick?: () => void;
  className?: string;
}

function normalizeOptions(options: SelectOption[] | string[]): SelectOption[] {
  if (options.length === 0) return [];
  
  if (typeof options[0] === 'string') {
    return (options as string[]).map(opt => ({ value: opt, label: opt }));
  }
  
  return options as SelectOption[];
}

function getOptionColor(option: SelectOption, defaultColor = 'blue'): string {
  if (option.color) return option.color;
  
  // Generate color based on value hash for consistency
  let hash = 0;
  for (let i = 0; i < option.value.length; i++) {
    hash = option.value.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    'blue', 'green', 'purple', 'orange', 'red', 'pink', 'yellow', 'indigo'
  ];
  return colors[Math.abs(hash) % colors.length];
}

export function SelectCell({
  value,
  options: rawOptions,
  isMulti = false,
  isSelected = false,
  isEditing = false,
  onChange,
  onSave,
  onClick,
  className,
}: SelectCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const options = normalizeOptions(rawOptions);
  
  // Normalize value
  const selectedValues = isMulti
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : (value ? [value] : []);
  
  const selectedOptions = options.filter(opt => selectedValues.includes(opt.value));
  
  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  const filteredOptions = searchTerm
    ? options.filter(opt => 
        opt.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        opt.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;
  
  const handleSelect = (optionValue: string) => {
    if (isMulti) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(v => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange?.(newValues);
      onSave?.(newValues);
    } else {
      onChange?.(optionValue);
      onSave?.(optionValue);
      setIsOpen(false);
    }
  };
  
  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMulti) {
      const newValues = selectedValues.filter(v => v !== optionValue);
      onChange?.(newValues);
      onSave?.(newValues);
    }
  };
  
  // Display mode
  if (!isEditing) {
    if (selectedOptions.length === 0) {
      return (
        <div
          className={cn(
            'px-3 py-2 cursor-pointer hover:bg-blue-50 text-gray-400 text-sm',
            isSelected && 'ring-2 ring-inset ring-blue-500 bg-blue-50',
            className
          )}
          onClick={() => {
            onClick?.();
            setIsOpen(true);
          }}
        >
          Empty
        </div>
      );
    }
    
    return (
      <div
        className={cn(
          'px-3 py-2 cursor-pointer hover:bg-blue-50 flex items-center gap-1.5 flex-wrap',
          isSelected && 'ring-2 ring-inset ring-blue-500 bg-blue-50',
          className
        )}
        onClick={() => {
          onClick?.();
          setIsOpen(true);
        }}
      >
        {selectedOptions.map((option) => {
          const color = getOptionColor(option);
          const colorClasses = {
            blue: 'bg-blue-100 text-blue-700 border-blue-200',
            green: 'bg-green-100 text-green-700 border-green-200',
            purple: 'bg-purple-100 text-purple-700 border-purple-200',
            orange: 'bg-orange-100 text-orange-700 border-orange-200',
            red: 'bg-red-100 text-red-700 border-red-200',
            pink: 'bg-pink-100 text-pink-700 border-pink-200',
            yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
            indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
          };
          
          return (
            <span
              key={option.value}
              className={cn(
                'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-md border',
                colorClasses[color as keyof typeof colorClasses] || colorClasses.blue
              )}
            >
              {option.label || option.value}
              {isMulti && (
                <button
                  onClick={(e) => handleRemove(option.value, e)}
                  className="hover:bg-black/10 rounded p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          );
        })}
        {isMulti && selectedOptions.length < options.length && (
          <span className="text-xs text-gray-400">+ Add</span>
        )}
      </div>
    );
  }
  
  // Edit mode - dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setSearchTerm('');
          }}
        />
      )}
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-0 z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-xl">
          {/* Selected items (for multi-select) */}
          {isMulti && selectedOptions.length > 0 && (
            <div className="p-3 border-b border-gray-200">
              <div className="flex flex-wrap gap-1.5">
                {selectedOptions.map((option) => {
                  const color = getOptionColor(option);
                  const colorClasses = {
                    blue: 'bg-blue-100 text-blue-700',
                    green: 'bg-green-100 text-green-700',
                    purple: 'bg-purple-100 text-purple-700',
                    orange: 'bg-orange-100 text-orange-700',
                    red: 'bg-red-100 text-red-700',
                    pink: 'bg-pink-100 text-pink-700',
                    yellow: 'bg-yellow-100 text-yellow-700',
                    indigo: 'bg-indigo-100 text-indigo-700',
                  };
                  
                  return (
                    <span
                      key={option.value}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md',
                        colorClasses[color as keyof typeof colorClasses] || colorClasses.blue
                      )}
                    >
                      {option.label || option.value}
                      <button
                        onClick={(e) => handleRemove(option.value, e)}
                        className="hover:bg-black/10 rounded p-0.5 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Search input */}
          <div className="p-3 border-b border-gray-100">
            <input
              type="text"
              placeholder="Search options..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          
          {/* Options list */}
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {searchTerm ? 'No matching options' : 'No options available'}
              </div>
            ) : (
              <div className="py-2">
                {filteredOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  const color = getOptionColor(option);
                  const colorClasses = {
                    blue: 'bg-blue-50 border-l-blue-500',
                    green: 'bg-green-50 border-l-green-500',
                    purple: 'bg-purple-50 border-l-purple-500',
                    orange: 'bg-orange-50 border-l-orange-500',
                    red: 'bg-red-50 border-l-red-500',
                    pink: 'bg-pink-50 border-l-pink-500',
                    yellow: 'bg-yellow-50 border-l-yellow-500',
                    indigo: 'bg-indigo-50 border-l-indigo-500',
                  };
                  
                  return (
                    <button
                      key={option.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(option.value);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left transition-colors border-l-2',
                        isSelected && (colorClasses[color as keyof typeof colorClasses] || colorClasses.blue)
                      )}
                    >
                      {isMulti ? (
                        <div className={cn(
                          'w-4 h-4 rounded border-2 flex items-center justify-center',
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      ) : (
                        isSelected && <Check className="w-4 h-4 text-blue-500" />
                      )}
                      <span className="text-sm text-gray-700 flex-1">
                        {option.label || option.value}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

