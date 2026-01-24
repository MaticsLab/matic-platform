'use client';

/**
 * Block Renderer
 * 
 * Universal block rendering component that dispatches to specific
 * block renderers based on block type. Supports both edit mode 
 * (in the portal builder) and view mode (in the public portal).
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { 
  Block, 
  BlockCategory,
  PortalRuntimeContext,
  VisibilityRule,
  evaluateVisibility 
} from '@/types/portal-blocks';
import { getBlockDefinition } from './registry';

// ============================================================================
// TYPES
// ============================================================================

export type BlockRenderMode = 'view' | 'edit' | 'preview';

export interface BlockRendererProps {
  /** The block to render */
  block: Block;
  
  /** Rendering mode */
  mode: BlockRenderMode;
  
  /** Runtime context for visibility evaluation */
  context?: PortalRuntimeContext;
  
  /** Current form values (for field blocks) */
  values?: Record<string, unknown>;
  
  /** Change handler (for field blocks) */
  onChange?: (fieldName: string, value: unknown) => void;
  
  /** Action handler (for auth/action blocks) */
  onAction?: (action: string, data: Record<string, unknown>) => void | Promise<void>;
  
  /** Theme color */
  themeColor?: string;
  
  /** Is block selected (edit mode) */
  isSelected?: boolean;
  
  /** Selection handler (edit mode) */
  onSelect?: (blockId: string) => void;
  
  /** Block update handler (edit mode) */
  onUpdate?: (blockId: string, updates: Partial<Block>) => void;
  
  /** Block delete handler (edit mode) */
  onDelete?: (blockId: string) => void;
  
  /** Drag handle ref (edit mode) */
  dragHandleRef?: React.Ref<HTMLDivElement>;
  
  /** Additional class name */
  className?: string;
}

export interface BlockComponentProps<TBlock extends Block = Block> {
  block: TBlock;
  mode: BlockRenderMode;
  context?: PortalRuntimeContext;
  values?: Record<string, unknown>;
  onChange?: (fieldName: string, value: unknown) => void;
  onAction?: (action: string, data: Record<string, unknown>) => void | Promise<void>;
  themeColor?: string;
  className?: string;
}

// ============================================================================
// BLOCK COMPONENT REGISTRY
// ============================================================================

type AnyBlockComponent = React.ComponentType<any>;

// Lazy-loaded block components
const BlockComponents: Record<string, React.LazyExoticComponent<AnyBlockComponent>> = {
  // Layout blocks
  'heading': React.lazy(() => import('./blocks/HeadingBlock')),
  'paragraph': React.lazy(() => import('./blocks/ParagraphBlock')),
  'divider': React.lazy(() => import('./blocks/DividerBlock')),
  'spacer': React.lazy(() => import('./blocks/SpacerBlock')),
  'callout': React.lazy(() => import('./blocks/CalloutBlock')),
  'hero': React.lazy(() => import('./blocks/HeroBlock')),
  
  // Field blocks - delegate to FieldRenderer
  'text-field': React.lazy(() => import('./blocks/fields/TextFieldBlock')),
  'textarea-field': React.lazy(() => import('./blocks/fields/TextareaFieldBlock')),
  'email-field': React.lazy(() => import('./blocks/fields/EmailFieldBlock')),
  'phone-field': React.lazy(() => import('./blocks/fields/PhoneFieldBlock')),
  'number-field': React.lazy(() => import('./blocks/fields/NumberFieldBlock')),
  'date-field': React.lazy(() => import('./blocks/fields/DateFieldBlock')),
  'select-field': React.lazy(() => import('./blocks/fields/SelectFieldBlock')),
  'checkbox-field': React.lazy(() => import('./blocks/fields/CheckboxFieldBlock')),
  'file-field': React.lazy(() => import('./blocks/fields/FileFieldBlock')),
  
  // Container blocks
  'section': React.lazy(() => import('./blocks/SectionBlock')),
  'repeater': React.lazy(() => import('./blocks/RepeaterBlock')),
  
  // Display blocks
  'status-card': React.lazy(() => import('./blocks/StatusCardBlock')),
  'progress-bar': React.lazy(() => import('./blocks/ProgressBarBlock')),
  'message-list': React.lazy(() => import('./blocks/MessageListBlock')),
  
  // Auth blocks
  'login-form': React.lazy(() => import('./blocks/LoginFormBlock')),
  'signup-form': React.lazy(() => import('./blocks/SignupFormBlock')),
  
  // Action blocks
  'submit-button': React.lazy(() => import('./blocks/SubmitButtonBlock')),
  'save-draft-button': React.lazy(() => import('./blocks/SaveDraftButtonBlock')),
};

