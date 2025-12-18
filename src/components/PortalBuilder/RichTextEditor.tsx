'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  Bold, Italic, Underline, Strikethrough, 
  List, ListOrdered, Link, AlignLeft, AlignCenter, AlignRight,
  Type, Move, Palette
} from 'lucide-react'
import { Button } from '@/ui-components/button'
import { cn } from '@/lib/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui-components/popover'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  minHeight?: string
  autoFocus?: boolean
  margin?: { top?: number; bottom?: number; left?: number; right?: number }
  onMarginChange?: (margin: { top?: number; bottom?: number; left?: number; right?: number }) => void
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
  onBlur,
  placeholder = 'Enter text...',
  className,
  minHeight = '100px',
  autoFocus = false,
  margin = {},
  onMarginChange
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkPopover, setShowLinkPopover] = useState(false)
  const [showMarginPopover, setShowMarginPopover] = useState(false)
  const [showToolbar, setShowToolbar] = useState(false)
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 })
  const [fontSize, setFontSize] = useState('16px')
  const [textColor, setTextColor] = useState('#000000')

  // Initialize content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  // AutoFocus effect
  useEffect(() => {
    if (autoFocus && editorRef.current) {
      editorRef.current.focus()
    }
  }, [autoFocus])

  // Handle text selection
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setShowToolbar(false)
      return
    }

    const selectedText = selection.toString()
    if (!selectedText.trim() || !editorRef.current?.contains(selection.anchorNode)) {
      setShowToolbar(false)
      return
    }

    // Get selection bounding rect
    const range = selection.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    
    // Position toolbar above selection
    setToolbarPosition({
      top: rect.top + window.scrollY - 50,
      left: rect.left + rect.width / 2
    })
    setShowToolbar(true)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [handleSelectionChange])

  const execCommand = useCallback((command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    // Trigger onChange after command
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }, [onChange])

  const applyFontSize = useCallback((size: string) => {
    setFontSize(size)
    execCommand('fontSize', '7') // Use largest size, then wrap in span
    // Wrap selected text in span with custom font size
    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      const span = document.createElement('span')
      span.style.fontSize = size
      range.surroundContents(span)
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML)
      }
    }
  }, [execCommand, onChange])

  const applyTextColor = useCallback((color: string) => {
    setTextColor(color)
    execCommand('foreColor', color)
  }, [execCommand])

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
    <div className={cn("relative border rounded-lg overflow-hidden", isFocused && "ring-2 ring-blue-500 ring-offset-1", className)}>
      {/* Floating Toolbar - appears on text selection */}
      {showToolbar && (
        <div
          ref={toolbarRef}
          className="fixed z-50 animate-in fade-in slide-in-from-top-2 duration-200"
          style={{
            top: `${toolbarPosition.top}px`,
            left: `${toolbarPosition.left}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 p-1.5 flex items-center gap-1">
            {/* Font Size */}
            <Select value={fontSize} onValueChange={applyFontSize}>
              <SelectTrigger className="h-8 w-20 bg-gray-800 border-gray-700 text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'].map((size) => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="w-px h-6 bg-gray-700 mx-0.5" />

            {/* Text formatting */}
            {TOOLBAR_BUTTONS.map(({ command, icon: Icon, title }) => (
              <Button
                key={command}
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 w-8 p-0 hover:bg-gray-800",
                  isCommandActive(command) && "bg-gray-700 text-white"
                )}
                onClick={() => execCommand(command)}
                title={title}
              >
                <Icon className="w-4 h-4" />
              </Button>
            ))}

            <div className="w-px h-6 bg-gray-700 mx-0.5" />

            {/* Alignment */}
            {ALIGN_BUTTONS.map(({ command, icon: Icon, title }) => (
              <Button
                key={command}
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-gray-800"
                onClick={() => execCommand(command)}
                title={title}
              >
                <Icon className="w-4 h-4" />
              </Button>
            ))}

            <div className="w-px h-6 bg-gray-700 mx-0.5" />

            {/* Color Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-800"
                  title="Text Color"
                >
                  <Palette className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Text Color</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {['#000000', '#374151', '#6B7280', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => applyTextColor(color)}
                        className={cn(
                          "h-8 rounded border-2 transition-all",
                          textColor === color ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Link */}
            <Popover open={showLinkPopover} onOpenChange={setShowLinkPopover}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-gray-800"
                  title="Add Link"
                >
                  <Link className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3" align="start">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Link URL</Label>
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

            {/* Margin Controls */}
            {onMarginChange && (
              <>
                <div className="w-px h-6 bg-gray-700 mx-0.5" />
                <Popover open={showMarginPopover} onOpenChange={setShowMarginPopover}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-gray-800"
                      title="Adjust Margins"
                    >
                      <Move className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 p-4" align="start">
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-gray-900">Margins (px)</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">Top</Label>
                          <Input
                            type="number"
                            value={margin.top ?? 0}
                            onChange={(e) => onMarginChange?.({ ...margin, top: parseInt(e.target.value) || 0 })}
                            className="h-8"
                            min="0"
                            max="100"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">Bottom</Label>
                          <Input
                            type="number"
                            value={margin.bottom ?? 0}
                            onChange={(e) => onMarginChange?.({ ...margin, bottom: parseInt(e.target.value) || 0 })}
                            className="h-8"
                            min="0"
                            max="100"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">Left</Label>
                          <Input
                            type="number"
                            value={margin.left ?? 0}
                            onChange={(e) => onMarginChange?.({ ...margin, left: parseInt(e.target.value) || 0 })}
                            className="h-8"
                            min="0"
                            max="100"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">Right</Label>
                          <Input
                            type="number"
                            value={margin.right ?? 0}
                            onChange={(e) => onMarginChange?.({ ...margin, right: parseInt(e.target.value) || 0 })}
                            className="h-8"
                            min="0"
                            max="100"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>
      )}

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
        onBlur={() => {
          setIsFocused(false)
          onBlur?.()
        }}
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
