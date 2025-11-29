'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, X, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Address structure stored in the database
export interface AddressValue {
  full_address: string
  street_address?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
  country_code?: string
  latitude?: number
  longitude?: number
  place_name?: string
}

interface AddressFieldProps {
  value: AddressValue | string | null
  onChange: (value: AddressValue | null) => void
  onSave?: (value: AddressValue | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  isTableCell?: boolean
}

interface MapboxSuggestion {
  id: string
  type: string
  place_type: string[]
  text: string
  place_name: string
  center: [number, number]
  context?: Array<{
    id: string
    text: string
    short_code?: string
  }>
  properties?: {
    address?: string
  }
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_API_token

export function AddressField({ 
  value, 
  onChange, 
  onSave,
  placeholder = 'Search for an address...', 
  disabled = false,
  className,
  isTableCell = false
}: AddressFieldProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Parse the value to AddressValue
  const parsedValue: AddressValue | null = typeof value === 'string' 
    ? { full_address: value }
    : value

  // Initialize input with current value
  useEffect(() => {
    if (parsedValue?.full_address && !isOpen) {
      setInputValue(parsedValue.full_address)
    }
  }, [parsedValue?.full_address, isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
        // Reset input to saved value if user clicks away without selecting
        if (parsedValue?.full_address) {
          setInputValue(parsedValue.full_address)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [parsedValue])

  // Fetch suggestions from Mapbox
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `autocomplete=true&` +
        `types=address,place,locality,neighborhood,postcode&` +
        `limit=5`
      )
      
      if (!response.ok) throw new Error('Failed to fetch suggestions')
      
      const data = await response.json()
      setSuggestions(data.features || [])
    } catch (error) {
      console.error('Address autocomplete error:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Debounced search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setSelectedIndex(-1)
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue)
    }, 300)
  }

  // Parse address components from Mapbox response
  const parseAddressComponents = (suggestion: MapboxSuggestion): AddressValue => {
    const address: AddressValue = {
      full_address: suggestion.place_name,
      place_name: suggestion.text,
      latitude: suggestion.center[1],
      longitude: suggestion.center[0],
    }

    // Extract street address
    if (suggestion.properties?.address) {
      address.street_address = `${suggestion.properties.address} ${suggestion.text}`
    } else if (suggestion.place_type.includes('address')) {
      address.street_address = suggestion.text
    }

    // Parse context for city, state, country, postal code
    if (suggestion.context) {
      for (const ctx of suggestion.context) {
        const id = ctx.id
        if (id.startsWith('place')) {
          address.city = ctx.text
        } else if (id.startsWith('region')) {
          address.state = ctx.text
        } else if (id.startsWith('country')) {
          address.country = ctx.text
          address.country_code = ctx.short_code?.toUpperCase()
        } else if (id.startsWith('postcode')) {
          address.postal_code = ctx.text
        } else if (id.startsWith('locality')) {
          if (!address.city) address.city = ctx.text
        } else if (id.startsWith('neighborhood')) {
          // Neighborhood info - could be added if needed
        }
      }
    }

    return address
  }

  // Select a suggestion
  const handleSelectSuggestion = (suggestion: MapboxSuggestion) => {
    const addressValue = parseAddressComponents(suggestion)
    setInputValue(addressValue.full_address)
    setSuggestions([])
    setIsOpen(false)
    setSelectedIndex(-1)
    onChange(addressValue)
    onSave?.(addressValue)
  }

  // Clear the field
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setInputValue('')
    setSuggestions([])
    onChange(null)
    onSave?.(null)
    inputRef.current?.focus()
  }

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') {
        setIsOpen(false)
        if (parsedValue?.full_address) {
          setInputValue(parsedValue.full_address)
        }
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSuggestions([])
        if (parsedValue?.full_address) {
          setInputValue(parsedValue.full_address)
        }
        break
    }
  }

  // Table cell compact view
  if (isTableCell && !isOpen) {
    return (
      <div
        className={cn(
          "px-3 py-2 cursor-pointer hover:bg-blue-50 h-full flex items-center gap-2",
          className
        )}
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
      >
        {parsedValue?.full_address ? (
          <>
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="truncate text-sm">{parsedValue.full_address}</span>
          </>
        ) : (
          <span className="text-gray-400 text-sm">Add address...</span>
        )}
      </div>
    )
  }

  return (
    <div className={cn("relative", className)}>
      {/* Input */}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            "text-sm placeholder:text-gray-400",
            disabled && "bg-gray-50 cursor-not-allowed",
            isTableCell && "border-2 border-blue-500"
          )}
        />
        {/* Loading/Clear button */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          )}
          {inputValue && !isLoading && (
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              onClick={() => handleSelectSuggestion(suggestion)}
              className={cn(
                "w-full px-4 py-3 text-left flex items-start gap-3 hover:bg-gray-50 transition-colors",
                index === selectedIndex && "bg-blue-50"
              )}
            >
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {suggestion.text}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {suggestion.place_name}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && !isLoading && inputValue.length >= 3 && suggestions.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-sm text-gray-500"
        >
          No addresses found
        </div>
      )}

      {/* Show parsed address details when value is set */}
      {parsedValue && !isTableCell && parsedValue.city && (
        <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
          {parsedValue.city && (
            <span><span className="text-gray-400">City:</span> {parsedValue.city}</span>
          )}
          {parsedValue.state && (
            <span><span className="text-gray-400">State:</span> {parsedValue.state}</span>
          )}
          {parsedValue.postal_code && (
            <span><span className="text-gray-400">ZIP:</span> {parsedValue.postal_code}</span>
          )}
          {parsedValue.country && (
            <span><span className="text-gray-400">Country:</span> {parsedValue.country}</span>
          )}
        </div>
      )}
    </div>
  )
}

// Display component for read-only views
export function AddressDisplay({ value }: { value: AddressValue | string | null }) {
  if (!value) return <span className="text-gray-400">No address</span>
  
  const parsed: AddressValue = typeof value === 'string' 
    ? { full_address: value }
    : value

  return (
    <div className="flex items-center gap-2">
      <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="truncate">{parsed.full_address}</span>
    </div>
  )
}
