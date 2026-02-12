'use client';

import { useState } from 'react';
import {
  LayoutGrid,
  LayoutList,
  Calendar,
  Kanban,
  Search,
  Filter,
  Download,
  SortAsc,
  SortDesc,
  Eye,
  Settings2,
  Plus
} from 'lucide-react';
import { Button } from '@/ui-components/button';
import { Input } from '@/ui-components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui-components/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui-components/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/ui-components/popover';
import { Badge } from '@/ui-components/badge';
import { Separator } from '@/ui-components/separator';
import { ViewType, FormField, FilterConfig } from './types';
import { cn } from '@/lib/utils';

interface ViewToolbarProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  onSearch: (query: string) => void;
  searchQuery: string;
  fields: FormField[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange: (field: string, direction: 'asc' | 'desc') => void;
  hiddenFields: Set<string>;
  onToggleField: (field: string) => void;
  filters: FilterConfig[];
  onFiltersChange: (filters: FilterConfig[]) => void;
  onExport?: () => void;
  selectedCount?: number;
}

const VIEW_ICONS: Record<ViewType, any> = {
  grid: LayoutList,
  kanban: Kanban,
  calendar: Calendar,
  gallery: LayoutGrid,
};

const VIEW_LABELS: Record<ViewType, string> = {
  grid: 'Grid',
  kanban: 'Kanban',
  calendar: 'Calendar',
  gallery: 'Gallery',
};

export function ViewToolbar({
  currentView,
  onViewChange,
  onSearch,
  searchQuery,
  fields,
  sortBy,
  sortDirection = 'desc',
  onSortChange,
  hiddenFields,
  onToggleField,
  filters,
  onFiltersChange,
  onExport,
  selectedCount = 0,
}: ViewToolbarProps) {
  const [showSearch, setShowSearch] = useState(false);

  const visibleFields = fields.filter(f => !hiddenFields.has(f.field_key));

  return (
    <div className="flex items-center gap-2 p-4 border-b bg-white">
      {/* View Switcher */}
      <div className="flex items-center gap-1 border rounded-lg p-1">
        {Object.entries(VIEW_ICONS).map(([view, Icon]) => (
          <Button
            key={view}
            variant={currentView === view ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => onViewChange(view as ViewType)}
            className={cn(
              'gap-2',
              currentView === view && 'bg-primary/10 text-primary'
            )}
            title={VIEW_LABELS[view as ViewType]}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{VIEW_LABELS[view as ViewType]}</span>
          </Button>
        ))}
      </div>

      <Separator orientation="vertical" className="h-8" />

      {/* Search */}
      <div className="flex-1 max-w-md">
        {showSearch || searchQuery ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search submissions..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearch(true)}
            className="gap-2"
          >
            <Search className="w-4 h-4" />
            Search
          </Button>
        )}
      </div>

      {/* Sort */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            {sortDirection === 'asc' ? (
              <SortAsc className="w-4 h-4" />
            ) : (
              <SortDesc className="w-4 h-4" />
            )}
            Sort
            {sortBy && (
              <Badge variant="secondary" className="ml-1">
                {fields.find(f => f.field_key === sortBy)?.label || sortBy}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Sort by</label>
              <Select
                value={sortBy}
                onValueChange={(field) => onSortChange(field, sortDirection)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select field" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submittedDate">Submitted Date</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  {visibleFields.map((field) => (
                    <SelectItem key={field.field_key} value={field.field_key}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant={sortDirection === 'asc' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => sortBy && onSortChange(sortBy, 'asc')}
              >
                <SortAsc className="w-4 h-4 mr-2" />
                Ascending
              </Button>
              <Button
                variant={sortDirection === 'desc' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => sortBy && onSortChange(sortBy, 'desc')}
              >
                <SortDesc className="w-4 h-4 mr-2" />
                Descending
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Filter */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filter
            {filters.length > 0 && (
              <Badge variant="secondary">{filters.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Filters</label>
              {filters.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFiltersChange([])}
                >
                  Clear all
                </Button>
              )}
            </div>
            {filters.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No filters applied
              </p>
            ) : (
              <div className="space-y-2">
                {filters.map((filter, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 border rounded"
                  >
                    <span className="text-sm flex-1">
                      {fields.find(f => f.field_key === filter.field)?.label || filter.field}{' '}
                      <span className="text-gray-500">{filter.operator}</span>{' '}
                      {filter.value}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newFilters = [...filters];
                        newFilters.splice(index, 1);
                        onFiltersChange(newFilters);
                      }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Plus className="w-4 h-4" />
              Add filter
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Field Visibility */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Eye className="w-4 h-4" />
            Fields
            <Badge variant="secondary">
              {visibleFields.length}/{fields.length}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Visible Fields</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-64 overflow-y-auto">
            {fields.map((field) => (
              <DropdownMenuCheckboxItem
                key={field.field_key}
                checked={!hiddenFields.has(field.field_key)}
                onCheckedChange={() => onToggleField(field.field_key)}
              >
                {field.label}
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Export */}
      {onExport && (
        <>
          <Separator orientation="vertical" className="h-8" />
          <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </>
      )}

      {/* Selection Count */}
      {selectedCount > 0 && (
        <>
          <Separator orientation="vertical" className="h-8" />
          <Badge variant="secondary" className="gap-2">
            {selectedCount} selected
          </Badge>
        </>
      )}
    </div>
  );
}
