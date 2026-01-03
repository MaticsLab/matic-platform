/**
 * Email Signature Extension for Tiptap
 * Allows signatures to be inserted as editable blocks with remove/edit controls
 */

import { Node, mergeAttributes } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { NodeViewWrapper } from '@tiptap/react'
import { X, MoreVertical } from 'lucide-react'
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'

export interface EmailSignatureOptions {
  HTMLAttributes: Record<string, any>
  onRemove?: (node: any) => void
  onChange?: (node: any, newSignatureId: string) => void
  availableSignatures?: Array<{ id: string; name: string; content: string; is_html: boolean }>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    emailSignature: {
      insertSignature: (signature: { id: string; name: string; content: string; is_html: boolean }) => ReturnType
    }
  }
}

const EmailSignatureComponent = ({ node, deleteNode, availableSignatures, updateAttributes }: any) => {
  const [showMenu, setShowMenu] = useState(false)
  const signatureId = node.attrs.signatureId
  const signatureContent = node.attrs.content

  const handleRemove = () => {
    deleteNode()
  }

  const handleChange = (newSignatureId: string) => {
    const newSignature = availableSignatures?.find((sig: any) => sig.id === newSignatureId)
    if (newSignature) {
      updateAttributes({
        signatureId: newSignature.id,
        content: newSignature.content,
        signatureName: newSignature.name,
      })
    }
    setShowMenu(false)
  }

  return (
    <NodeViewWrapper className="email-signature-wrapper my-4" data-type="emailSignature">
      <div className="relative group border-t border-gray-200 pt-4 mt-4">
        {/* Controls - visible on hover */}
        <div className="absolute -top-2 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-md shadow-sm border border-gray-200 p-1 z-10">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
              title="Change signature"
              type="button"
            >
              <MoreVertical className="w-4 h-4 text-gray-600" />
            </button>
            {showMenu && availableSignatures && availableSignatures.length > 0 && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-md shadow-lg min-w-[200px] max-h-60 overflow-auto z-20">
                  {availableSignatures.map((sig: any) => (
                    <button
                      key={sig.id}
                      onClick={() => handleChange(sig.id)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                        sig.id === signatureId ? 'bg-blue-50 font-medium' : ''
                      }`}
                      type="button"
                    >
                      {sig.name}
                      {sig.id === signatureId && (
                        <span className="ml-2 text-xs text-gray-500">(Current)</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <button
            onClick={handleRemove}
            className="p-1 hover:bg-red-50 rounded transition-colors"
            title="Remove signature"
            type="button"
          >
            <X className="w-4 h-4 text-red-600" />
          </button>
        </div>

        {/* Signature Content */}
        <div
          className="email-signature-content"
          dangerouslySetInnerHTML={{ __html: signatureContent }}
        />
      </div>
    </NodeViewWrapper>
  )
}

export const EmailSignature = Node.create<EmailSignatureOptions>({
  name: 'emailSignature',

  addOptions() {
    return {
      HTMLAttributes: {},
      onRemove: undefined,
      onChange: undefined,
      availableSignatures: [],
    }
  },

  group: 'block',

  content: '',

  atom: true,

  addAttributes() {
    return {
      signatureId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-signature-id'),
        renderHTML: (attributes) => {
          if (!attributes.signatureId) {
            return {}
          }
          return {
            'data-signature-id': attributes.signatureId,
          }
        },
      },
      content: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-content') || element.innerHTML,
        renderHTML: (attributes) => {
          return {
            'data-content': attributes.content,
          }
        },
      },
      signatureName: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-signature-name'),
        renderHTML: (attributes) => {
          if (!attributes.signatureName) {
            return {}
          }
          return {
            'data-signature-name': attributes.signatureName,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="emailSignature"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, deleteNode, updateAttributes }: any) => {
      const dom = document.createElement('div')
      dom.setAttribute('data-type', 'emailSignature')
      dom.className = 'email-signature-wrapper'

      const root = createRoot(dom)
      root.render(
        React.createElement(EmailSignatureComponent, {
          node,
          deleteNode,
          availableSignatures: this.options.availableSignatures || [],
          updateAttributes,
        })
      )

      return {
        dom,
        contentDOM: null,
        update: (updatedNode: any) => {
          if (updatedNode.type !== this.type) {
            return false
          }
          root.render(
            React.createElement(EmailSignatureComponent, {
              node: updatedNode,
              deleteNode,
              availableSignatures: this.options.availableSignatures || [],
              updateAttributes,
            })
          )
          return true
        },
        destroy: () => {
          root.unmount()
        },
      }
    }
  },

  addCommands() {
    return {
      insertSignature:
        (signature: { id: string; name: string; content: string; is_html: boolean; content_html?: string }) =>
        ({ commands }) => {
          const signatureContent = signature.is_html 
            ? (signature.content_html || signature.content)
            : signature.content

          return commands.insertContent({
            type: this.name,
            attrs: {
              signatureId: signature.id,
              content: signatureContent,
              signatureName: signature.name,
            },
          })
        },
    }
  },
})

