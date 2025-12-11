'use client';

/**
 * Status Card Block
 * 
 * Displays application status with visual indicators,
 * timeline, and optional progress bar.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui-components/card';
import { Badge } from '@/ui-components/badge';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle,
  Circle,
  FileText,
  Send,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Loader2
} from 'lucide-react';
import type { BlockComponentProps } from '../BlockRenderer';

interface StatusConfig {
  title?: string;
  showTimeline?: boolean;
  showProgress?: boolean;
  customStatuses?: Record<string, {
    label: string;
    color: string;
    icon?: string;
  }>;
}

interface StatusCardBlockProps extends BlockComponentProps {
  block: BlockComponentProps['block'] & {
    type: 'status-card';
    category: 'display';
    config: StatusConfig;
  };
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  draft: <FileText className="h-5 w-5" />,
  submitted: <Send className="h-5 w-5" />,
  in_review: <Eye className="h-5 w-5" />,
  pending: <Clock className="h-5 w-5" />,
  approved: <ThumbsUp className="h-5 w-5" />,
  rejected: <ThumbsDown className="h-5 w-5" />,
  completed: <CheckCircle2 className="h-5 w-5" />,
  error: <AlertCircle className="h-5 w-5" />,
  cancelled: <XCircle className="h-5 w-5" />,
  processing: <Loader2 className="h-5 w-5 animate-spin" />,
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  in_review: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  pending: 'bg-orange-100 text-orange-700 border-orange-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  error: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
  processing: 'bg-purple-100 text-purple-700 border-purple-200',
};

export default function StatusCardBlock({ 
  block, 
  mode, 
  context,
  className 
}: StatusCardBlockProps) {
  const { 
    title = 'Application Status',
    showTimeline = true,
    showProgress = true,
    customStatuses,
  } = block.config;
  
  // Get status from runtime context
  const status = context?.applicationStatus || 'draft';
  const statusLabel = customStatuses?.[status]?.label || status.replace(/_/g, ' ');
  const statusColorClass = STATUS_COLORS[status] || STATUS_COLORS.draft;
  const StatusIcon = STATUS_ICONS[status] || <Circle className="h-5 w-5" />;
  
  // Timeline from context with default
  const timeline: Array<{ status: string; timestamp: string; note?: string }> = context?.statusHistory || [
    { status: 'submitted', timestamp: new Date().toISOString(), note: 'Application submitted' },
  ];
  
  // Calculate progress
  const progressStages = ['draft', 'submitted', 'in_review', 'completed'];
  const currentStageIndex = progressStages.indexOf(status);
  const progressPercent = currentStageIndex >= 0 
    ? Math.round(((currentStageIndex + 1) / progressStages.length) * 100)
    : 0;
  
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className={cn('border-b', statusColorClass)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="outline" className={cn('flex items-center gap-1.5 px-3 py-1', statusColorClass)}>
            {StatusIcon}
            <span className="capitalize">{statusLabel}</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-6">
        {/* Progress Bar */}
        {showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Progress</span>
              <span className="font-medium">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              {progressStages.map((stage, i) => (
                <span 
                  key={stage}
                  className={cn(
                    'capitalize',
                    i <= currentStageIndex && 'text-blue-600 font-medium'
                  )}
                >
                  {stage.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Timeline */}
        {showTimeline && timeline.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">History</h4>
            <div className="space-y-3">
              {timeline.map((event, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      index === 0 ? 'bg-blue-500' : 'bg-gray-300'
                    )} />
                    {index < timeline.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-200" />
                    )}
                  </div>
                  <div className="flex-1 pb-3">
                    <p className="text-sm font-medium">{event.note}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(event.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Edit mode placeholder */}
        {mode === 'edit' && (
          <p className="text-xs text-gray-400 text-center italic">
            Status will be populated from application data
          </p>
        )}
      </CardContent>
    </Card>
  );
}
