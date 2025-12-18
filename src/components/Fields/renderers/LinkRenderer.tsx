'use client';

/**
 * Link Field Renderer
 * Handles: link (links to records in other tables)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Label } from '@/ui-components/label';
import { Button } from '@/ui-components/button';
import { Badge } from '@/ui-components/badge';
import { Input } from '@/ui-components/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui-components/dialog';
import { cn } from '@/lib/utils';
import { Link2, Plus, X, Search, ExternalLink } from 'lucide-react';
import type { FieldRendererProps } from '../types';
import { FIELD_TYPES } from '@/types/field-types';

const LINK_SUBTYPES = [
  FIELD_TYPES.LINK,
  'link_to_table',
  'linked_record',
  'relation',
] as const;

interface LinkedRecord {
  id: string;
  display_value?: string;
  data?: Record<string, any>;
}

function normalizeLinkedRecords(value: any): LinkedRecord[] {
  if (!value) return [];
  
  if (Array.isArray(value)) {
    return value.map((v) => {
      if (typeof v === 'string') {
        return { id: v };
      }
      return v as LinkedRecord;
    });
  }
  
  if (typeof value === 'string') {
    return [{ id: value }];
  }
  
  if (typeof value === 'object' && value.id) {
    return [value as LinkedRecord];
  }
  
  return [];
}

function LinkedRecordBadge({
  record,
  onRemove,
  onClick,
}: {
  record: LinkedRecord;
  onRemove?: () => void;
  onClick?: () => void;
}) {
  const displayValue = record.display_value || record.id.slice(0, 8);
  
  return (
    <Badge
      variant="secondary"
      className={cn(
        'inline-flex items-center gap-1 text-xs font-normal bg-blue-50 text-blue-700 hover:bg-blue-100',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      <Link2 size={12} />
      <span className="truncate max-w-[120px]">{displayValue}</span>
      {onRemove && (
        <X
          size={12}
          className="cursor-pointer hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        />
      )}
    </Badge>
  );
}

export function LinkRenderer(props: FieldRendererProps): React.ReactElement | null {
  const {
    field,
    value,
    onChange,
    mode,
    disabled = false,
    required = false,
    config,
    error,
    className,
    workspaceId,
  } = props;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableRecords, setAvailableRecords] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const linkedRecords = normalizeLinkedRecords(value);
  const linkedTableId = field.linked_table_id || config?.linked_table_id;
  const allowMultiple = config?.multiple ?? config?.allow_multiple ?? true;

  // Fetch available records from linked table
  const fetchRecords = useCallback(async () => {
    if (!linkedTableId) return;
    
    setLoading(true);
    try {
      const { tablesGoClient } = await import('@/lib/api/tables-go-client');
      const rows = await tablesGoClient.getRowsByTable(linkedTableId);
      
      // Find display column
      const tableResponse = await tablesGoClient.getTableById(linkedTableId);
      const displayColumn = tableResponse.columns?.find((c: any) => c.is_primary) || 
                           tableResponse.columns?.[0];
      
      const records: LinkedRecord[] = (rows || []).slice(0, 50).map((row: any) => ({
        id: row.id,
        display_value: displayColumn ? row.data?.[displayColumn.name] : row.id,
        data: row.data,
      }));
      
      setAvailableRecords(records);
    } catch (err) {
      console.error('Failed to fetch linked records:', err);
    } finally {
      setLoading(false);
    }
  }, [linkedTableId]);

  useEffect(() => {
    if (isDialogOpen && linkedTableId) {
      fetchRecords();
    }
  }, [isDialogOpen, linkedTableId, fetchRecords]);

  const handleAddRecord = (record: LinkedRecord) => {
    if (allowMultiple) {
      const existing = linkedRecords.find((r) => r.id === record.id);
      if (!existing) {
        onChange?.([...linkedRecords, record]);
      }
    } else {
      onChange?.([record]);
      setIsDialogOpen(false);
    }
  };

  const handleRemoveRecord = (recordId: string) => {
    const updated = linkedRecords.filter((r) => r.id !== recordId);
    onChange?.(updated.length > 0 ? updated : null);
  };

  const filteredRecords = availableRecords.filter((r) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      r.display_value?.toLowerCase().includes(searchLower) ||
      r.id.toLowerCase().includes(searchLower)
    );
  });

  // Display mode
  if (mode === 'display' || mode === 'compact') {
    if (linkedRecords.length === 0) {
      return (
        <span className={cn('text-gray-400 text-sm', className)}>
          {mode === 'compact' ? '—' : 'No linked records'}
        </span>
      );
    }

    if (mode === 'compact') {
      return (
        <div className={cn('flex items-center gap-1', className)}>
          <Link2 size={14} className="text-blue-500" />
          <span className="text-sm">{linkedRecords.length}</span>
        </div>
      );
    }

    return (
      <div className={cn('flex flex-wrap gap-1', className)}>
        {linkedRecords.map((record) => (
          <LinkedRecordBadge key={record.id} record={record} />
        ))}
      </div>
    );
  }

  // Edit mode
  if (mode === 'edit') {
    return (
      <div className={className}>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <div className="flex flex-wrap gap-1 items-center min-h-[32px]">
            {linkedRecords.map((record) => (
              <LinkedRecordBadge
                key={record.id}
                record={record}
                onRemove={disabled ? undefined : () => handleRemoveRecord(record.id)}
              />
            ))}
            
            {!disabled && (
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                >
                  <Plus size={12} className="mr-1" />
                  Link
                </Button>
              </DialogTrigger>
            )}
          </div>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link Records</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="max-h-64 overflow-auto space-y-1">
                {loading ? (
                  <div className="text-center py-4 text-gray-500">Loading...</div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No records found</div>
                ) : (
                  filteredRecords.map((record) => {
                    const isLinked = linkedRecords.some((r) => r.id === record.id);
                    return (
                      <div
                        key={record.id}
                        className={cn(
                          'px-3 py-2 rounded cursor-pointer flex items-center justify-between',
                          isLinked ? 'bg-blue-50' : 'hover:bg-gray-50'
                        )}
                        onClick={() => !isLinked && handleAddRecord(record)}
                      >
                        <span className="text-sm">{record.display_value || record.id}</span>
                        {isLinked && <Badge variant="secondary">Linked</Badge>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Form mode
  if (mode === 'form') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label>
          {field.label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        {field.description && (
          <p className="text-sm text-gray-500">{field.description}</p>
        )}
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <div className="border rounded-md p-3 min-h-[60px]">
            {linkedRecords.length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-2">
                {linkedRecords.map((record) => (
                  <LinkedRecordBadge
                    key={record.id}
                    record={record}
                    onRemove={disabled ? undefined : () => handleRemoveRecord(record.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 mb-2">No records linked</p>
            )}
            
            {!disabled && (
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Plus size={14} className="mr-1" />
                  Link record
                </Button>
              </DialogTrigger>
            )}
          </div>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link Records</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <Input
                  placeholder="Search records..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="max-h-64 overflow-auto space-y-1">
                {loading ? (
                  <div className="text-center py-4 text-gray-500">Loading...</div>
                ) : filteredRecords.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">No records found</div>
                ) : (
                  filteredRecords.map((record) => {
                    const isLinked = linkedRecords.some((r) => r.id === record.id);
                    return (
                      <div
                        key={record.id}
                        className={cn(
                          'px-3 py-2 rounded cursor-pointer flex items-center justify-between',
                          isLinked ? 'bg-blue-50' : 'hover:bg-gray-50'
                        )}
                        onClick={() => !isLinked && handleAddRecord(record)}
                      >
                        <span className="text-sm">{record.display_value || record.id}</span>
                        {isLinked && <Badge variant="secondary">Linked</Badge>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }

  // Preview mode
  if (mode === 'preview') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-gray-500">
          {field.label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        <div className="border rounded-md p-3 bg-gray-50">
          <div className="flex items-center gap-2 text-gray-400">
            <Link2 size={16} />
            <span className="text-sm">Link to another table</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export const LINK_FIELD_TYPES = LINK_SUBTYPES;
