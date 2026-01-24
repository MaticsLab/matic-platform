'use client';

import { Sheet, SheetPortal, SheetOverlay } from '@/ui-components/sheet';
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from 'lucide-react';
import { ApplicationDetail } from './ApplicationDetail';
import type { Application, Stage, ReviewersMap } from './types';

interface ApplicationDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: Application;
  stages: Stage[];
  reviewersMap: ReviewersMap;
  workspaceId: string;
  formId?: string;
  onStatusChange: (appId: string, newStatus: string) => void;
  onStartReview?: (appId: string) => void;
  onDelete?: (appId: string) => void;
  fields?: Array<{ id: string; label: string; type: string; config?: Record<string, any>; name?: string }>;
  onActivityCreated?: () => void;
}

export function ApplicationDetailSheet({
  open,
  onOpenChange,
  application,
  stages,
  reviewersMap,
  workspaceId,
  formId,
  onStatusChange,
  onStartReview,
  onDelete,
  fields = [],
  onActivityCreated
}: ApplicationDetailSheetProps) {

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal>
        {/* Custom overlay with no dark background */}
        <SheetOverlay className="bg-transparent" />
        <SheetPrimitive.Content
          ref={undefined}
          className="fixed inset-y-0 right-0 z-50 h-full w-[65vw] border-l-2 border-border bg-background shadow-2xl transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right overflow-hidden"
        >
          {/* Close button */}
          <SheetPrimitive.Close className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
          
          {/* Application Details - Full Height */}
          <div className="h-full w-full">
            <ApplicationDetail
              application={application}
              stages={stages}
              reviewersMap={reviewersMap}
              workspaceId={workspaceId}
              formId={formId}
              onClose={() => onOpenChange(false)}
              onStatusChange={onStatusChange}
              onStartReview={onStartReview}
              onDelete={onDelete}
              fields={fields}
              onActivityCreated={onActivityCreated}
            />
          </div>
        </SheetPrimitive.Content>
      </SheetPortal>
    </Sheet>
  );
}