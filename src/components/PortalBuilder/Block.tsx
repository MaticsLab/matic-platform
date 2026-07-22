'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import {
  GripVertical, Plus, Trash2, FolderInput, Check, X, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Section, Field } from '@/types/portal';
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter';
import { BlockCollaboratorRing } from './PresenceIndicators';
import { BlockLayoutContent } from './BlockLayoutContent';
import { InlineOptionsEditor } from './InlineOptionsEditor';
import { ContainerFieldBlock } from './ContainerFieldBlock';

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
  /** Callback to open field settings panel */
  onOpenSettings?: () => void;
}

export function Block({
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
  onOpenSettings,
}: BlockProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const labelTextareaRef = useRef<HTMLTextAreaElement>(null);
  // Pin the height immediately on mount/label change — otherwise the box only
  // gets its correct (compact) height reactively once the user types, leaving
  // a taller-than-needed gap on first render.
  useEffect(() => {
    const el = labelTextareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [field.label]);

  const isLayoutField = ['heading', 'paragraph', 'divider', 'callout'].includes(field.type);
  const isContainerField = ['group', 'repeater'].includes(field.type);

  // Auto-resize textarea when label changes
  useEffect(() => {
    if (labelTextareaRef.current) {
      labelTextareaRef.current.style.height = 'auto';
      labelTextareaRef.current.style.height = labelTextareaRef.current.scrollHeight + 'px';
    }
  }, [field.label]);

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

  // Render container field (group/repeater)
  if (isContainerField) {
    return (
      <ContainerFieldBlock
        field={field}
        isSelected={isSelected}
        onSelect={onSelect}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onOpenSlashMenu={onOpenSlashMenu}
        onMoveToSection={onMoveToSection}
        themeColor={themeColor}
        allFields={allFields}
        dragListeners={dragListeners}
        isDropTarget={isDropTarget}
        selectedBlockId={selectedBlockId}
        onSelectBlock={onSelectBlock}
        onOpenSettings={onOpenSettings}
      />
    );
  }

  return (
    <BlockCollaboratorRing blockId={field.id}>
      <motion.div
        ref={blockRef}
        layout
        data-block-id={field.id}
        className={cn(
          "relative group transition-all duration-200 rounded-lg cursor-pointer",
          isSelected && "bg-blue-50/50 ring-2 ring-blue-500",
          !isSelected && isHovered && "bg-gray-50/70",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowDeleteConfirm(false);
      }}
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings?.();
          }}
          className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200"
          title="Field settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
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
      <div className="pt-10 pb-3 px-2">
        {isLayoutField ? (
          <BlockLayoutContent
            field={field}
            isEditing={isEditing}
            onStartEditing={() => setIsEditing(true)}
            onStopEditing={() => setIsEditing(false)}
            onUpdate={onUpdate}
            inputRef={inputRef}
            handleKeyDown={handleKeyDown}
          />
        ) : (
          <div className="space-y-2">
            {/* Editable Label & Description */}
            <div className="space-y-0.5">
              <div className="flex items-start gap-1.5">
                <textarea
                  ref={labelTextareaRef}
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
                  className="text-base font-medium bg-transparent border-none outline-none placeholder:text-gray-400 focus:ring-0 focus:bg-gray-100 focus:px-1.5 focus:-mx-1.5 focus:rounded resize-none overflow-hidden transition-colors"
                  style={{
                    color: resolvedTheme?.questionsColor || '#111827',
                    fieldSizing: 'content',
                    minWidth: '4ch',
                    maxWidth: '100%',
                  } as React.CSSProperties}
                  placeholder="Field label..."
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
                {field.required && <span className="text-red-500 text-sm flex-shrink-0 leading-[1.5rem]">*</span>}
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
                  className="w-full text-xs bg-transparent border-none outline-none placeholder:text-gray-400 focus:ring-0 focus:bg-gray-100 focus:px-1.5 focus:-mx-1.5 focus:rounded transition-colors"
                  style={{ color: resolvedTheme?.answersColor || '#6b7280' }}
                  placeholder="Add a description (help text shown below field)..."
                />
              ) : null}
            </div>

            {/* Inline Options Editor for select/multiselect/radio fields */}
            {isSelected && ['select', 'multiselect', 'radio'].includes(field.type) && (
              <InlineOptionsEditor
                options={field.options}
                onOptionsChange={(newOptions) => onUpdate({ options: newOptions })}
              />
            )}

            {/* Field Preview - hide when editing options for select/multiselect/radio */}
            {!(isSelected && ['select', 'multiselect', 'radio'].includes(field.type)) && (
              <div className="relative">
                <PortalFieldAdapter
                  field={{ ...field, label: '', description: '', required: false }}
                  value={undefined}
                  onChange={() => {}}
                  themeColor={themeColor}
                  allFields={allFields}
                  disabled={true}
                />
                {/* Clickable overlay - only show when NOT selected to avoid interfering with editing */}
                {!isSelected && (
                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onSelect();
                    }}
                    className="absolute inset-0 cursor-pointer"
                    title="Click to select field"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
    </BlockCollaboratorRing>
  );
}
