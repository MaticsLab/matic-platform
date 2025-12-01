'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  Bold, Italic, Underline, Strikethrough, 
  List, ListOrdered, Link, AlignLeft, AlignCenter, AlignRight,
  Type
} from 'lucide-react'
import { Button } from '@/ui-components/button'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui-components/popover'
import { Input } from '@/ui-components/input'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  minHeight?: string
}

const TOOLBAR_BUTTONS = [
  { command: 'bold', icon: Bold, title: 'Bold (Ctrl+B)' },
  { command: 'italic', icon: Italic, title: 'Italic (Ctrl+I)' },
  { command: 'underline', icon: Underline, title: 'Underline (Ctrl+U)' },
  { command: 'strikeThrough', icon: Strikethrough, title: 'Strikethrough' },
] as const

const LIST_BUTTONS = [
  { command: 'insertUnorderedList', icon: List, title: 'Bullet List' },
  { command: 'insertOrderedList', icon: ListOrdered, title: 'Numbered List' },
] as const

const ALIGN_BUTTONS = [
  { command: 'justifyLeft', icon: AlignLeft, title: 'Align Left' },
  { command: 'justifyCenter', icon: AlignCenter, title: 'Align Center' },
  { command: 'justifyRight', icon: AlignRight, title: 'Align Right' },
] as const

export function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Enter text...',
  className,
  minHeight = '100px'
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkPopover, setShowLinkPopover] = useState(false)

  // Initialize content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const execCommand = useCallback((command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    // Trigger onChange after command
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Handle keyboard shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          execCommand('bold')
          break
        case 'i':
          e.preventDefault()
          execCommand('italic')
          break
        case 'u':
          e.preventDefault()
          execCommand('underline')
          break
      }
    }
  }, [execCommand])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    // Get plain text and insert
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }, [])

  const handleAddLink = useCallback(() => {
    if (linkUrl.trim()) {
      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
      execCommand('createLink', url)
      setLinkUrl('')
      setShowLinkPopover(false)
    }
  }, [linkUrl, execCommand])

  const isCommandActive = (command: string) => {
    try {
      return document.queryCommandState(command)
    } catch {
      return false
    }
  }

  return (
    <div className={cn("border rounded-lg overflow-hidden", isFocused && "ring-2 ring-blue-500 ring-offset-1", className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 bg-gray-50 border-b flex-wrap">
        {/* Text formatting */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200">
          {TOOLBAR_BUTTONS.map(({ command, icon: Icon, title }) => (
            <Button
              key={command}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                isCommandActive(command) && "bg-gray-200"
              )}
              onClick={() => execCommand(command)}
              title={title}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        {/* Lists */}
        <div className="flex items-center gap-0.5 px-2 border-r border-gray-200">
          {LIST_BUTTONS.map(({ command, icon: Icon, title }) => (
            <Button
              key={command}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                isCommandActive(command) && "bg-gray-200"
              )}
              onClick={() => execCommand(command)}
              title={title}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        {/* Alignment */}
        <div className="flex items-center gap-0.5 px-2 border-r border-gray-200">
          {ALIGN_BUTTONS.map(({ command, icon: Icon, title }) => (
            <Button
              key={command}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => execCommand(command)}
              title={title}
            >
              <Icon className="w-4 h-4" />
            </Button>
          ))}
        </div>

        {/* Link */}
        <div className="flex items-center gap-0.5 px-2">
          <Popover open={showLinkPopover} onOpenChange={setShowLinkPopover}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                title="Add Link"
              >
                <Link className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-3" align="start">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Link URL</label>
                <div className="flex gap-2">
                  <Input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddLink()
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleAddLink}>Add</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        className={cn(
          "p-3 outline-none prose prose-sm max-w-none",
          "min-h-[100px]",
          "[&_a]:text-blue-600 [&_a]:underline",
          "[&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:list-decimal [&_ol]:pl-5",
          "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400"
        )}
        style={{ minHeight }}
        data-placeholder={placeholder}
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        suppressContentEditableWarning
      />
    </div>
  )
}

// Simple renderer for displaying rich text content
export function RichTextContent({ 
  content, 
  className 
}: { 
  content: string
  className?: string 
}) {
  return (
    <div 
      className={cn(
        "prose prose-sm max-w-none",
        "[&_a]:text-blue-600 [&_a]:underline",
        "[&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:list-decimal [&_ol]:pl-5",
        className
      )}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
