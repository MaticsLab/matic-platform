'use client';

/**
 * useFieldTypes Hook
 * 
 * React hook for accessing field types from the registry.
 * Handles caching and async loading of field type definitions.
 */

import { useState, useEffect, useCallback } from 'react';
import type { FieldTypeRegistry, FieldTypeSummary, FieldTypesByCategory } from '@/types/field-types';
import {
  getFieldType,
  getAllFieldTypes,
  getFieldTypesByCategory,
  preloadFieldTypes,
} from './registry';

interface UseFieldTypesResult {
  /** All field types */
  fieldTypes: FieldTypeRegistry[];
  /** Field types grouped by category */
  fieldTypesByCategory: FieldTypesByCategory | null;
  /** Whether field types are loading */
  loading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Get a specific field type by ID */
  getType: (typeId: string) => Promise<FieldTypeRegistry | undefined>;
  /** Refresh field types from server */
  refresh: () => Promise<void>;
}

/**
 * Hook to access field types from the registry
 */
export function useFieldTypes(): UseFieldTypesResult {
  const [fieldTypes, setFieldTypes] = useState<FieldTypeRegistry[]>([]);
  const [fieldTypesByCategory, setFieldTypesByCategory] = useState<FieldTypesByCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFieldTypes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [types, byCategory] = await Promise.all([
        getAllFieldTypes(),
        getFieldTypesByCategory(),
      ]);
      
      setFieldTypes(types);
      setFieldTypesByCategory(byCategory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load field types');
      console.error('[useFieldTypes] Error loading field types:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFieldTypes();
  }, [loadFieldTypes]);

  const getType = useCallback(async (typeId: string) => {
    return getFieldType(typeId);
  }, []);

  const refresh = useCallback(async () => {
    await loadFieldTypes();
  }, [loadFieldTypes]);

  return {
    fieldTypes,
    fieldTypesByCategory,
    loading,
    error,
    getType,
    refresh,
  };
}

/**
 * Hook to get a single field type
 */
export function useFieldType(typeId: string | undefined): {
  fieldType: FieldTypeRegistry | null;
  loading: boolean;
} {
  const [fieldType, setFieldType] = useState<FieldTypeRegistry | null>(null);
  const [loading, setLoading] = useState(!!typeId);

  useEffect(() => {
    if (!typeId) {
      setFieldType(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getFieldType(typeId)
      .then((ft) => {
        setFieldType(ft || null);
      })
      .catch((err) => {
        console.error(`[useFieldType] Error loading field type ${typeId}:`, err);
        setFieldType(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [typeId]);

  return { fieldType, loading };
}

/**
 * Preload field types on component mount
 * Use this in a top-level component to ensure field types are cached
 */
export function usePreloadFieldTypes(): void {
  useEffect(() => {
    preloadFieldTypes().catch((err) => {
      console.error('[usePreloadFieldTypes] Error preloading field types:', err);
    });
  }, []);
}