// Fallback component for unknown/unimplemented blocks
function UnknownBlock({ block, mode }: BlockComponentProps) {
  if (mode === 'view') return null;
  
  return (
    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center text-muted-foreground">
      <p className="text-sm">Unknown block type: <code>{block.type}</code></p>
    </div>
  );
}

// Loading fallback
function BlockLoadingFallback() {
  return (
    <div className="animate-pulse bg-muted rounded-lg h-12" />
  );
}

// ============================================================================
// EDITABLE WRAPPER
// ============================================================================

interface EditableWrapperProps {
  blockId: string;
  category: BlockCategory;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  dragHandleRef?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}

function EditableWrapper({
  blockId,
  category,
  isSelected,
  onSelect,
  onDelete,
  dragHandleRef,
  children,
}: EditableWrapperProps) {
  return (
    <div
      className={cn(
        'group relative transition-all',
        isSelected 
          ? 'ring-2 ring-primary ring-offset-2 rounded-lg' 
          : 'hover:ring-1 hover:ring-primary/20 rounded-lg'
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Drag handle */}
      <div
        ref={dragHandleRef}
        className={cn(
          'absolute -left-8 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity',
          isSelected && 'opacity-100'
        )}
      >
        <div className="p-1 rounded hover:bg-accent">
          <svg className="w-4 h-4 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="9" cy="5" r="1.5" />
            <circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="19" r="1.5" />
            <circle cx="15" cy="19" r="1.5" />
          </svg>
        </div>
      </div>
      
      {/* Delete button */}
      {isSelected && onDelete && (
        <button
          className="absolute -right-2 -top-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      
      {/* Block content */}
      <div className={cn(category === 'layout' && 'py-1')}>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN BLOCK RENDERER
// ============================================================================

export function BlockRenderer({
  block,
  mode,
  context,
  values,
  onChange,
  themeColor,
  isSelected = false,
  onSelect,
  onUpdate,
  onDelete,
  onAction,
  dragHandleRef,
  className,
}: BlockRendererProps): React.ReactElement | null {
  
  // Check visibility rules
  if (context && block.visibility) {
    const { evaluateVisibility } = require('@/types/portal-blocks');
    const isVisible = evaluateVisibility(block.visibility, context);
    if (!isVisible) return null;
  }
  
  // Get the component for this block type
  const BlockComponent = BlockComponents[block.type];
  
  // Render the block content
  const blockContent = (
    <React.Suspense fallback={<BlockLoadingFallback />}>
      {BlockComponent ? (
        <BlockComponent
          block={block}
          mode={mode}
          context={context}
          values={values}
          onChange={onChange}
          onAction={onAction}
          themeColor={themeColor}
          className={className}
        />
      ) : (
        <UnknownBlock block={block} mode={mode} />
      )}
    </React.Suspense>
  );
  
  // In edit mode, wrap with editable UI
  if (mode === 'edit' && onSelect) {
    return (
      <EditableWrapper
        blockId={block.id}
        category={block.category}
        isSelected={isSelected}
        onSelect={() => onSelect(block.id)}
        onDelete={onDelete ? () => onDelete(block.id) : undefined}
        dragHandleRef={dragHandleRef}
      >
        {blockContent}
      </EditableWrapper>
    );
  }
  
  return blockContent;
}

// ============================================================================
// PAGE RENDERER
// ============================================================================

import type { PortalPage } from '@/types/portal-blocks';

export interface PageRendererProps {
  page: PortalPage;
  mode: BlockRenderMode;
  context?: PortalRuntimeContext;
  values?: Record<string, unknown>;
  onChange?: (fieldName: string, value: unknown) => void;
  themeColor?: string;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string | null) => void;
  onUpdateBlock?: (blockId: string, updates: Partial<Block>) => void;
  onDeleteBlock?: (blockId: string) => void;
}

export function PageRenderer({
  page,
  mode,
  context,
  values,
  onChange,
  themeColor,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
}: PageRendererProps): React.ReactElement {
  return (
    <div className="space-y-4">
      {page.blocks.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          mode={mode}
          context={context}
          values={values}
          onChange={onChange}
          themeColor={themeColor}
          isSelected={selectedBlockId === block.id}
          onSelect={onSelectBlock ?? undefined}
          onUpdate={onUpdateBlock}
          onDelete={onDeleteBlock}
        />
      ))}
    </div>
  );
}

// ============================================================================
// PORTAL RENDERER
// ============================================================================

import type { PortalDocument } from '@/types/portal-blocks';

export interface PortalRendererProps {
  document: PortalDocument;
  mode: BlockRenderMode;
  context: PortalRuntimeContext;
  values?: Record<string, unknown>;
  onChange?: (fieldName: string, value: unknown) => void;
  currentPageId?: string;
  onNavigate?: (pageId: string) => void;
  // Edit mode props
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string | null) => void;
  onUpdateBlock?: (blockId: string, updates: Partial<Block>) => void;
  onDeleteBlock?: (blockId: string) => void;
}

export function PortalRenderer({
  document,
  mode,
  context,
  values,
  onChange,
  currentPageId,
  onNavigate,
  selectedBlockId,
  onSelectBlock,
  onUpdateBlock,
  onDeleteBlock,
}: PortalRendererProps): React.ReactElement | null {
  const { evaluateVisibility } = require('@/types/portal-blocks');
  
  // Find the current page (or first visible page)
  const visiblePages = document.pages.filter(page => 
    evaluateVisibility(page.visibility, context)
  );
  
  const currentPage = currentPageId 
    ? visiblePages.find(p => p.id === currentPageId)
    : visiblePages[0];
  
  if (!currentPage) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>No accessible pages</p>
      </div>
    );
  }
  
  return (
    <div 
      className="min-h-screen"
      style={{ 
        fontFamily: document.theme.fontFamily,
        '--primary-color': document.theme.primaryColor,
      } as React.CSSProperties}
    >
      {/* Navigation (if page has it enabled) */}
      {currentPage.settings?.showNavigation && visiblePages.length > 1 && (
        <nav className="border-b bg-background px-4 py-3">
          <div className="max-w-4xl mx-auto flex gap-4">
            {visiblePages.map(page => (
              <button
                key={page.id}
                onClick={() => onNavigate?.(page.id)}
                className={cn(
                  'px-3 py-1 rounded-md text-sm transition-colors',
                  currentPage.id === page.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {page.title}
              </button>
            ))}
          </div>
        </nav>
      )}
      
      {/* Page content */}
      <main className="max-w-4xl mx-auto p-6">
        <PageRenderer
          page={currentPage}
          mode={mode}
          context={context}
          values={values}
          onChange={onChange}
          themeColor={document.theme.primaryColor}
          selectedBlockId={selectedBlockId}
          onSelectBlock={onSelectBlock}
          onUpdateBlock={onUpdateBlock}
          onDeleteBlock={onDeleteBlock}
        />
      </main>
    </div>
  );
}

export default BlockRenderer;
