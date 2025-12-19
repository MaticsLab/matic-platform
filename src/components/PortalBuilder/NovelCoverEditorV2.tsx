/**
 * Novel Cover Editor V2 - Proper implementation based on steven-tey/novel
 */

'use client'

import {
  EditorRoot,
  EditorContent,
  EditorCommand,
  EditorCommandList,
  EditorCommandItem,
  EditorCommandEmpty,
  type EditorInstance,
  type JSONContent,
} from 'novel'
import { useEffect, useState } from 'react'
import { ImageResizer } from 'novel'
import { defaultExtensions } from '@/lib/novel-extensions'
import { Heading1, Heading2, Heading3, List, ListOrdered, TextQuote, Code } from 'lucide-react'

interface NovelCoverEditorV2Props {
  initialContent?: string | JSONContent
  onUpdate: (content: string) => void
  className?: string
}

// Slash command items for cover editor
const slashCommandItems = [
  {
    title: 'Heading 1',
    description: 'Big section heading',
    icon: <Heading1 className="w-4 h-4" />,
    command: ({ editor, range }: { editor: EditorInstance; range: any }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run()
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: <Heading2 className="w-4 h-4" />,
    command: ({ editor, range }: { editor: EditorInstance; range: any }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run()
    },
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: <Heading3 className="w-4 h-4" />,
    command: ({ editor, range }: { editor: EditorInstance; range: any }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run()
    },
  },
  {
    title: 'Bullet List',
    description: 'Unordered list',
    icon: <List className="w-4 h-4" />,
    command: ({ editor, range }: { editor: EditorInstance; range: any }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run()
    },
  },
  {
    title: 'Numbered List',
    description: 'Ordered list',
    icon: <ListOrdered className="w-4 h-4" />,
    command: ({ editor, range }: { editor: EditorInstance; range: any }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run()
    },
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    icon: <TextQuote className="w-4 h-4" />,
    command: ({ editor, range }: { editor: EditorInstance; range: any }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run()
    },
  },
  {
    title: 'Code',
    description: 'Code block',
    icon: <Code className="w-4 h-4" />,
    command: ({ editor, range }: { editor: EditorInstance; range: any }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run()
    },
  },
]

export function NovelCoverEditorV2({
  initialContent,
  onUpdate,
  className = ''
}: NovelCoverEditorV2Props) {
  // Parse initial content
  const [parsedContent, setParsedContent] = useState<JSONContent | null>(null)

  useEffect(() => {
    if (!initialContent) {
      setParsedContent(null)
      return
    }
    
    if (typeof initialContent === 'string') {
      try {
        setParsedContent(JSON.parse(initialContent) as JSONContent)
      } catch {
        // If it's not JSON, create a basic document
        setParsedContent({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: initialContent }]
            }
          ]
        })
      }
    } else {
      setParsedContent(initialContent)
    }
  }, [initialContent])

  const handleUpdate = (editor?: EditorInstance) => {
    if (!editor) return
    const json = editor.getJSON()
    onUpdate(JSON.stringify(json))
  }

  return (
    <div className={`w-full bg-white ${className}`}>
      <div className="max-w-[900px] mx-auto px-8 py-12">
        <EditorRoot>
          <EditorContent
            initialContent={parsedContent || undefined}
            extensions={defaultExtensions}
            className="novel-editor prose prose-lg dark:prose-invert focus:outline-none max-w-full"
            editorProps={{
              attributes: {
                class: 'prose prose-lg dark:prose-invert focus:outline-none max-w-full min-h-[400px]',
              },
            }}
            onUpdate={({ editor }) => handleUpdate(editor)}
            immediatelyRender={false}
          >
            {/* Slash Command Menu */}
            <EditorCommand className="z-50 h-auto max-h-[330px] overflow-y-auto rounded-md border border-gray-200 bg-white px-1 py-2 shadow-md">
              <EditorCommandEmpty className="px-2 text-gray-500">No results</EditorCommandEmpty>
              <EditorCommandList>
                {slashCommandItems.map((item) => (
                  <EditorCommandItem
                    key={item.title}
                    value={item.title}
                    onCommand={(val) => item.command(val)}
                    className="flex w-full items-center space-x-2 rounded-md px-2 py-1 text-left text-sm hover:bg-gray-100 aria-selected:bg-gray-100 cursor-pointer"
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
            
            {/* Image Resizer */}
            <ImageResizer />
          </EditorContent>
        </EditorRoot>
      </div>
    </div>
  )
}
