'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Check, X, Settings, ArrowUpRightFromCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Field } from '@/types/portal';
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter';
import { InlineOptionsEditor } from './InlineOptionsEditor';

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
  onOpenSettings?: () => void;
  onMoveOut?: () => void;
}

export function SortableChildField({ field, onDelete, onUpdate, onSelect, isSelected, themeColor, allFields, onOpenSettings, onMoveOut }: SortableChildFieldProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelInputRef = useRef<HTMLTextAreaElement | null>(null);
  // Pin the height immediately on mount/label change — otherwise the box only
  // gets its correct (compact) height reactively once the user types, leaving
  // a taller-than-needed gap on first render.
  useEffect(() => {
    const el = labelInputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }, [field.label]);
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

  // Auto-resize textarea when label changes
  useEffect(() => {
    if (labelInputRef.current) {
      labelInputRef.current.style.height = 'auto';
      labelInputRef.current.style.height = labelInputRef.current.scrollHeight + 'px';
    }
  }, [field.label]);

  // Check if field supports inline options editing
  const supportsInlineOptions = ['select', 'multiselect', 'radio'].includes(field.type);

  return (
    <div
      ref={(el) => { setNodeRef(el); containerRef.current = el; }}
      style={style}
      {...attributes}
      className={cn(
        "relative bg-white rounded-lg border-2 transition-all cursor-pointer",
        isDragging ? "border-blue-300 shadow-md" : "border-gray-200",
        isHovered && !isDragging && "border-gray-300 bg-gray-50/50",
        isSelected && "ring-2 ring-blue-500 bg-blue-50/30"
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
      {/* Drag handle - Left side inside card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        className="absolute left-2 top-2 flex flex-col gap-0.5 z-10"
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(); // Select this field
            onOpenSettings?.(); // Open settings panel
          }}
          className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200"
          title="Field settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
        {onMoveOut && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveOut();
            }}
            className="p-1.5 rounded-md hover:bg-purple-50 text-gray-400 hover:text-purple-500 transition-colors bg-white/80 backdrop-blur-sm shadow-sm border border-gray-200"
            title="Move out of container"
          >
            <ArrowUpRightFromCircle className="w-3.5 h-3.5" />
          </button>
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
      <div className="pt-10 pb-3 px-2">
        <div className="space-y-2">
          {/* Editable Label & Description */}
          <div className="space-y-0.5">
            <div className="flex items-start gap-1.5">
              <textarea
                ref={labelInputRef}
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => onSelect()}
                className="text-base font-medium bg-transparent border-none outline-none placeholder:text-gray-400 focus:ring-0 focus:bg-gray-100 focus:px-1.5 focus:-mx-1.5 focus:rounded text-gray-900 resize-none overflow-hidden transition-colors"
                style={{ fieldSizing: 'content', minWidth: '4ch', maxWidth: '100%' } as React.CSSProperties}
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
                onChange={(e) => onUpdate({ description: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                onFocus={() => onSelect()}
                className="w-full text-xs bg-transparent border-none outline-none placeholder:text-gray-400 focus:ring-0 focus:bg-gray-100 focus:px-1.5 focus:-mx-1.5 focus:rounded text-gray-500 transition-colors"
                placeholder="Add a description (help text shown below field)..."
              />
            ) : null}
          </div>

          {/* Field Preview - hide when editing options for select/multiselect/radio */}
          {!(isSelected && supportsInlineOptions) && (
            <PortalFieldAdapter
              field={{ ...field, label: '', description: '', required: false }}
              value={undefined}
              onChange={() => {}}
              themeColor={themeColor}
              allFields={allFields}
              disabled={true}
            />
          )}

          {/* Inline Options Editor for select/multiselect/radio fields */}
          {isSelected && supportsInlineOptions && (
            <InlineOptionsEditor
              options={field.options}
              onOptionsChange={(newOptions) => onUpdate({ options: newOptions })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
