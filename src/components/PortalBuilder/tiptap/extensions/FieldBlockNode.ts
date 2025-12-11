/**
 * Field Block Node Extension
 * 
 * A custom Tiptap node that represents a form field block.
 * This is the core building block for the portal builder.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export interface FieldBlockAttributes {
  id: string;
  type: string;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  width: 'full' | 'half' | 'third' | 'quarter';
  options?: string[];
  config?: Record<string, unknown>;
  children?: FieldBlockAttributes[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fieldBlock: {
      /**
       * Insert a field block
       */
      insertFieldBlock: (attrs: Partial<FieldBlockAttributes>) => ReturnType;
      /**
       * Update field block attributes
       */
      updateFieldBlock: (id: string, attrs: Partial<FieldBlockAttributes>) => ReturnType;
      /**
       * Delete a field block
       */
      deleteFieldBlock: (id: string) => ReturnType;
    };
  }
}

export const FieldBlockNode = Node.create({
  name: 'fieldBlock',
  
  group: 'block',
  
  atom: true, // Treat as a single unit (non-editable content)
  
  draggable: true,
  
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => ({ 'data-id': attributes.id }),
      },
      type: {
        default: 'text',
        parseHTML: element => element.getAttribute('data-type'),
        renderHTML: attributes => ({ 'data-type': attributes.type }),
      },
      label: {
        default: '',
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => ({ 'data-label': attributes.label }),
      },
      description: {
        default: undefined,
        parseHTML: element => element.getAttribute('data-description'),
        renderHTML: attributes => attributes.description ? { 'data-description': attributes.description } : {},
      },
      placeholder: {
        default: undefined,
        parseHTML: element => element.getAttribute('data-placeholder'),
        renderHTML: attributes => attributes.placeholder ? { 'data-placeholder': attributes.placeholder } : {},
      },
      required: {
        default: false,
        parseHTML: element => element.getAttribute('data-required') === 'true',
        renderHTML: attributes => ({ 'data-required': attributes.required ? 'true' : 'false' }),
      },
      width: {
        default: 'full',
        parseHTML: element => element.getAttribute('data-width'),
        renderHTML: attributes => ({ 'data-width': attributes.width }),
      },
      options: {
        default: undefined,
        parseHTML: element => {
          const optionsStr = element.getAttribute('data-options');
          return optionsStr ? JSON.parse(optionsStr) : undefined;
        },
        renderHTML: attributes => attributes.options ? { 'data-options': JSON.stringify(attributes.options) } : {},
      },
      config: {
        default: undefined,
        parseHTML: element => {
          const configStr = element.getAttribute('data-config');
          return configStr ? JSON.parse(configStr) : undefined;
        },
        renderHTML: attributes => attributes.config ? { 'data-config': JSON.stringify(attributes.config) } : {},
      },
      children: {
        default: undefined,
        parseHTML: element => {
          const childrenStr = element.getAttribute('data-children');
          return childrenStr ? JSON.parse(childrenStr) : undefined;
        },
        renderHTML: attributes => attributes.children ? { 'data-children': JSON.stringify(attributes.children) } : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-field-block]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-field-block': '' }), 0];
  },

  addCommands() {
    return {
      insertFieldBlock: (attrs) => ({ chain, state }) => {
        const id = attrs.id || `field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        return chain()
          .insertContent({
            type: this.name,
            attrs: { ...attrs, id },
          })
          .run();
      },
      
      updateFieldBlock: (id, attrs) => ({ tr, state, dispatch }) => {
        let found = false;
        state.doc.descendants((node, pos) => {
          if (node.type.name === this.name && node.attrs.id === id) {
            if (dispatch) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs });
            }
            found = true;
            return false;
          }
          return true;
        });
        return found;
      },
      
      deleteFieldBlock: (id) => ({ tr, state, dispatch }) => {
        let found = false;
        state.doc.descendants((node, pos) => {
          if (node.type.name === this.name && node.attrs.id === id) {
            if (dispatch) {
              tr.delete(pos, pos + node.nodeSize);
            }
            found = true;
            return false;
          }
          return true;
        });
        return found;
      },
    };
  },

  addNodeView() {
    // Will be set via the extension options in the editor setup
    return this.options.nodeView || (() => ({}));
  },
});

export default FieldBlockNode;
