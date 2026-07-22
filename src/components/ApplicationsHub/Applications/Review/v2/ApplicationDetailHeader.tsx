'use client';

import React from 'react';
import { X, ChevronDown, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui-components/button';
import { Separator } from '@/ui-components/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui-components/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/ui-components/popover';

type ViewMode = 'modal' | 'fullscreen' | 'sidebar';

interface ApplicationDetailHeaderProps {
  onClose: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export function ApplicationDetailHeader({ onClose, viewMode, setViewMode }: ApplicationDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Separator orientation="vertical" className="h-4" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
              <Maximize2 className="h-3.5 w-3.5" />
              <span className="capitalize">{viewMode === 'fullscreen' ? 'Full screen' : viewMode}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="start">
            <div className="space-y-1">
              <button
                onClick={() => setViewMode('sidebar')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors text-left",
                  viewMode === 'sidebar' && "bg-purple-50 text-purple-700"
                )}
              >
                <div className="w-8 h-6 border border-gray-300 rounded flex gap-0.5 p-0.5">
                  <div className="flex-1 bg-gray-100 rounded"></div>
                  <div className="w-2 bg-gray-200 rounded"></div>
                </div>
                <span className={cn("text-sm", viewMode === 'sidebar' && "text-purple-700 font-medium")}>Sidebar</span>
              </button>
              <button
                onClick={() => setViewMode('modal')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors text-left",
                  viewMode === 'modal' && "bg-purple-50 text-purple-700"
                )}
              >
                <div className="w-8 h-6 border border-gray-300 rounded flex items-center justify-center bg-white">
                  <div className="w-4 h-3 border border-gray-200 rounded"></div>
                </div>
                <span className={cn("text-sm", viewMode === 'modal' && "text-purple-700 font-medium")}>Modal</span>
              </button>
              <button
                onClick={() => setViewMode('fullscreen')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors text-left",
                  viewMode === 'fullscreen' && "bg-purple-50 text-purple-700"
                )}
              >
                <div className="w-8 h-6 border-2 border-gray-400 rounded bg-gray-50"></div>
                <span className={cn("text-sm", viewMode === 'fullscreen' && "text-purple-700 font-medium")}>Full screen</span>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
