'use client'

/**
 * Email Novel Editor - A simplified Novel editor wrapper for email composition
 * Works directly with HTML strings for email compatibility
 */

import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  type EditorInstance,
  EditorRoot,
  ImageResizer,
  handleCommandNavigation,
  handleImagePaste,
  handleImageDrop,
} from 'novel'
import { useEffect, useRef, useState } from 'react'
import { useDebouncedCallback } from 'use-debounce'
import { defaultExtensions } from '@/components/novel-editor/extensions'
import { ColorSelector } from '@/components/novel-editor/selectors/color-selector'
import { LinkSelector } from '@/components/novel-editor/selectors/link-selector'
import { NodeSelector } from '@/components/novel-editor/selectors/node-selector'
import { Separator } from '@/components/novel-editor/ui/separator'
import { TextButtons } from '@/components/novel-editor/selectors/text-buttons'
import { slashCommand, suggestionItems } from '@/components/novel-editor/slash-command'
import { uploadFn } from '@/components/novel-editor/image-upload'
import GenerativeMenuSwitch from '@/components/novel-editor/generative/generative-menu-switch'
import { MathSelector } from '@/components/novel-editor/selectors/math-selector'
import { EmailSignature } from './email-signature-extension'
import type { EmailSignature as EmailSignatureType } from '@/lib/api/email-client'

// @ts-ignore - type compatibility
const baseExtensions = [...defaultExtensions, slashCommand] as any

interface EmailNovelEditorProps {
  value: string // HTML string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
  editorRef?: React.MutableRefObject<EditorInstance | null> // Expose editor instance for external HTML insertion
  availableSignatures?: EmailSignatureType[] // Available signatures for changing
}

export function EmailNovelEditor({
  value,
  onChange,
  placeholder = 'Compose your email...',
  className = '',
  minHeight = '300px',
  editorRef: externalEditorRef,
  availableSignatures = [],
}: EmailNovelEditorProps) {
  const internalEditorRef = useRef<EditorInstance | null>(null)
  const editorRef = externalEditorRef || internalEditorRef
  const isInitializedRef = useRef(false)
  const isInternalUpdateRef = useRef(false)

  // Create extensions with EmailSignature extension
  const extensions = [
    ...baseExtensions,
    EmailSignature.configure({
      availableSignatures: availableSignatures.map(sig => ({
        id: sig.id,
        name: sig.name,
        content: sig.is_html ? (sig.content_html || sig.content) : sig.content,
        is_html: sig.is_html,
      })),
    }),
  ] as any

  // Handle editor updates - convert to HTML
  const debouncedUpdates = useDebouncedCallback(async (editor: EditorInstance) => {
    isInternalUpdateRef.current = true
    const html = editor.getHTML()
    onChange(html)
  }, 300)

  // Initialize editor with HTML content
  useEffect(() => {
    if (editorRef.current && !isInitializedRef.current) {
      if (value) {
        editorRef.current.commands.setContent(value)
      }
      isInitializedRef.current = true
    }
  }, [editorRef])

  // Update content when value changes externally (but not from user edits)
  useEffect(() => {
    if (editorRef.current && isInitializedRef.current && !isInternalUpdateRef.current) {
      const currentHTML = editorRef.current.getHTML()
      // Only update if the value is different (to avoid infinite loops)
      if (currentHTML !== value && value !== undefined) {
        editorRef.current.commands.setContent(value || '')
      }
    }
    isInternalUpdateRef.current = false
  }, [value, editorRef])

  const [openNode, setOpenNode] = useState(false)
  const [openColor, setOpenColor] = useState(false)
  const [openLink, setOpenLink] = useState(false)
  const [openAI, setOpenAI] = useState(false)

  return (
    <div className={`relative w-full h-full flex flex-col ${className}`} style={{ minHeight }}>
      <EditorRoot>
        <EditorContent
          immediatelyRender={false}
          extensions={extensions}
          className="relative w-full h-full border-gray-200 bg-white rounded-lg border flex-1"
          editorProps={{
            handleDOMEvents: {
              keydown: (_view, event) => handleCommandNavigation(event),
            },
            handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
            handleDrop: (view, event, _slice, moved) => handleImageDrop(view, event, moved, uploadFn),
            attributes: {
              class: 'prose prose-sm max-w-none focus:outline-none p-4 h-full',
              'data-placeholder': placeholder,
            },
          }}
          onUpdate={({ editor }) => {
            editorRef.current = editor
            isInitializedRef.current = true
            debouncedUpdates(editor)
          }}
          onCreate={({ editor }) => {
            editorRef.current = editor
            if (value) {
              editor.commands.setContent(value)
              isInitializedRef.current = true
            }
          }}
          slotAfter={<ImageResizer />}
        >
          <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-gray-200 bg-white px-1 py-2 shadow-md transition-all">
            <EditorCommandEmpty className="px-2 text-gray-500">No results</EditorCommandEmpty>
            <EditorCommandList>
              {suggestionItems.map((item) => (
                <EditorCommandItem
                  value={item.title}
                  onCommand={(val) => item.command?.(val)}
                  className="flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-gray-100 aria-selected:bg-gray-100"
                  key={item.title}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 bg-white">
                    {item.icon}
                  </div>
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </EditorCommandItem>
              ))}
            </EditorCommandList>
          </EditorCommand>

          <GenerativeMenuSwitch open={openAI} onOpenChange={setOpenAI}>
            <Separator orientation="vertical" />
            <NodeSelector open={openNode} onOpenChange={setOpenNode} />
            <Separator orientation="vertical" />
            <LinkSelector open={openLink} onOpenChange={setOpenLink} />
            <Separator orientation="vertical" />
            <MathSelector />
            <Separator orientation="vertical" />
            <TextButtons />
            <Separator orientation="vertical" />
            <ColorSelector open={openColor} onOpenChange={setOpenColor} />
          </GenerativeMenuSwitch>
        </EditorContent>
      </EditorRoot>
    </div>
  )
}

