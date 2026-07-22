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

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
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
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Section, Field, PortalConfig } from '@/types/portal';
import { useCollaborationOptional } from './CollaborationProvider';
import { getGoogleFont } from '@/lib/fonts';
import { useGoogleFont } from '@/hooks/useGoogleFont';
import { QUESTION_SIZE_PRESETS } from '@/lib/form-theme-presets';
import { BlockCommand } from './blockCommands';
import { SlashMenu } from './SlashMenu';
import { NewLineInput } from './NewLineInput';
import { SortableBlock } from './SortableBlock';
import { Block } from './Block';

// ============================================================================
// TYPES
// ============================================================================

// Matches PortalConfig['settings']['formTheme'] exactly — deriving rather than
// hand-declaring avoids this drifting out of sync with the real type again.
type FormTheme = NonNullable<PortalConfig['settings']['formTheme']>;

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
  /** Callback to open field settings panel */
  onOpenSettings?: () => void;
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
  onOpenSettings,
}: BlockEditorProps) {
  // Resolve theme colors with defaults
  const resolvedTheme = {
    questionsBackgroundColor: formTheme?.questionsBackgroundColor || '#ffffff',
    primaryColor: formTheme?.primaryColor || themeColor,
    questionsColor: formTheme?.questionsColor || '#111827',
    answersColor: formTheme?.answersColor || '#374151',
    showLogo: formTheme?.showLogo !== false,
  };
  // Font + question size match the real public form (StandaloneFormRenderer) —
  // same presets, so the canvas doesn't drift from what applicants actually see.
  const fontFamily = getGoogleFont(formTheme?.font).fontFamily;
  const sizePreset = QUESTION_SIZE_PRESETS[formTheme?.questionSize || 'normal'] || QUESTION_SIZE_PRESETS.normal;
  useGoogleFont(formTheme?.font);
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
      id: uuidv4(),
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
      className="builder-canvas-fields flex flex-col min-h-full"
      style={{
        backgroundColor: resolvedTheme.questionsBackgroundColor,
        fontFamily,
        '--bc-label-size': `${sizePreset.label}px`,
        '--bc-input-height': `${sizePreset.input}px`,
      } as React.CSSProperties}
      onClick={() => onSelectBlock(null)}
    >
      <style>{`
        .builder-canvas-fields label { font-size: var(--bc-label-size); }
        .builder-canvas-fields input:not([type="checkbox"]):not([type="radio"]),
        .builder-canvas-fields textarea,
        .builder-canvas-fields button[role="combobox"] {
          min-height: var(--bc-input-height);
        }
      `}</style>
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
                              onOpenSettings={onOpenSettings}
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
