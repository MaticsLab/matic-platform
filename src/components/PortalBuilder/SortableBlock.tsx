'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ============================================================================
// SORTABLE BLOCK WRAPPER - Enables drag-and-drop reordering
// ============================================================================

interface SortableBlockProps {
  id: string;
  children: React.ReactNode;
  isDragging?: boolean;
}

export function SortableBlock({ id, children, isDragging }: SortableBlockProps) {
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
