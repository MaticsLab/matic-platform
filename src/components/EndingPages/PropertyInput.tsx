/**
 * Property Editor Component - Auto-generates UI from schema
 * Renders appropriate input type based on PropertySchema
 */

'use client'

import React from 'react'
import { PropertySchema } from '@/types/ending-blocks'
import { Input } from '@/ui-components/input'
import { Label } from '@/ui-components/label'
import { Textarea } from '@/ui-components/textarea'

interface PropertyInputProps {
  propertyKey: string
  schema: PropertySchema
  value: any
  onChange: (value: any) => void
}

export function PropertyInput({ propertyKey, schema, value, onChange }: PropertyInputProps) {
  switch (schema.type) {
    case 'string':
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{schema.label}</Label>
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder}
            className="w-full"
          />
        </div>
      )

    case 'url':
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{schema.label}</Label>
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
          <Input
            type="url"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder}
            className="w-full"
          />
        </div>
      )

    case 'number':
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{schema.label}</Label>
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
          <Input
            type="number"
            value={value || schema.default || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full"
          />
        </div>
      )

    case 'color':
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{schema.label}</Label>
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={value || schema.default || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="w-12 h-10 border border-gray-300 rounded-md cursor-pointer"
            />
            <Input
              type="text"
              value={value || schema.default || '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>
      )

    case 'select':
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{schema.label}</Label>
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
          <select
            value={value || schema.default || ''}
            onChange={(e) => {
              // Parse number if all enum values are numbers
              const isNumeric = schema.enum?.every(v => typeof v === 'number')
              onChange(isNumeric ? Number(e.target.value) : e.target.value)
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select {schema.label}</option>
            {schema.enum?.map((opt) => (
              <option key={opt} value={opt}>
                {String(opt).charAt(0).toUpperCase() + String(opt).slice(1)}
              </option>
            ))}
          </select>
        </div>
      )

    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
          />
          <Label className="text-sm font-medium cursor-pointer">{schema.label}</Label>
          {schema.description && (
            <p className="text-xs text-gray-500 ml-4">{schema.description}</p>
          )}
        </div>
      )

    case 'richtext':
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium">{schema.label}</Label>
          {schema.description && (
            <p className="text-xs text-gray-500">{schema.description}</p>
          )}
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={schema.placeholder}
            className="w-full min-h-[100px]"
          />
          <p className="text-xs text-gray-400">Supports HTML and basic markdown</p>
        </div>
      )

    default:
      return null
  }
}
