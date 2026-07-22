'use client';

import React, { useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { SortableOption } from './SortableOptionItem';

// ============================================================================
// INLINE OPTIONS EDITOR - Shared "options" editor for select/multiselect/radio
// fields, used both for top-level Block fields and for SortableChildField
// (fields nested inside a group/repeater). Extracted because the two call
// sites were structurally identical (same DndContext/sensors, same
// SortableOption list, same "Add" button, same options-array semantics).
// ============================================================================

interface InlineOptionsEditorProps {
  options: string[] | undefined;
  onOptionsChange: (options: string[]) => void;
}

export function InlineOptionsEditor({ options, onOptionsChange }: InlineOptionsEditorProps) {
  const handleOptionDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentOptions = options || [];
    const oldIndex = parseInt(active.id.toString().replace('option-', ''));
    const newIndex = parseInt(over.id.toString().replace('option-', ''));

    const newOptions = arrayMove(currentOptions, oldIndex, newIndex);
    onOptionsChange(newOptions);
  }, [options, onOptionsChange]);

  const optionSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  return (
    <div className="space-y-2 pt-2 border-t border-gray-100">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Options</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const currentOptions = options || [];
            onOptionsChange([...currentOptions, `Option ${currentOptions.length + 1}`]);
          }}
          className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>
      <DndContext sensors={optionSensors} collisionDetection={closestCenter} onDragEnd={handleOptionDragEnd}>
        <SortableContext items={(options || []).map((_, idx) => `option-${idx}`)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {(options || []).map((option: string, index: number) => (
              <SortableOption
                key={`option-${index}`}
                id={`option-${index}`}
                option={option}
                index={index}
                onUpdate={(newValue) => {
                  const newOptions = [...(options || [])];
                  newOptions[index] = newValue;
                  onOptionsChange(newOptions);
                }}
                onDelete={() => {
                  const newOptions = (options || []).filter((_, i) => i !== index);
                  onOptionsChange(newOptions);
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
