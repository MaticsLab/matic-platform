/**
 * Block Editor - Real-time Collaborative Section Editor
 * 
 * A rich block-based editor for portal sections with:
 * - Real-time collaboration via Supabase Realtime + Yjs
 * - Presence indicators showing who's editing
 * - Slash commands (/) with keyboard navigation
 * - Drag-and-drop block reordering via @dnd-kit
 * - Floating menu on empty lines
 * - Drag handles on hover
 * - Inline editing for text content
 * - Clean, minimal design with smooth animations
 */

'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  GripVertical, Plus, Trash2, MoreHorizontal,
  Type, AlignLeft, Hash, Mail, Phone, Calendar,
  CheckSquare, List, Upload, Heading, ToggleLeft,
  FileText, Star, MapPin, Layers, Repeat, Image,
  Link, Clock, Minus, AlertCircle, ChevronUp, ChevronDown,
  Sparkles, Command, FolderInput, Check, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Section, Field, FieldType } from '@/types/portal';
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter';
import { useCollaborationOptional } from './CollaborationProvider';
import { BlockCollaboratorRing } from './PresenceIndicators';

// ============================================================================
// TYPES
// ============================================================================

interface FormTheme {
  questionsBackgroundColor?: string;
  primaryColor?: string;
  questionsColor?: string;
  answersColor?: string;
  showLogo?: boolean;
}

interface BlockEditorProps {
  section: Section;
  onUpdate: (updates: Partial<Section>) => void;
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  themeColor?: string;
  /** Form designer theme settings */
  formTheme?: FormTheme;
  /** Logo URL for header display */
  logoUrl?: string;
  /** Room ID for real-time collaboration (usually form ID) */
  roomId?: string;
  /** Current user info for collaboration presence */
  currentUser?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  /** All sections for moving fields between sections */
  allSections?: Section[];
  /** Callback to move a field to a different section */
  onMoveFieldToSection?: (fieldId: string, targetSectionId: string) => void;
}

interface BlockCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  fieldType: FieldType;
  category: string;
  keywords?: string[];
  defaultConfig?: Record<string, unknown>;
}

// ============================================================================
// BLOCK COMMANDS - Organized by Category
// ============================================================================

const BLOCK_COMMANDS: BlockCommand[] = [
  // Basic
  { id: 'text', label: 'Text Input', description: 'Single line text field', icon: <Type className="w-4 h-4" />, fieldType: 'text', category: 'Basic', keywords: ['short', 'input', 'field'] },
  { id: 'textarea', label: 'Text Area', description: 'Multi-line text field', icon: <AlignLeft className="w-4 h-4" />, fieldType: 'textarea', category: 'Basic', keywords: ['paragraph', 'multiline'] },
  { id: 'number', label: 'Number', description: 'Numeric input', icon: <Hash className="w-4 h-4" />, fieldType: 'number', category: 'Basic', keywords: ['integer', 'decimal'] },
  { id: 'email', label: 'Email', description: 'Email with validation', icon: <Mail className="w-4 h-4" />, fieldType: 'email', category: 'Basic' },
  { id: 'phone', label: 'Phone', description: 'Phone number field', icon: <Phone className="w-4 h-4" />, fieldType: 'phone', category: 'Basic', keywords: ['telephone', 'mobile'] },
  { id: 'url', label: 'URL', description: 'Website URL field', icon: <Link className="w-4 h-4" />, fieldType: 'url', category: 'Basic', keywords: ['link', 'website'] },
  
  // Selection
  { id: 'select', label: 'Dropdown', description: 'Single option selection', icon: <List className="w-4 h-4" />, fieldType: 'select', category: 'Selection', defaultConfig: { options: ['Option 1', 'Option 2', 'Option 3'] } },
  { id: 'multiselect', label: 'Multi-Select', description: 'Multiple option selection', icon: <CheckSquare className="w-4 h-4" />, fieldType: 'multiselect', category: 'Selection', defaultConfig: { options: ['Option 1', 'Option 2', 'Option 3'] } },
  { id: 'radio', label: 'Single Choice', description: 'Radio button options', icon: <ToggleLeft className="w-4 h-4" />, fieldType: 'radio', category: 'Selection', defaultConfig: { options: ['Option 1', 'Option 2'] } },
  { id: 'checkbox', label: 'Checkbox', description: 'True/false toggle', icon: <CheckSquare className="w-4 h-4" />, fieldType: 'checkbox', category: 'Selection' },
  
  // Date & Time
  { id: 'date', label: 'Date', description: 'Date picker', icon: <Calendar className="w-4 h-4" />, fieldType: 'date', category: 'Date & Time' },
  { id: 'time', label: 'Time', description: 'Time picker', icon: <Clock className="w-4 h-4" />, fieldType: 'time', category: 'Date & Time' },
  { id: 'datetime', label: 'Date & Time', description: 'Date and time picker', icon: <Calendar className="w-4 h-4" />, fieldType: 'datetime', category: 'Date & Time' },
  
  // Media
  { id: 'file', label: 'File Upload', description: 'File upload field', icon: <Upload className="w-4 h-4" />, fieldType: 'file', category: 'Media', keywords: ['attachment', 'document'] },
  { id: 'image', label: 'Image Upload', description: 'Image upload field', icon: <Image className="w-4 h-4" />, fieldType: 'image', category: 'Media', keywords: ['photo', 'picture'] },
  
  // Layout
  { id: 'heading', label: 'Heading', description: 'Section heading', icon: <Heading className="w-4 h-4" />, fieldType: 'heading', category: 'Layout', keywords: ['title', 'h1', 'h2', 'h3'] },
  { id: 'paragraph', label: 'Paragraph', description: 'Display text', icon: <FileText className="w-4 h-4" />, fieldType: 'paragraph', category: 'Layout', keywords: ['text', 'description'] },
  { id: 'divider', label: 'Divider', description: 'Visual divider', icon: <Minus className="w-4 h-4" />, fieldType: 'divider', category: 'Layout', keywords: ['separator', 'hr'] },
  { id: 'callout', label: 'Callout Box', description: 'Highlighted message', icon: <AlertCircle className="w-4 h-4" />, fieldType: 'callout', category: 'Layout', keywords: ['info', 'warning', 'note'] },
  
  // Advanced
  { id: 'address', label: 'Address', description: 'Address with autocomplete', icon: <MapPin className="w-4 h-4" />, fieldType: 'address', category: 'Advanced', keywords: ['location'] },
  { id: 'rating', label: 'Rating', description: 'Star rating (1-5)', icon: <Star className="w-4 h-4" />, fieldType: 'rating', category: 'Advanced', keywords: ['stars', 'score'] },
  { id: 'group', label: 'Group', description: 'Field group', icon: <Layers className="w-4 h-4" />, fieldType: 'group', category: 'Advanced', defaultConfig: { columns: 2 } },
  { id: 'repeater', label: 'Repeater', description: 'Repeatable section', icon: <Repeat className="w-4 h-4" />, fieldType: 'repeater', category: 'Advanced', defaultConfig: { minItems: 0, maxItems: 10 } },
];

