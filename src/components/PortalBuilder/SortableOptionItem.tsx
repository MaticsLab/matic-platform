'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';

// ============================================================================
// SORTABLE OPTION COMPONENTS - For draggable option items in inline editors
// ============================================================================

interface SortableOptionProps {
  id: string;
  option: string;
  index: number;
  onUpdate: (newValue: string) => void;
  onDelete: () => void;
}

export function SortableOption({ id, option, index, onUpdate, onDelete }: SortableOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 group">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3 text-gray-300 hover:text-gray-500" />
      </button>
      <input
        type="text"
        value={option}
        onChange={(e) => onUpdate(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 h-7 px-2 text-xs bg-gray-50/50 border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        placeholder={`Option ${index + 1}`}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

// NOTE: not currently invoked anywhere — preserved as dead code from the
// original BlockEditor.tsx. Not wired up; out of scope to do so.
interface SortableConfigOptionProps {
  id: string;
  option: { label: string; value: string };
  index: number;
  onUpdate: (newLabel: string) => void;
  onDelete: () => void;
}

export function SortableConfigOption({ id, option, index, onUpdate, onDelete }: SortableConfigOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1.5 group">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3 text-gray-300 hover:text-gray-500" />
      </button>
      <input
        type="text"
        value={option.label}
        onChange={(e) => onUpdate(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 h-7 px-2 text-xs bg-gray-50/50 border border-gray-200 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        placeholder={`Option ${index + 1}`}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
