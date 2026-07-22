'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useDroppable, DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { GripVertical, Plus, Trash2, Layers, Repeat, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Field } from '@/types/portal';
import { BlockCollaboratorRing } from './PresenceIndicators';
import { ChildFieldsDndContext } from './ChildFieldsDndContext';

// ============================================================================
// CONTAINER FIELD BLOCK - Renders group/repeater fields, extracted out of
// Block's `isContainerField` branch. Hover state is purely presentational to
// this subtree (Block's own isHovered is unused once this branch renders),
// so it's kept local here rather than threaded through as a prop.
// ============================================================================

interface ContainerFieldBlockProps {
  field: Field;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<Field>) => void;
  onOpenSlashMenu: (position: { top: number; left: number }, containerId?: string) => void;
  onMoveToSection?: (targetSectionId: string) => void;
  themeColor?: string;
  allFields: Field[];
  dragListeners?: Record<string, unknown>;
  isDropTarget?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string | null) => void;
  onOpenSettings?: () => void;
}

export function ContainerFieldBlock({
  field,
  isSelected,
  onSelect,
  onDelete,
  onUpdate,
  onOpenSlashMenu,
  onMoveToSection,
  themeColor,
  allFields,
  dragListeners,
  isDropTarget,
  selectedBlockId,
  onSelectBlock,
  onOpenSettings,
}: ContainerFieldBlockProps) {
  const [isHovered, setIsHovered] = useState(false);
  const blockRef = useRef<HTMLDivElement>(null);

  // Make groups/repeaters droppable
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `container-${field.id}`,
    disabled: false,
    data: { type: 'container', fieldId: field.id }
  });

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

  // Handler to move a child out of container to section level
  const handleMoveChildOut = (childId: string) => {
    // Find the child field
    const childField = children.find(c => c.id === childId);
    if (!childField) return;

    // This requires coordinated updates:
    // 1. Remove child from this container
    // 2. Add child to section's field list

    // We need to update the entire section, not just this field
    // We'll call onUpdate on the section level
    // But we're inside a field component, so we need to bubble this up

    // For now, let's use onMoveToSection if available
    // The parent Portal Editor will handle extracting the field properly
    if (onMoveToSection) {
      // This will be handled by PortalEditor's handleMoveFieldToSection
      // which already has recursive extraction logic
      alert('To move a field out of a container, use the right-click menu or drag it to another section.');
    }
  };

  return (
    <BlockCollaboratorRing blockId={field.id}>
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
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
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
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors"
            title="Field settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
            onReorder={handleChildDragEnd}
            field={field}
            onDeleteChild={handleDeleteChild}
            onUpdateChild={handleUpdateChild}
            onSelectChild={(id) => onSelectBlock?.(id)}
            selectedChildId={selectedBlockId || null}
            themeColor={themeColor}
            allFields={allFields}
            onOpenSettings={onOpenSettings}
            onMoveChildOut={handleMoveChildOut}
          >
            {children}
          </ChildFieldsDndContext>
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
    </BlockCollaboratorRing>
  );
}
