/**
 * Tiptap Block Editor
 * 
 * A real Tiptap-based block editor for the portal builder with:
 * - Custom FieldBlock nodes for form fields
 * - Slash commands for inserting blocks
 * - Real-time collaboration via Supabase
 * - Presence indicators and remote cursors
 */

'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useEditor, EditorContent, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import * as Y from 'yjs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type, AlignLeft, Hash, Mail, Phone, Link as LinkIcon, List, CheckSquare,
  ToggleLeft, Calendar, Clock, Upload, Image as ImageIcon, Heading as HeadingIcon,
  FileText, Minus, AlertCircle, MapPin, Star, Layers, Repeat, Command,
  GripVertical, Plus, Trash2, Users, Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SupabaseYjsProvider, UserPresence } from './providers/SupabaseYjsProvider';
import { FieldBlockNode, SlashCommandsExtension, SlashCommandItem } from './extensions';
import { PortalFieldAdapter } from '@/components/Fields/PortalFieldAdapter';
import type { Section, Field, FieldType } from '@/types/portal';

// ============================================================================
// TYPES
// ============================================================================

interface TiptapBlockEditorProps {
  /** Section data */
  section: Section;
  /** Callback when section is updated */
  onUpdate: (updates: Partial<Section>) => void;
  /** Currently selected block ID */
  selectedBlockId: string | null;
  /** Callback when a block is selected */
  onSelectBlock: (id: string | null) => void;
  /** Theme color for styling */
  themeColor?: string;
  /** Enable collaborative editing */
  collaborative?: boolean;
  /** Room ID for collaboration (usually portal ID) */
  roomId?: string;
  /** Current user info for collaboration */
  currentUser?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

// ============================================================================
// BLOCK COMMANDS
// ============================================================================

const BLOCK_COMMANDS: SlashCommandItem[] = [
  // Basic
  { id: 'text', label: 'Text', description: 'Plain text input', icon: <Type className="w-4 h-4" />, fieldType: 'text', category: 'Basic', keywords: ['short', 'input', 'field'] },
  { id: 'textarea', label: 'Long Text', description: 'Multi-line text area', icon: <AlignLeft className="w-4 h-4" />, fieldType: 'textarea', category: 'Basic', keywords: ['paragraph', 'multiline'] },
  { id: 'number', label: 'Number', description: 'Numeric input', icon: <Hash className="w-4 h-4" />, fieldType: 'number', category: 'Basic', keywords: ['integer', 'decimal'] },
  { id: 'email', label: 'Email', description: 'Email address', icon: <Mail className="w-4 h-4" />, fieldType: 'email', category: 'Basic' },
  { id: 'phone', label: 'Phone', description: 'Phone number', icon: <Phone className="w-4 h-4" />, fieldType: 'phone', category: 'Basic', keywords: ['telephone', 'mobile'] },
  { id: 'url', label: 'URL', description: 'Website link', icon: <LinkIcon className="w-4 h-4" />, fieldType: 'url', category: 'Basic', keywords: ['link', 'website'] },
  
  // Selection
  { id: 'select', label: 'Dropdown', description: 'Single choice dropdown', icon: <List className="w-4 h-4" />, fieldType: 'select', category: 'Selection', defaultConfig: { options: ['Option 1', 'Option 2', 'Option 3'] } },
  { id: 'multiselect', label: 'Multi-Select', description: 'Multiple choices', icon: <CheckSquare className="w-4 h-4" />, fieldType: 'multiselect', category: 'Selection', defaultConfig: { options: ['Option 1', 'Option 2', 'Option 3'] } },
  { id: 'radio', label: 'Radio', description: 'Radio buttons', icon: <ToggleLeft className="w-4 h-4" />, fieldType: 'radio', category: 'Selection', defaultConfig: { options: ['Option 1', 'Option 2'] } },
  { id: 'checkbox', label: 'Checkbox', description: 'Yes/No checkbox', icon: <CheckSquare className="w-4 h-4" />, fieldType: 'checkbox', category: 'Selection' },
  
  // Date & Time
  { id: 'date', label: 'Date', description: 'Date picker', icon: <Calendar className="w-4 h-4" />, fieldType: 'date', category: 'Date & Time' },
  { id: 'time', label: 'Time', description: 'Time picker', icon: <Clock className="w-4 h-4" />, fieldType: 'time', category: 'Date & Time' },
  { id: 'datetime', label: 'Date & Time', description: 'Date and time', icon: <Calendar className="w-4 h-4" />, fieldType: 'datetime', category: 'Date & Time' },
  
  // Media
  { id: 'file', label: 'File Upload', description: 'Upload files', icon: <Upload className="w-4 h-4" />, fieldType: 'file', category: 'Media', keywords: ['attachment', 'document'] },
  { id: 'image', label: 'Image', description: 'Upload image', icon: <ImageIcon className="w-4 h-4" />, fieldType: 'image', category: 'Media', keywords: ['photo', 'picture'] },
  
  // Layout
  { id: 'heading', label: 'Heading', description: 'Section title', icon: <HeadingIcon className="w-4 h-4" />, fieldType: 'heading', category: 'Layout', keywords: ['title', 'h1', 'h2', 'h3'] },
  { id: 'paragraph', label: 'Paragraph', description: 'Text content', icon: <FileText className="w-4 h-4" />, fieldType: 'paragraph', category: 'Layout', keywords: ['text', 'description'] },
  { id: 'divider', label: 'Divider', description: 'Horizontal line', icon: <Minus className="w-4 h-4" />, fieldType: 'divider', category: 'Layout', keywords: ['separator', 'hr'] },
  { id: 'callout', label: 'Callout', description: 'Highlighted info', icon: <AlertCircle className="w-4 h-4" />, fieldType: 'callout', category: 'Layout', keywords: ['info', 'warning', 'note'] },
  
  // Advanced
  { id: 'address', label: 'Address', description: 'Full address', icon: <MapPin className="w-4 h-4" />, fieldType: 'address', category: 'Advanced', keywords: ['location'] },
  { id: 'rating', label: 'Rating', description: 'Star rating', icon: <Star className="w-4 h-4" />, fieldType: 'rating', category: 'Advanced', keywords: ['stars', 'score'] },
  { id: 'group', label: 'Field Group', description: 'Group fields together', icon: <Layers className="w-4 h-4" />, fieldType: 'group', category: 'Advanced', defaultConfig: { columns: 2 } },
  { id: 'repeater', label: 'Repeater', description: 'Repeating fields', icon: <Repeat className="w-4 h-4" />, fieldType: 'repeater', category: 'Advanced', defaultConfig: { minItems: 0, maxItems: 10 } },
];

const CATEGORIES = ['Basic', 'Selection', 'Date & Time', 'Media', 'Layout', 'Advanced'];

// ============================================================================
// PRESENCE INDICATOR COMPONENT
// ============================================================================

interface PresenceIndicatorProps {
  users: UserPresence[];
  currentUserId: string;
}

function PresenceIndicator({ users, currentUserId }: PresenceIndicatorProps) {
  const otherUsers = users.filter(u => u.id !== currentUserId);
  
  if (otherUsers.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-full shadow-sm">
      <Users className="w-3.5 h-3.5 text-gray-400" />
      <div className="flex -space-x-2">
        {otherUsers.slice(0, 3).map((user) => (
          <div
            key={user.id}
            className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-medium text-white"
            style={{ backgroundColor: user.color }}
            title={user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}
        {otherUsers.length > 3 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-medium text-gray-600">
            +{otherUsers.length - 3}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-500">
        {otherUsers.length} {otherUsers.length === 1 ? 'person' : 'people'} editing
      </span>
    </div>
  );
}

// ============================================================================
// SLASH MENU COMPONENT
// ============================================================================

interface SlashMenuProps {
  items: SlashCommandItem[];
  selectedIndex: number;
  onSelect: (item: SlashCommandItem) => void;
  position: { top: number; left: number };
}

function SlashMenu({ items, selectedIndex, onSelect, position }: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, SlashCommandItem[]> = {};
    items.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [items]);

  let itemIndex = 0;

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="fixed bg-white rounded-xl shadow-2xl border border-gray-100 w-72 overflow-hidden z-[9999]"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2.5 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-blue-50">
            <Command className="w-3 h-3 text-blue-500" />
          </div>
          <p className="text-xs text-gray-500">Add a new block</p>
        </div>
      </div>

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
                      isSelected ? "bg-blue-50" : "hover:bg-gray-50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"
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

      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/80 flex items-center gap-4 text-[10px] text-gray-400">
        <span>↑↓ navigate</span>
        <span>↵ select</span>
        <span>esc close</span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN TIPTAP BLOCK EDITOR
// ============================================================================

export function TiptapBlockEditor({
  section,
  onUpdate,
  selectedBlockId,
  onSelectBlock,
  themeColor = '#3B82F6',
  collaborative = false,
  roomId,
  currentUser,
}: TiptapBlockEditorProps) {
  // Collaboration state
  const [ydoc] = useState(() => new Y.Doc());
  const [provider, setProvider] = useState<SupabaseYjsProvider | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<UserPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Slash menu state
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashMenuItems, setSlashMenuItems] = useState<SlashCommandItem[]>(BLOCK_COMMANDS);
  const [slashMenuIndex, setSlashMenuIndex] = useState(0);

  // Initialize Supabase provider for collaboration
  useEffect(() => {
    if (!collaborative || !roomId) return;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not available for collaboration');
      return;
    }

    const newProvider = new SupabaseYjsProvider({
      supabaseUrl,
      supabaseKey,
      roomId,
      doc: ydoc,
      userId: currentUser?.id,
      userName: currentUser?.name || 'Anonymous',
    });

    newProvider.onConnect = () => setIsConnected(true);
    newProvider.onDisconnect = () => setIsConnected(false);
    newProvider.onAwarenessUpdate = (users) => setConnectedUsers(users);

    newProvider.connect();
    setProvider(newProvider);

    return () => {
      newProvider.destroy();
    };
  }, [collaborative, roomId, currentUser?.id, currentUser?.name, ydoc]);

  // Handle slash command selection
  const handleSlashSelect = useCallback((item: SlashCommandItem) => {
    const newField: Field = {
      id: `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: item.fieldType as FieldType,
      label: ['heading', 'paragraph', 'divider', 'callout'].includes(item.fieldType) ? '' : `New ${item.label}`,
      required: false,
      width: 'full',
      options: item.defaultConfig?.options as string[] | undefined,
      config: item.defaultConfig,
    };

    const newFields = [...section.fields, newField];
    onUpdate({ fields: newFields });
    onSelectBlock(newField.id);
    setSlashMenuOpen(false);
  }, [section.fields, onUpdate, onSelectBlock]);

  // Configure Tiptap editor
  const editor = useEditor({
    immediatelyRender: false, // Disable SSR to avoid hydration mismatches
    extensions: [
      StarterKit.configure({
        // Disable default nodes we're replacing
        heading: false,
        paragraph: {
          HTMLAttributes: {
            class: 'min-h-[1em]',
          },
        },
      }),
      Placeholder.configure({
        placeholder: 'Type "/" for commands...',
        showOnlyWhenEditable: true,
      }),
      // Add collaboration if enabled
      ...(collaborative && provider ? [
        Collaboration.configure({
          document: ydoc,
        }),
        CollaborationCursor.configure({
          provider: provider as any,
          user: {
            name: currentUser?.name || 'Anonymous',
            color: themeColor,
          },
        }),
      ] : []),
      // Custom field block extension
      FieldBlockNode.configure({
        // Node view will be set up separately
      }),
      // Slash commands
      SlashCommandsExtension.configure({
        commands: BLOCK_COMMANDS,
        onSelect: handleSlashSelect,
        render: () => {
          let component: any = null;
          let popup: HTMLElement | null = null;

          return {
            onStart: (props) => {
              const { clientRect } = props;
              if (!clientRect) return;

              const rect = clientRect();
              if (!rect) return;

              setSlashMenuPosition({
                top: rect.bottom + 8,
                left: rect.left,
              });
              setSlashMenuItems(props.items);
              setSlashMenuIndex(0);
              setSlashMenuOpen(true);
            },
            onUpdate: (props) => {
              setSlashMenuItems(props.items);
            },
            onKeyDown: (props) => {
              if (props.event.key === 'ArrowUp') {
                setSlashMenuIndex(i => Math.max(0, i - 1));
                return true;
              }
              if (props.event.key === 'ArrowDown') {
                setSlashMenuIndex(i => Math.min(slashMenuItems.length - 1, i + 1));
                return true;
              }
              if (props.event.key === 'Enter') {
                const item = slashMenuItems[slashMenuIndex];
                if (item) handleSlashSelect(item);
                return true;
              }
              if (props.event.key === 'Escape') {
                setSlashMenuOpen(false);
                return true;
              }
              return false;
            },
            onExit: () => {
              setSlashMenuOpen(false);
            },
          };
        },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-20 py-10',
      },
    },
  });

  // Handle field updates
  const handleUpdateField = useCallback((fieldId: string, updates: Partial<Field>) => {
    const newFields = section.fields.map(f =>
      f.id === fieldId ? { ...f, ...updates } : f
    );
    onUpdate({ fields: newFields });
  }, [section.fields, onUpdate]);

  // Handle field deletion
  const handleDeleteField = useCallback((fieldId: string) => {
    const newFields = section.fields.filter(f => f.id !== fieldId);
    onUpdate({ fields: newFields });
    if (selectedBlockId === fieldId) {
      onSelectBlock(null);
    }
  }, [section.fields, onUpdate, selectedBlockId, onSelectBlock]);

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Collaboration header */}
      {collaborative && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Circle 
              className={cn(
                "w-2 h-2",
                isConnected ? "fill-green-500 text-green-500" : "fill-gray-300 text-gray-300"
              )} 
            />
            <span className="text-xs text-gray-500">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
          <PresenceIndicator users={connectedUsers} currentUserId={currentUser?.id || ''} />
        </div>
      )}

      {/* Section Header */}
      <div className="px-20 pt-10 pb-6 border-b border-gray-100">
        <input
          type="text"
          value={section.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="w-full text-3xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300"
          placeholder="Untitled Section"
        />
        <input
          type="text"
          value={section.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          className="w-full mt-2 text-gray-500 bg-transparent border-none outline-none placeholder:text-gray-400"
          placeholder="Add a description..."
        />
      </div>

      {/* Fields List */}
      <div className="flex-1 px-20 py-8 space-y-4">
        {section.fields.map((field) => (
          <div
            key={field.id}
            className={cn(
              "relative group transition-all duration-200 rounded-lg p-3",
              selectedBlockId === field.id && "bg-blue-50/50 ring-2 ring-blue-500 ring-offset-1",
              selectedBlockId !== field.id && "hover:bg-gray-50/70"
            )}
            onClick={() => onSelectBlock(field.id)}
          >
            {/* Controls */}
            <div className={cn(
              "absolute -left-10 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
              selectedBlockId === field.id && "opacity-100"
            )}>
              <button className="p-1 rounded hover:bg-gray-100 text-gray-400 cursor-grab">
                <GripVertical className="w-4 h-4" />
              </button>
            </div>
            <div className={cn(
              "absolute -right-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity",
              selectedBlockId === field.id && "opacity-100"
            )}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteField(field.id);
                }}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Field Content */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => handleUpdateField(field.id, { label: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-400"
                  placeholder="Field label..."
                />
                {field.required && <span className="text-red-500 text-xs">*</span>}
              </div>
              {(selectedBlockId === field.id || field.description) && (
                <input
                  type="text"
                  value={field.description || ''}
                  onChange={(e) => handleUpdateField(field.id, { description: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-xs text-gray-500 bg-transparent border-none outline-none placeholder:text-gray-400"
                  placeholder="Add description..."
                />
              )}
              <PortalFieldAdapter
                field={{ ...field, label: '', description: '' }}
                value={undefined}
                onChange={() => {}}
                themeColor={themeColor}
                allFields={section.fields}
                disabled={true}
              />
            </div>
          </div>
        ))}

        {/* Add block button */}
        <button
          onClick={(e) => {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            setSlashMenuPosition({ top: rect.bottom + 8, left: rect.left });
            setSlashMenuOpen(true);
          }}
          className="w-full py-4 text-sm text-gray-400 hover:text-gray-600 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add block
        </button>
      </div>

      {/* Slash Menu */}
      <AnimatePresence>
        {slashMenuOpen && (
          <SlashMenu
            items={slashMenuItems}
            selectedIndex={slashMenuIndex}
            onSelect={handleSlashSelect}
            position={slashMenuPosition}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default TiptapBlockEditor;