const CATEGORIES = ['Basic', 'Selection', 'Date & Time', 'Media', 'Layout', 'Advanced'];

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

function SlashMenu({ query, position, onSelect, onClose }: SlashMenuProps) {
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

function NewLineInput({ onOpenSlashMenu, onQueryChange, isMenuOpen, placeholder = "Type '/' for commands...", autoFocus }: NewLineInputProps) {
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

// ============================================================================
// FLOATING ADD BUTTON - Shows on hover between blocks
// ============================================================================

interface FloatingAddButtonProps {
  position: { top: number; left: number };
  onClick: () => void;
}

function FloatingAddButton({ position, onClick }: FloatingAddButtonProps) {
  return createPortal(
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={onClick}
      className="fixed z-50 w-7 h-7 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
      style={{ top: position.top - 14, left: position.left }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <Plus className="w-4 h-4" />
    </motion.button>,
    document.body
  );
}

// ============================================================================
// SORTABLE BLOCK WRAPPER - Enables drag-and-drop reordering
// ============================================================================

interface SortableBlockProps {
  id: string;
  children: React.ReactNode;
  isDragging?: boolean;
}

function SortableBlock({ id, children, isDragging }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
    zIndex: isSortableDragging ? 50 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {React.cloneElement(children as React.ReactElement, {
        dragListeners: listeners,
        isDragging: isSortableDragging || isDragging,
      })}
    </div>
  );
}

// ============================================================================
// CHILD FIELDS DND CONTEXT - Separate component to properly isolate DnD context
// ============================================================================

interface ChildFieldsDndContextProps {
  children: Field[];
  onReorder: (event: DragEndEvent) => void;
  field: Field;
  onDeleteChild: (id: string) => void;
  onUpdateChild: (id: string, updates: Partial<Field>) => void;
  onSelectChild: (id: string) => void;
  selectedChildId: string | null;
  themeColor?: string;
  allFields: Field[];
}

function ChildFieldsDndContext({ 
  children, 
  onReorder, 
  field, 
  onDeleteChild, 
  onUpdateChild, 
  onSelectChild,
  selectedChildId,
  themeColor, 
  allFields 
}: ChildFieldsDndContextProps) {
  // Create isolated sensors for child DnD context
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Smaller distance for children
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onReorder}
    >
      <SortableContext 
        items={children.map(c => c.id)} 
        strategy={verticalListSortingStrategy}
      >
        <div className={cn(
          "space-y-2",
          field.type === 'group' && "grid gap-3",
          field.type === 'group' && (field.config?.columns === 2 ? "grid-cols-2" : field.config?.columns === 3 ? "grid-cols-3" : "")
        )}>
          {children.map(child => (
            <SortableChildField
              key={child.id}
              field={child}
              onDelete={() => onDeleteChild(child.id)}
              onUpdate={(updates) => onUpdateChild(child.id, updates)}
              onSelect={() => onSelectChild(child.id)}
              isSelected={selectedChildId === child.id}
              themeColor={themeColor}
              allFields={allFields}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ============================================================================
// SORTABLE CHILD FIELD - For fields inside group/repeater containers
// ============================================================================

interface SortableChildFieldProps {
  field: Field;
  onDelete: () => void;
  onUpdate: (updates: Partial<Field>) => void;
  onSelect: () => void;
  isSelected: boolean;
  themeColor?: string;
  allFields: Field[];
}

function SortableChildField({ field, onDelete, onUpdate, onSelect, isSelected, themeColor, allFields }: SortableChildFieldProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  // Check if field supports inline options editing
  const supportsInlineOptions = ['select', 'multiselect', 'radio'].includes(field.type);
  const options = (field.config?.options as Array<{ label: string; value: string }>) || [];

  return (
    <div 
      ref={(el) => { setNodeRef(el); containerRef.current = el; }} 
      style={style} 
      {...attributes}
      className={cn(
        "relative bg-white rounded-lg border-2 transition-all cursor-pointer",
        isDragging ? "border-blue-300 shadow-md" : "border-gray-200",
        isHovered && !isDragging && "border-gray-300 bg-gray-50/50",
        isSelected && "ring-2 ring-blue-500 border-blue-300 bg-blue-50/30"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowDeleteConfirm(false);
      }}
      onClick={(e) => {
        // Select this field to show settings panel
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Drag handle - Left side outside card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        className="absolute -left-8 top-2 flex flex-col gap-0.5 z-10"
      >
        <button
          {...listeners}
          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200"
          onClick={(e) => e.stopPropagation()}
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </motion.div>

      {/* Action buttons - Top right inside card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: (isHovered || isSelected) ? 1 : 0 }}
        className="absolute top-2 right-2 flex items-center gap-1 z-10"
      >
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1 bg-white rounded-md shadow-lg border border-red-200 p-1">
            <span className="text-xs text-gray-700 px-1.5">Delete?</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
              title="Confirm delete"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(true);
            }}
            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200"
            title="Delete field"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>

      {/* Content */}
      <div className="py-3 px-2">
        <div className="space-y-2">
          {/* Editable Label & Description */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                ref={labelInputRef}
                type="text"
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => onSelect()}
                className="flex-1 text-sm font-medium bg-transparent border-none outline-none placeholder:text-gray-400 focus:ring-0 text-gray-900"
                placeholder="Field label..."
              />
            </div>
            {/* Description - show when selected, has value, or user clicks to add */}
            {(isSelected || field.description) ? (
              <input
                type="text"
                value={field.description || ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => onSelect()}
                className="w-full text-xs bg-transparent border-none outline-none placeholder:text-gray-400 focus:ring-0 text-gray-500"
                placeholder="Add a description (help text shown below field)..."
              />
            ) : null}
          </div>

          {/* Show field preview only if it doesn't have inline options editor */}
          {!supportsInlineOptions && (
            <PortalFieldAdapter
              field={{ ...field, label: '', description: '' }}
              value={undefined}
              onChange={() => {}}
              themeColor={themeColor}
              allFields={allFields}
              disabled={true}
            />
          )}

          {/* Inline Options Editor for select/multiselect/radio fields */}
          {isSelected && supportsInlineOptions && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">Options</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const newOptions = [...options, { label: `Option ${options.length + 1}`, value: `option-${Date.now()}` }];
                    onUpdate({ config: { ...field.config, options: newOptions } });
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {options.map((option, idx) => (
                  <div key={option.value} className="flex items-center gap-1.5 group">
                    <GripVertical className="w-3 h-3 text-gray-300" />
                    <input
                      type="text"
                      value={option.label}
                      onChange={(e) => {
                        e.stopPropagation();
                        const newOptions = [...options];
                        newOptions[idx] = { ...option, label: e.target.value };
                        onUpdate({ config: { ...field.config, options: newOptions } });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 h-7 px-2 text-xs bg-gray-50/50 border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      placeholder={`Option ${idx + 1}`}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const newOptions = options.filter((_, i) => i !== idx);
                        onUpdate({ config: { ...field.config, options: newOptions } });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BLOCK COMPONENT - Individual editable block
// ============================================================================

interface BlockProps {
  field: Field;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Field>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onOpenSlashMenu: (position: { top: number; left: number }, containerId?: string) => void;
  onMoveToSection?: (targetSectionId: string) => void;
  allSections?: Section[];
  currentSectionId?: string;
  themeColor?: string;
  /** Form theme settings for colors */
  resolvedTheme?: {
    questionsBackgroundColor: string;
    primaryColor: string;
    questionsColor: string;
    answersColor: string;
    showLogo: boolean;
  };
  allFields: Field[];
  isFirst: boolean;
  isLast: boolean;
  /** Drag listeners from @dnd-kit */
  dragListeners?: Record<string, unknown>;
  /** Whether this block is being dragged */
  isDragging?: boolean;
  /** Callback to add a field to this container (for groups/repeaters) */
  onAddToContainer?: (field: Field) => void;
  /** Whether a drag is currently over this container */
  isDropTarget?: boolean;
  /** Currently selected block ID (for child field selection) */
  selectedBlockId?: string | null;
  /** Callback to select a block (for child fields) */
  onSelectBlock?: (id: string | null) => void;
}

function Block({
  field,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onOpenSlashMenu,
  onMoveToSection,
  allSections,
  currentSectionId,
  themeColor,
  resolvedTheme,
  allFields,
  isFirst,
  isLast,
  dragListeners,
  isDragging,
  onAddToContainer,
  isDropTarget,
  selectedBlockId,
  onSelectBlock,
}: BlockProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const isLayoutField = ['heading', 'paragraph', 'divider', 'callout'].includes(field.type);
  const isContainerField = ['group', 'repeater'].includes(field.type);
  
  // Make groups/repeaters droppable
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `container-${field.id}`,
    disabled: !isContainerField,
    data: { type: 'container', fieldId: field.id }
  });

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if ('select' in inputRef.current) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  // Handle keyboard in inline editing
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && field.type !== 'paragraph') {
      e.preventDefault();
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  // Render inline editable content for layout fields
  const renderInlineContent = () => {
    if (field.type === 'heading') {
      const content = field.label || '';
      if (isEditing) {
        return (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={content}
            onChange={(e) => onUpdate({ label: e.target.value })}
            onBlur={() => setIsEditing(false)}
            onKeyDown={handleKeyDown}
            className="w-full text-2xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300 focus:ring-0"
            placeholder="Enter a heading..."
          />
        );
      }
      return (
        <h2 
          className="text-2xl font-bold text-gray-900 cursor-text min-h-[36px] hover:text-gray-700 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          {content || <span className="text-gray-300 italic font-normal">Click to add heading...</span>}
        </h2>
      );
    }

    if (field.type === 'paragraph') {
      const content = field.description || field.label || '';
      if (isEditing) {
        return (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={content}
            onChange={(e) => onUpdate({ description: e.target.value, label: e.target.value })}
            onBlur={() => setIsEditing(false)}
            onKeyDown={handleKeyDown}
            className="w-full text-gray-600 bg-transparent border-none outline-none resize-none placeholder:text-gray-400 min-h-[80px] focus:ring-0"
            placeholder="Write your content here..."
            rows={4}
          />
        );
      }
      return (
        <p 
          className="text-gray-600 cursor-text min-h-[24px] whitespace-pre-wrap leading-relaxed hover:text-gray-500 transition-colors"
          onClick={() => setIsEditing(true)}
        >
          {content || <span className="text-gray-400 italic">Click to add content...</span>}
        </p>
      );
    }

    if (field.type === 'divider') {
      return (
        <div className="py-2">
          <hr className="border-gray-200 hover:border-gray-300 transition-colors" />
        </div>
      );
    }

    if (field.type === 'callout') {
      const colorConfig: Record<string, { bg: string; border: string; icon: string; text: string; placeholder: string }> = {
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', text: 'text-blue-900', placeholder: 'text-blue-400' },
        green: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500', text: 'text-emerald-900', placeholder: 'text-emerald-400' },
        yellow: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', text: 'text-amber-900', placeholder: 'text-amber-400' },
        red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', text: 'text-red-900', placeholder: 'text-red-400' },
        purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-500', text: 'text-purple-900', placeholder: 'text-purple-400' },
        gray: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-500', text: 'text-gray-900', placeholder: 'text-gray-400' },
      };
      const color = (field.config?.color as string) || 'blue';
      const colors = colorConfig[color] || colorConfig.blue;

      return (
        <div className={cn("flex gap-3 p-4 rounded-xl border", colors.bg, colors.border)}>
          <AlertCircle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", colors.icon)} />
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={field.label || ''}
                onChange={(e) => onUpdate({ label: e.target.value })}
                onBlur={() => setIsEditing(false)}
                onKeyDown={handleKeyDown}
                className={cn("w-full bg-transparent border-none outline-none resize-none focus:ring-0", colors.text)}
                placeholder="Add your callout message..."
                rows={2}
              />
            ) : (
              <p 
                className={cn("cursor-text leading-relaxed", colors.text)}
                onClick={() => setIsEditing(true)}
              >
                {field.label || <span className={cn("italic", colors.placeholder)}>Click to add callout message...</span>}
              </p>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  // Render container field (group/repeater)
  if (isContainerField) {
    const children = field.children || [];

    // Handler to reorder children within the container
    const handleChildDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = children.findIndex((c) => c.id === active.id);
        const newIndex = children.findIndex((c) => c.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newChildren = arrayMove(children, oldIndex, newIndex);
          onUpdate({ children: newChildren });
        }
      }
    };

    // Handler to delete a child
    const handleDeleteChild = (childId: string) => {
      const newChildren = children.filter(c => c.id !== childId);
      onUpdate({ children: newChildren });
    };

    // Handler to update a child
    const handleUpdateChild = (childId: string, updates: Partial<Field>) => {
      const newChildren = children.map(c => 
        c.id === childId ? { ...c, ...updates } : c
      );
      onUpdate({ children: newChildren });
    };
    
    return (
      <motion.div
        ref={(node) => {
          // Combine refs for both block and droppable
          (blockRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          setDroppableRef(node);
        }}
        layout
        className={cn(
          "relative group rounded-xl border-2 border-dashed transition-all duration-200",
          isSelected 
            ? "border-blue-400 bg-blue-50/50 shadow-sm shadow-blue-100" 
            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50",
          // Highlight when a field is being dragged over this container
          (isOver || isDropTarget) && "border-green-400 bg-green-50/50 ring-2 ring-green-200",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        {/* Drag handle - inside card on left */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: (isHovered || isSelected) ? 1 : 0 }}
          className="absolute left-2 top-2 flex flex-col gap-0.5 z-10"
        >
          <button 
            {...dragListeners}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200"
            title="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        {/* Content */}
        <div className="p-5 pt-10">
          {/* Header */}
          <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-gray-200">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              field.type === 'group' ? "bg-blue-50" : "bg-purple-50"
            )}>
              {field.type === 'group' ? (
                <Layers className="w-4 h-4 text-blue-500" />
              ) : (
                <Repeat className="w-4 h-4 text-purple-500" />
              )}
            </div>
            <input
              type="text"
              value={field.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              className="font-semibold text-gray-900 bg-transparent border-none outline-none flex-1 placeholder:text-gray-400"
              placeholder={field.type === 'group' ? 'Field Group' : 'Repeater'}
            />
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Children with drag-and-drop */}
          {children.length === 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                onOpenSlashMenu({ top: rect.bottom + 8, left: rect.left }, field.id);
              }}
              className="w-full py-10 text-sm text-gray-400 hover:text-gray-600 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all group/add"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover/add:bg-gray-200 transition-colors">
                  <Plus className="w-5 h-5 text-gray-400 group-hover/add:text-gray-600" />
                </div>
                <span>Click to add fields inside</span>
              </div>
            </button>
          ) : (
            <ChildFieldsDndContext 
              children={children}
              onReorder={handleChildDragEnd}
              field={field}
              onDeleteChild={handleDeleteChild}
              onUpdateChild={handleUpdateChild}
              onSelectChild={(id) => onSelectBlock?.(id)}
              selectedChildId={selectedBlockId || null}
              themeColor={themeColor}
              allFields={allFields}
            />
          )}

          {/* Add more button when there are children */}
          {children.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                onOpenSlashMenu({ top: rect.bottom + 8, left: rect.left }, field.id);
              }}
              className="mt-3 w-full py-2 text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add field
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <BlockCollaboratorRing blockId={field.id}>
    <motion.div
      ref={blockRef}
      layout
      data-block-id={field.id}
      className={cn(
        "relative group transition-all duration-200 rounded-lg",
        isSelected && "bg-blue-50/50 ring-2 ring-blue-500 ring-offset-1",
        !isSelected && isHovered && "bg-gray-50/70",
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowDeleteConfirm(false);
        setShowMoveDropdown(false);
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Drag handle + Plus button - Left side inside card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: (isHovered || isSelected) ? 1 : 0 }}
        className="absolute left-2 top-2 flex items-center gap-0.5 z-10"
      >
        <button 
          {...dragListeners}
          className={cn(
            "p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200",
            isDragging && "cursor-grabbing bg-gray-100"
          )}
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            onOpenSlashMenu({ top: rect.bottom + 4, left: rect.left });
          }}
          className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200"
          title="Add field below"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </motion.div>

      {/* Actions - Top right corner inside card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: (isHovered || isSelected) ? 1 : 0 }}
        className="absolute top-2 right-2 flex items-center gap-1 z-10"
      >
        {allSections && allSections.length > 1 && onMoveToSection && (
          <div className="relative">
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                setShowMoveDropdown(!showMoveDropdown);
              }}
              className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200"
              title="Move to section"
            >
              <FolderInput className="w-3.5 h-3.5" />
            </button>
            {showMoveDropdown && (
              <>
                {/* Click-outside overlay */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoveDropdown(false);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 z-50">
                  <div className="bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]">
                    <div className="px-3 py-1.5 text-xs font-medium text-gray-500 border-b border-gray-100">
                      Move to section
                    </div>
                    {allSections
                      .filter(s => s.id !== currentSectionId && s.sectionType === 'form')
                      .map((section) => (
                        <button
                          key={section.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onMoveToSection(section.id);
                            setShowMoveDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors text-gray-700"
                        >
                          {section.title}
                        </button>
                      ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1 bg-white rounded-md shadow-lg border border-red-200 p-1">
            <span className="text-xs text-gray-700 px-1.5">Delete?</span>
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                onDelete(); 
              }}
              className="p-1 rounded hover:bg-red-100 text-red-600 transition-colors"
              title="Confirm delete"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                setShowDeleteConfirm(false); 
              }}
              className="p-1 rounded hover:bg-gray-100 text-gray-500 transition-colors"
              title="Cancel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { 
              e.stopPropagation(); 
              setShowDeleteConfirm(true); 
            }}
            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200"
            title="Delete field"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>

      {/* Content */}
      <div className="py-3 px-2">
        {isLayoutField ? (
          renderInlineContent()
        ) : (
          <div className="space-y-2">
            {/* Editable Label & Description */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => {
                    const cursorPos = e.target.selectionStart;
                    onUpdate({ label: e.target.value });
                    requestAnimationFrame(() => {
                      if (document.activeElement === e.target && cursorPos !== null) {
                        e.target.setSelectionRange(cursorPos, cursorPos);
                      }
                    });
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect()
                  }}
                  onFocus={() => onSelect()}
                  className="flex-1 text-sm font-medium bg-transparent border-none outline-none placeholder:text-gray-400 focus:ring-0"
                  style={{ color: resolvedTheme?.questionsColor || '#111827' }}
                  placeholder="Field label..."
                />
              </div>
              {/* Description - show when selected, has value, or user clicks to add */}
              {(isSelected || field.description) ? (
                <input
                  type="text"
                  value={field.description || ''}
                  onChange={(e) => {
                    const cursorPos = e.target.selectionStart;
                    onUpdate({ description: e.target.value });
                    requestAnimationFrame(() => {
                      if (document.activeElement === e.target && cursorPos !== null) {
                        e.target.setSelectionRange(cursorPos, cursorPos);
                      }
                    });
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelect()
                  }}
                  onFocus={() => onSelect()}
                  className="w-full text-xs bg-transparent border-none outline-none placeholder:text-gray-400 focus:ring-0"
                  style={{ color: resolvedTheme?.answersColor || '#6b7280' }}
                  placeholder="Add a description (help text shown below field)..."
                />
              ) : null}
            </div>
            
            {/* Inline Options Editor for select/multiselect/radio fields */}
            {isSelected && ['select', 'multiselect', 'radio'].includes(field.type) && (
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">Options</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentOptions = field.options || [];
                      onUpdate({ options: [...currentOptions, `Option ${currentOptions.length + 1}`] });
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {(field.options || []).map((option: string, index: number) => (
                    <div key={index} className="flex items-center gap-1.5 group">
                      <GripVertical className="w-3 h-3 text-gray-300" />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...(field.options || [])];
                          newOptions[index] = e.target.value;
                          onUpdate({ options: newOptions });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 h-7 px-2 text-xs bg-gray-50/50 border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder={`Option ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const newOptions = (field.options || []).filter((_, i) => i !== index);
                          onUpdate({ options: newOptions });
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Field Preview - pass empty label to avoid duplication */}
            <PortalFieldAdapter
              field={{ ...field, label: '', description: '' }}
              value={undefined}
              onChange={() => {}}
              themeColor={themeColor}
              allFields={allFields}
              disabled={true}
            />
          </div>
        )}
      </div>
    </motion.div>
    </BlockCollaboratorRing>
  );
}

// ============================================================================
// MAIN BLOCK EDITOR
// ============================================================================

export function BlockEditor({
  section,
  onUpdate,
  selectedBlockId,
  onSelectBlock,
  themeColor = '#3B82F6',
  formTheme,
  logoUrl,
  roomId,
  currentUser,
  allSections,
  onMoveFieldToSection,
}: BlockEditorProps) {
  // Resolve theme colors with defaults
  const resolvedTheme = {
    questionsBackgroundColor: formTheme?.questionsBackgroundColor || '#ffffff',
    primaryColor: formTheme?.primaryColor || themeColor,
    questionsColor: formTheme?.questionsColor || '#111827',
    answersColor: formTheme?.answersColor || '#374151',
    showLogo: formTheme?.showLogo !== false,
  };
  const [slashMenu, setSlashMenu] = useState<{ position: { top: number; left: number }; insertIndex: number; containerId?: string } | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [isTypingSlash, setIsTypingSlash] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use collaboration context from PortalEditor
  const collaboration = useCollaborationOptional();

  // Update provider when selected block changes
  useEffect(() => {
    if (collaboration) {
      collaboration.updateSelectedBlock(selectedBlockId);
    }
  }, [selectedBlockId, collaboration]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Track which container is being dragged over
  const [overContainerId, setOverContainerId] = useState<string | null>(null);

  // Handle drag over - track when hovering over containers
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (over?.data?.current?.type === 'container') {
      setOverContainerId(over.data.current.fieldId);
    } else {
      setOverContainerId(null);
    }
  }, []);

  // Handle drag end - reorder blocks or move into containers
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverContainerId(null);

    if (!over) return;

    // Check if dropping into a container (group/repeater)
    if (over.data?.current?.type === 'container') {
      const containerId = over.data.current.fieldId;
      const draggedFieldIndex = section.fields.findIndex((f) => f.id === active.id);
      
      if (draggedFieldIndex !== -1) {
        const draggedField = section.fields[draggedFieldIndex];
        
        // Don't allow dropping a container into itself
        if (draggedField.id === containerId) return;
        
        // Don't allow dropping groups/repeaters into other containers
        if (['group', 'repeater'].includes(draggedField.type)) return;
        
        // Remove from top level
        const newFields = section.fields.filter((f) => f.id !== active.id);
        
        // Add to container's children
        const updatedFields = newFields.map((f) => {
          if (f.id === containerId) {
            return {
              ...f,
              children: [...(f.children || []), draggedField]
            };
          }
          return f;
        });
        
        onUpdate({ fields: updatedFields });
        return;
      }
    }

    // Normal reorder within the same level
    if (active.id !== over.id) {
      const oldIndex = section.fields.findIndex((f) => f.id === active.id);
      const newIndex = section.fields.findIndex((f) => f.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFields = arrayMove(section.fields, oldIndex, newIndex);
        onUpdate({ fields: newFields });
      }
    }
  }, [section.fields, onUpdate]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Add new block
  const handleAddBlock = useCallback((command: BlockCommand, insertIndex: number, containerId?: string) => {
    const newField: Field = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: command.fieldType,
      label: ['heading', 'paragraph', 'divider', 'callout'].includes(command.fieldType) ? '' : `New ${command.label}`,
      required: false,
      width: 'full',
      options: command.defaultConfig?.options as string[] | undefined,
      config: command.defaultConfig,
    };

    // If adding to a container (group/repeater), add to its children
    if (containerId) {
      const newFields = section.fields.map(f => {
        if (f.id === containerId) {
          const currentChildren = f.children || [];
          return {
            ...f,
            children: [...currentChildren, newField],
          };
        }
        return f;
      });
      onUpdate({ fields: newFields });
    } else {
      // Add to top level
      const newFields = [...section.fields];
      newFields.splice(insertIndex, 0, newField);
      onUpdate({ fields: newFields });
    }
    
    onSelectBlock(newField.id);
    setSlashMenu(null);
    setSlashQuery('');
    setIsTypingSlash(false);
  }, [section.fields, onUpdate, onSelectBlock]);

  // Delete block
  const handleDeleteBlock = useCallback((fieldId: string) => {
    const newFields = section.fields.filter(f => f.id !== fieldId);
    onUpdate({ fields: newFields });
    if (selectedBlockId === fieldId) {
      onSelectBlock(null);
    }
  }, [section.fields, onUpdate, selectedBlockId, onSelectBlock]);

  // Update block
  const handleUpdateBlock = useCallback((fieldId: string, updates: Partial<Field>) => {
    const newFields = section.fields.map(f =>
      f.id === fieldId ? { ...f, ...updates } : f
    );
    onUpdate({ fields: newFields });
  }, [section.fields, onUpdate]);

  // Move block
  const handleMoveBlock = useCallback((fieldId: string, direction: 'up' | 'down') => {
    const index = section.fields.findIndex(f => f.id === fieldId);
    if (index === -1) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= section.fields.length) return;
    
    const newFields = [...section.fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    onUpdate({ fields: newFields });
  }, [section.fields, onUpdate]);

  // Handle typing / for slash commands
  const handleSlashInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.startsWith('/')) {
      setSlashQuery(value.slice(1));
    } else {
      setSlashQuery('');
      setIsTypingSlash(false);
    }
  }, []);

  // Open slash menu
  const openSlashMenu = useCallback((position: { top: number; left: number }, insertIndex: number, containerId?: string) => {
    setSlashMenu({ position, insertIndex, containerId });
    setSlashQuery('');
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col min-h-full"
      style={{ backgroundColor: resolvedTheme.questionsBackgroundColor }}
      onClick={() => onSelectBlock(null)}
    >
      {/* Logo Header - shown if logo exists and showLogo is enabled */}
      {logoUrl && resolvedTheme.showLogo && (
        <div className="px-20 pt-6 pb-4 flex items-center justify-end">
          <img 
            src={logoUrl} 
            alt="Logo" 
            className="h-10 w-auto object-contain max-w-[200px]"
          />
        </div>
      )}

      {/* Section Header */}
      <div className={cn("px-20 pb-6 border-b border-gray-100", !logoUrl || !resolvedTheme.showLogo ? "pt-10" : "pt-2")}>
        <input
          type="text"
          value={section.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full text-3xl font-bold bg-transparent border-none outline-none placeholder:text-gray-300 focus:placeholder:text-gray-400 transition-colors"
          style={{ color: resolvedTheme.primaryColor }}
          placeholder="Untitled Section"
        />
        <textarea
          value={section.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full bg-transparent border-none outline-none mt-3 placeholder:text-gray-300 focus:placeholder:text-gray-400 transition-colors resize-none overflow-hidden"
          style={{ color: resolvedTheme.answersColor }}
          placeholder="Add a description to help applicants..."
          rows={1}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = target.scrollHeight + 'px';
          }}
        />
      </div>

      {/* Blocks */}
      <div className="flex-1 px-20 py-8 overflow-visible">
        <AnimatePresence mode="wait">
          {section.fields.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="relative"
            >
              {/* Empty state with doc-like input */}
              <div className="py-8 rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex flex-col items-center justify-center text-center mb-6">
                  <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                    <Plus className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium mb-1">Start building your form</p>
                  <p className="text-gray-400 text-sm">
                    Type <kbd className="px-2 py-1 bg-gray-100 rounded-md text-xs font-mono font-medium text-gray-600 mx-1">/</kbd> for commands
                  </p>
                </div>
                <div className="px-6">
                  <NewLineInput
                    onOpenSlashMenu={(pos) => openSlashMenu(pos, 0)}
                    onQueryChange={setSlashQuery}
                    isMenuOpen={slashMenu !== null}
                    placeholder="Type '/' to add your first field..."
                    autoFocus
                  />
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="fields"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={section.fields.map(f => f.id)} 
                  strategy={verticalListSortingStrategy}
                >
                  {/* Grid container for responsive field widths */}
                  <div className="grid grid-cols-12 gap-2">
                    {section.fields.map((field, index) => {
                      // Calculate grid column span based on field width
                      const getColSpan = (width?: string) => {
                        switch (width) {
                          case 'half': return 'col-span-6'
                          case 'third': return 'col-span-4'
                          case 'quarter': return 'col-span-3'
                          default: return 'col-span-12' // full width
                        }
                      }

                      return (
                        <div key={field.id} className={cn(getColSpan(field.width))}>
                          <SortableBlock id={field.id}>
                            <Block
                              field={field}
                              isDropTarget={overContainerId === field.id}
                              isSelected={selectedBlockId === field.id}
                              onSelect={() => onSelectBlock(field.id)}
                              onDelete={() => handleDeleteBlock(field.id)}
                              onUpdate={(updates) => handleUpdateBlock(field.id, updates)}
                              onMoveUp={() => handleMoveBlock(field.id, 'up')}
                              onMoveDown={() => handleMoveBlock(field.id, 'down')}
                              onOpenSlashMenu={(pos, containerId) => openSlashMenu(pos, index + 1, containerId)}
                              onMoveToSection={onMoveFieldToSection ? (targetSectionId) => onMoveFieldToSection(field.id, targetSectionId) : undefined}
                              allSections={allSections}
                              currentSectionId={section.id}
                              themeColor={themeColor}
                              resolvedTheme={resolvedTheme}
                              allFields={section.fields}
                              isFirst={index === 0}
                              isLast={index === section.fields.length - 1}
                              selectedBlockId={selectedBlockId}
                              onSelectBlock={onSelectBlock}
                            />
                          </SortableBlock>
                        </div>
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Add block at end - Doc-like new line */}
              <div className="pt-4 pb-6">
                <NewLineInput
                  onOpenSlashMenu={(pos) => openSlashMenu(pos, section.fields.length)}
                  onQueryChange={setSlashQuery}
                  isMenuOpen={slashMenu !== null}
                  placeholder="Click here and type '/' to add a block..."
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Slash Menu */}
      <AnimatePresence>
        {slashMenu && (
          <SlashMenu
            query={slashQuery}
            position={slashMenu.position}
            onSelect={(cmd) => handleAddBlock(cmd, slashMenu.insertIndex, slashMenu.containerId)}
            onClose={() => {
              setSlashMenu(null);
              setSlashQuery('');
              setIsTypingSlash(false);
            }}
            onQueryChange={setSlashQuery}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default BlockEditor;
