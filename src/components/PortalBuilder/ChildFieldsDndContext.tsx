'use client';

import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Field } from '@/types/portal';
import { SortableChildField } from './SortableChildField';

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
  onOpenSettings?: () => void;
  onMoveChildOut?: (childId: string) => void;
}

export function ChildFieldsDndContext({
  children,
  onReorder,
  field,
  onDeleteChild,
  onUpdateChild,
  onSelectChild,
  selectedChildId,
  themeColor,
  allFields,
  onOpenSettings,
  onMoveChildOut
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
              onOpenSettings={onOpenSettings}
              onMoveOut={onMoveChildOut ? () => onMoveChildOut(child.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
