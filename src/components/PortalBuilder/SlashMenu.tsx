'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockCommand, BLOCK_COMMANDS, CATEGORIES } from './blockCommands';

// ============================================================================
// SLASH COMMAND MENU - Clean dropdown style
// ============================================================================

interface SlashMenuProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (command: BlockCommand) => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
}

export function SlashMenu({ query, position, onSelect, onClose }: SlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState(position);

  // Calculate position relative to viewport and adjust if menu would be cut off
  useEffect(() => {
    const menuHeight = 400;
    const menuWidth = 280;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const padding = 16;

    let top = position.top;
    let left = position.left;

    // If menu would extend below viewport, show it above the trigger
    if (top + menuHeight > viewportHeight - padding) {
      top = Math.max(padding, position.top - menuHeight - 8);
    }

    // If menu would extend beyond right edge, shift left
    if (left + menuWidth > viewportWidth - padding) {
      left = Math.max(padding, viewportWidth - menuWidth - padding);
    }

    // Ensure top is not negative
    top = Math.max(padding, top);

    setMenuPosition({ top, left });
  }, [position]);

  // Filter commands based on query
  const filtered = useMemo(() => {
    if (!query) return BLOCK_COMMANDS;
    const lower = query.toLowerCase();
    return BLOCK_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(lower) ||
      cmd.description.toLowerCase().includes(lower) ||
      cmd.category.toLowerCase().includes(lower) ||
      cmd.keywords?.some(k => k.includes(lower))
    );
  }, [query]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, BlockCommand[]> = {};
    filtered.forEach(cmd => {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filtered]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    return CATEGORIES.flatMap(cat => grouped[cat] || []);
  }, [grouped]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected into view (only for keyboard nav)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatList[selectedIndex]) {
          onSelect(flatList[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [flatList, selectedIndex, onSelect, onClose]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (flatList.length === 0) {
    return createPortal(
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, y: -8, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.96 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed bg-white rounded-xl shadow-2xl border border-gray-100 p-6 w-72 z-[9999]"
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-gray-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-600">No blocks found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
          </div>
        </div>
      </motion.div>,
      document.body
    );
  }

  let itemIndex = 0;

  return createPortal(
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="fixed bg-white rounded-xl shadow-2xl border border-gray-100 w-72 overflow-hidden z-[9999]"
      style={{ top: menuPosition.top, left: menuPosition.left }}
    >
      {/* Header with search indicator */}
      <div className="px-3 py-2.5 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-50">
            <Command className="w-3 h-3 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            {query ? (
              <p className="text-xs text-gray-700">Searching &ldquo;<span className="font-medium text-gray-900">{query}</span>&rdquo;</p>
            ) : (
              <p className="text-xs text-gray-500">Add a new block</p>
            )}
          </div>
        </div>
      </div>

      {/* Commands - simple scrollable list */}
      <div className="overflow-y-auto max-h-80 py-1">
        {CATEGORIES.map(category => {
          const commands = grouped[category];
          if (!commands?.length) return null;

          return (
            <div key={category}>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {category}
              </div>
              {commands.map(cmd => {
                const currentIndex = itemIndex++;
                const isSelected = currentIndex === selectedIndex;

                return (
                  <button
                    key={cmd.id}
                    ref={isSelected ? selectedRef : null}
                    onClick={() => onSelect(cmd)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors",
                      isSelected
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      isSelected
                        ? "bg-blue-100 text-blue-600"
                        : "bg-gray-100 text-gray-500"
                    )}>
                      {cmd.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn(
                        "text-sm font-medium truncate",
                        isSelected ? "text-blue-900" : "text-gray-800"
                      )}>
                        {cmd.label}
                      </div>
                      <div className={cn(
                        "text-xs truncate",
                        isSelected ? "text-blue-600/70" : "text-gray-400"
                      )}>
                        {cmd.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Compact footer hint */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/80 flex items-center gap-4 text-[10px] text-gray-400">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-white rounded border border-gray-200 font-medium">↑↓</kbd>
          navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-white rounded border border-gray-200 font-medium">↵</kbd>
          select
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-white rounded border border-gray-200 font-medium">esc</kbd>
          close
        </span>
      </div>
    </motion.div>,
    document.body
  );
}
