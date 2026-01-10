'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/ui-components/popover'
import { Input } from '@/ui-components/input'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  label?: string
  className?: string
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

// Convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255
  g /= 255
  b /= 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360
  s /= 100
  l /= 100

  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q

    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

export function ColorPicker({ value, onChange, label, className }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [hue, setHue] = useState(0)
  const [saturation, setSaturation] = useState(100)
  const [lightness, setLightness] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const [isDraggingHue, setIsDraggingHue] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)

  // Initialize from hex value when popover opens
  useEffect(() => {
    if (open && value) {
      const rgb = hexToRgb(value)
      if (rgb) {
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
        setHue(hsl.h)
        setSaturation(hsl.s)
        setLightness(hsl.l)
      }
    }
  }, [value, open])

  // Update hex when HSL changes
  const updateColor = useCallback((h: number, s: number, l: number) => {
    const rgb = hslToRgb(h, s, l)
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
    onChange(hex)
  }, [onChange])

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!gridRef.current) return
    const rect = gridRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    
    const newSaturation = x * 100
    const newLightness = (1 - y) * 100
    setSaturation(newSaturation)
    setLightness(newLightness)
    updateColor(hue, newSaturation, newLightness)
  }, [hue, updateColor])

  const handleGridDrag = useCallback((e: MouseEvent) => {
    if (!gridRef.current || !isDragging) return
    const rect = gridRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    
    const newSaturation = x * 100
    const newLightness = (1 - y) * 100
    setSaturation(newSaturation)
    setLightness(newLightness)
    updateColor(hue, newSaturation, newLightness)
  }, [hue, isDragging, updateColor])

  const handleHueClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!hueRef.current) return
    const rect = hueRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newHue = x * 360
    setHue(newHue)
    updateColor(newHue, saturation, lightness)
  }, [saturation, lightness, updateColor])

  const handleHueDrag = useCallback((e: MouseEvent) => {
    if (!hueRef.current || !isDraggingHue) return
    const rect = hueRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const newHue = x * 360
    setHue(newHue)
    updateColor(newHue, saturation, lightness)
  }, [saturation, lightness, isDraggingHue, updateColor])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleGridDrag)
      document.addEventListener('mouseup', () => setIsDragging(false))
      return () => {
        document.removeEventListener('mousemove', handleGridDrag)
      }
    }
  }, [isDragging, handleGridDrag])

  useEffect(() => {
    if (isDraggingHue) {
      document.addEventListener('mousemove', handleHueDrag)
      document.addEventListener('mouseup', () => setIsDraggingHue(false))
      return () => {
        document.removeEventListener('mousemove', handleHueDrag)
      }
    }
  }, [isDraggingHue, handleHueDrag])

  const currentColor = hslToRgb(hue, 100, 50)
  const currentColorHex = rgbToHex(currentColor.r, currentColor.g, currentColor.b)
  const selectedColor = hslToRgb(hue, saturation, lightness)
  const selectedColorHex = rgbToHex(selectedColor.r, selectedColor.g, selectedColor.b)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("flex items-center gap-3 cursor-pointer", className)}>
          <div 
            className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
            style={{ backgroundColor: value || '#3B82F6' }}
          />
          <Input 
            value={value || '#3B82F6'} 
            onChange={(e) => {
              const newValue = e.target.value
              if (/^#[0-9A-F]{6}$/i.test(newValue)) {
                onChange(newValue)
              }
            }}
            className="flex-1 font-mono text-sm"
            placeholder="#3B82F6"
            onFocus={(e) => {
              e.target.select()
            }}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-3">
          {/* Color Grid */}
          <div
            ref={gridRef}
            className="relative w-[260px] h-[260px] rounded-lg overflow-hidden cursor-crosshair border border-gray-200"
            style={{
              background: `linear-gradient(to top, black, transparent), linear-gradient(to right, white, ${currentColorHex})`
            }}
            onClick={handleGridClick}
            onMouseDown={(e) => {
              e.preventDefault()
              setIsDragging(true)
              handleGridClick(e)
            }}
          >
            {/* Selector */}
            <div
              className="absolute w-4 h-4 border-2 border-white rounded-full shadow-lg pointer-events-none z-10"
              style={{
                left: `${saturation}%`,
                top: `${100 - lightness}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>

          {/* Hue Slider */}
          <div
            ref={hueRef}
            className="relative w-[260px] h-8 rounded-lg overflow-hidden cursor-pointer border border-gray-200"
            style={{
              background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)'
            }}
            onClick={handleHueClick}
            onMouseDown={(e) => {
              e.preventDefault()
              setIsDraggingHue(true)
              handleHueClick(e)
            }}
          >
            {/* Hue Selector */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white border border-gray-300 shadow-md pointer-events-none z-10"
              style={{
                left: `${(hue / 360) * 100}%`,
                transform: 'translateX(-50%)',
              }}
            />
          </div>

          {/* Selected Color Display and Hex Input */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
              style={{ backgroundColor: selectedColorHex }}
            />
            <Input
              value={selectedColorHex.toUpperCase()}
              onChange={(e) => {
                const newValue = e.target.value
                if (/^#[0-9A-F]{6}$/i.test(newValue)) {
                  onChange(newValue)
                }
              }}
              className="flex-1 font-mono text-sm"
              placeholder="#000000"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
