/**
 * Novel-based Cover Editor - Real Notion-like document editor
 */

'use client'

import { EditorRoot, EditorContent, type JSONContent } from 'novel'
import { useState, useMemo } from 'react'
import { EditorInstance } from 'novel'

interface NovelCoverEditorProps {
  initialContent?: string | JSONContent
  onUpdate: (content: string) => void
  className?: string
}

export function NovelCoverEditor({
  initialContent,
  onUpdate,
  className = ''
}: NovelCoverEditorProps) {
  // Parse initial content if it's a string
  const parsedInitialContent = useMemo(() => {
    if (!initialContent) return undefined
    if (typeof initialContent === 'string') {
      try {
        return JSON.parse(initialContent) as JSONContent
      } catch {
        // If it's HTML or plain text, create a basic document structure
        return {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: initialContent }]
            }
          ]
        } as JSONContent
      }
    }
    return initialContent
  }, [initialContent])

  const handleUpdate = ({ editor }: { editor: EditorInstance }) => {
    const json = editor.getJSON()
    // Store as JSON string for flexibility
    onUpdate(JSON.stringify(json))
  }

  return (
    <div className={`w-full bg-white ${className}`}>
      <div className="max-w-[900px] mx-auto px-8 py-12">
        <EditorRoot>
          <EditorContent
            initialContent={parsedInitialContent}
            onUpdate={handleUpdate}
            className="novel-editor prose prose-lg dark:prose-invert focus:outline-none max-w-full"
            immediatelyRender={false}
          />
        </EditorRoot>
      </div>
    </div>
  )
}
