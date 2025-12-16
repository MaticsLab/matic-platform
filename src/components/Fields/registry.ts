/**
 * Field Type Registry Cache
 * 
 * Caches field type definitions from the database to avoid repeated API calls.
 * This is the bridge between the database field_type_registry and frontend renderers.
 */

import { fieldTypesClient } from '@/lib/api/field-types-client';
import type { FieldTypeRegistry, FieldTypeSummary, FieldTypesByCategory } from '@/types/field-types';

// Singleton cache instance
let fieldTypeCache: Map<string, FieldTypeRegistry> | null = null;
let fieldTypesPromise: Promise<void> | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize/refresh the field type cache from the API
 */
async function initializeCache(): Promise<void> {
  try {
    const fieldTypes = await fieldTypesClient.list();
    fieldTypeCache = new Map();
    
    for (const ft of fieldTypes) {
      fieldTypeCache.set(ft.id, ft);
    }
    
    lastFetchTime = Date.now();
  } catch (error) {
    // Silently handle auth errors for public portal forms - no action needed
    // Initialize with empty cache on error - will retry on next access
    if (!fieldTypeCache) {
      fieldTypeCache = new Map();
    }
  }
}

/**
 * Ensure cache is initialized and not stale
 */
async function ensureCache(): Promise<Map<string, FieldTypeRegistry>> {
  const now = Date.now();
  const isStale = now - lastFetchTime > CACHE_TTL;
  
  if (!fieldTypeCache || isStale) {
    // Use a singleton promise to prevent multiple parallel fetches
    if (!fieldTypesPromise) {
      fieldTypesPromise = initializeCache().finally(() => {
        fieldTypesPromise = null;
      });
    }
    await fieldTypesPromise;
  }
  
  return fieldTypeCache || new Map();
}

/**
 * Get a field type by ID
 */
export async function getFieldType(typeId: string): Promise<FieldTypeRegistry | undefined> {
  const cache = await ensureCache();
  return cache.get(typeId);
}

/**
 * Get a field type synchronously (returns undefined if not cached)
 * Use this only when you know the cache is already populated
 */
export function getFieldTypeSync(typeId: string): FieldTypeRegistry | undefined {
  return fieldTypeCache?.get(typeId);
}

/**
 * Get all field types
 */
export async function getAllFieldTypes(): Promise<FieldTypeRegistry[]> {
  const cache = await ensureCache();
  return Array.from(cache.values());
}

/**
 * Get field types by category
 */
export async function getFieldTypesByCategory(): Promise<FieldTypesByCategory> {
  const allTypes = await getAllFieldTypes();
  
  const result: FieldTypesByCategory = {
    primitive: [],
    container: [],
    layout: [],
    special: [],
  };
  
  for (const ft of allTypes) {
    const summary: FieldTypeSummary = {
      id: ft.id,
      category: ft.category,
      label: ft.label || ft.display_name,
      description: ft.description,
      icon: ft.icon,
      color: ft.color,
      is_container: ft.is_container,
    };
    
    if (ft.category in result) {
      result[ft.category as keyof FieldTypesByCategory].push(summary);
    }
  }
  
  return result;
}

/**
 * Merge configuration from registry defaults and instance overrides
 */
export function mergeFieldConfig(
  registryConfig: Record<string, any> = {},
  instanceConfig: Record<string, any> = {},
  viewConfig: Record<string, any> = {}
): Record<string, any> {
  return {
    ...registryConfig,
    ...instanceConfig,
    ...viewConfig,
  };
}

/**
 * Check if a field type is a container type
 */
export async function isContainerType(typeId: string): Promise<boolean> {
  const fieldType = await getFieldType(typeId);
  return fieldType?.is_container ?? false;
}

/**
 * Preload the cache (call on app startup or route entry)
 */
export async function preloadFieldTypes(): Promise<void> {
  await ensureCache();
}

/**
 * Clear the cache (useful for testing or after schema changes)
 */
export function clearFieldTypeCache(): void {
  fieldTypeCache = null;
  lastFetchTime = 0;
}

/**
 * Get field type icon with fallback
 */
export async function getFieldTypeIcon(typeId: string): Promise<string> {
  const fieldType = await getFieldType(typeId);
  return fieldType?.icon || 'Box';
}

/**
 * Get field type color with fallback
 */
export async function getFieldTypeColor(typeId: string): Promise<string> {
  const fieldType = await getFieldType(typeId);
  return fieldType?.color || '#6B7280';
}
