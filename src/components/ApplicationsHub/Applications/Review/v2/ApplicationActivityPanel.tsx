'use client';

import React from 'react';
import {
  X, MessageSquare, User, CheckCircle2, ArrowRight, Mail, MoreVertical,
} from 'lucide-react';
import { Button } from '@/ui-components/button';
import { ScrollArea } from '@/ui-components/scroll-area';
import { ApplicationEmailComposer } from './ApplicationEmailComposer';
import type { ComponentProps } from 'react';

export interface ActivityFeedItem {
  id: string | number;
  message: string;
  user: string;
  time: string;
}

type ComposerProps = Omit<ComponentProps<typeof ApplicationEmailComposer>, 'variant'>;

interface ApplicationActivityPanelProps {
  /** 'sidebar' replaces the details panel in sidebar/modal view mode (compact composer);
   *  'fullscreen' shows as a fixed-width right rail (full-size composer with a suggested-emails
   *  row). Chrome + composer size differ between the two, preserved here exactly as before. */
  variant: 'sidebar' | 'fullscreen';
  activities: ActivityFeedItem[];
  onClose: () => void;
  /** 'fullscreen' variant only: the original only ever showed its close (X) button when
   *  this panel was reached by explicitly toggling the Activity icon while already in
   *  fullscreen mode — not when it's showing by default (no panel toggled). Preserved
   *  exactly; unused by the 'sidebar' variant, which always shows its own close button. */
  showCloseButton?: boolean;
  composerProps: ComposerProps;
}

export function ApplicationActivityPanel({ variant, activities, onClose, showCloseButton, composerProps }: ApplicationActivityPanelProps) {
  if (variant === 'sidebar') {
    return (
      <div className="flex-1 flex flex-col overflow-hidden border-l border-gray-100">
        {/* Activity Header */}
        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Activity
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Activity Feed */}
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-2">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-2 py-1.5">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-3 w-3 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground">{activity.user}</span>
                    <span className="text-[10px] text-muted-foreground">{activity.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.message}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <ApplicationEmailComposer variant="compact" {...composerProps} />
      </div>
    );
  }

  return (
    <div className="w-96 flex flex-col overflow-hidden border-l border-gray-200">
      {/* Activity Header */}
      <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
        <div className="flex items-center gap-1">
          {showCloseButton && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">{activity.user}</span>
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{activity.message}</p>
                <div className="flex items-center gap-2">
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                    <CheckCircle2 className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors">
                    <Mail className="w-4 h-4 text-gray-400" />
                  </button>
                  <button className="p-1 hover:bg-gray-100 rounded transition-colors ml-auto">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ApplicationEmailComposer variant="full" {...composerProps} />
    </div>
  );
}
