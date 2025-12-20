/**
 * Novel Cover Editor - Wrapper for the cover section using the full Novel advanced editor
 */

'use client'

import { defaultEditorContent } from "./default-content"
import {
  EditorCommand,
  EditorCommandEmpty,
  EditorCommandItem,
  EditorCommandList,
  EditorContent,
  type EditorInstance,
  EditorRoot,
  ImageResizer,
  type JSONContent,
  handleCommandNavigation,
  handleImageDrop,
  handleImagePaste,
} from "novel"
import { useEffect, useState } from "react"
import { useDebouncedCallback } from "use-debounce"
import { defaultExtensions } from "./extensions"
import { ColorSelector } from "./selectors/color-selector"
import { LinkSelector } from "./selectors/link-selector"
import { MathSelector } from "./selectors/math-selector"
import { NodeSelector } from "./selectors/node-selector"
import { Separator } from "./ui/separator"

import GenerativeMenuSwitch from "./generative/generative-menu-switch"
import { uploadFn } from "./image-upload"
import { TextButtons } from "./selectors/text-buttons"
import { slashCommand, suggestionItems } from "./slash-command"

// @ts-ignore
const hljs = require("highlight.js")

// @ts-ignore - type compatibility between novel's bundled tiptap and project's tiptap
const extensions = [...defaultExtensions, slashCommand] as any

interface NovelCoverEditorProps {
  initialContent?: string | JSONContent
  onUpdate: (content: string) => void
  className?: string
}

export function NovelCoverEditor({
  initialContent: propContent,
  onUpdate,
  className = '',
}: NovelCoverEditorProps) {
  const [content, setContent] = useState<JSONContent | null>(null)
  const [saveStatus, setSaveStatus] = useState("Saved")
  const [charsCount, setCharsCount] = useState<number | undefined>()

  const [openNode, setOpenNode] = useState(false)
  const [openColor, setOpenColor] = useState(false)
  const [openLink, setOpenLink] = useState(false)
  const [openAI, setOpenAI] = useState(false)

  // Apply Codeblock Highlighting on the HTML from editor.getHTML()
  const highlightCodeblocks = (htmlContent: string) => {
    const doc = new DOMParser().parseFromString(htmlContent, "text/html")
    doc.querySelectorAll("pre code").forEach((el) => {
      // @ts-ignore
      hljs.highlightElement(el)
    })
    return new XMLSerializer().serializeToString(doc)
  }

  const debouncedUpdates = useDebouncedCallback(async (editor: EditorInstance) => {
    const json = editor.getJSON()
    setCharsCount(editor.storage.characterCount?.words?.())
    onUpdate(JSON.stringify(json))
    setSaveStatus("Saved")
  }, 500)

  // Parse initial content from props
  useEffect(() => {
    if (!propContent) {
      setContent(defaultEditorContent)
      return
    }

    if (typeof propContent === 'string') {
      try {
        setContent(JSON.parse(propContent))
      } catch {
        // If it's HTML or plain text, create a basic document structure
        setContent({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: propContent ? [{ type: 'text', text: propContent }] : []
            }
          ]
        })
      }
    } else {
      setContent(propContent)
    }
  }, [propContent])

  if (!content) return null

  return (
    <div className={`relative w-full max-w-screen-lg mx-auto ${className}`}>
      <div className="flex absolute right-5 top-5 z-10 mb-5 gap-2">
        <div className="rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-600">{saveStatus}</div>
        <div className={charsCount ? "rounded-lg bg-gray-100 px-2 py-1 text-sm text-gray-600" : "hidden"}>
          {charsCount} Words
        </div>
      </div>
      <EditorRoot>
        <EditorContent
          immediatelyRender={false}
          initialContent={content}
          extensions={extensions}
          className="relative min-h-[500px] w-full max-w-screen-lg border-gray-200 bg-white sm:rounded-lg sm:border sm:shadow-lg"
          editorProps={{
            handleDOMEvents: {
              keydown: (_view, event) => handleCommandNavigation(event),
            },
            handlePaste: (view, event) => handleImagePaste(view, event, uploadFn),
            handleDrop: (view, event, _slice, moved) => handleImageDrop(view, event, moved, uploadFn),
            attributes: {
              class:
                "prose prose-lg dark:prose-invert prose-headings:font-semibold focus:outline-none max-w-full p-8",
            },
          }}
          onUpdate={({ editor }) => {
            debouncedUpdates(editor)
            setSaveStatus("Unsaved")
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

// Also export with the old name for backward compatibility
export { NovelCoverEditor as NovelCoverEditorV2 }
export default NovelCoverEditor
