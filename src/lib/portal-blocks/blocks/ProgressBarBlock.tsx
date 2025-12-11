'use client';

/**
 * Progress Bar Block
 * 
 * A visual progress indicator showing application completion
 * or workflow stage progress.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/ui-components/progress';
import type { BlockComponentProps } from '../BlockRenderer';

interface ProgressConfig {
  title?: string;
  showPercentage?: boolean;
  showSteps?: boolean;
  steps?: string[];
  color?: 'blue' | 'green' | 'purple' | 'orange';
  size?: 'small' | 'medium' | 'large';
}

interface ProgressBarBlockProps extends BlockComponentProps {
  block: BlockComponentProps['block'] & {
    type: 'progress-bar';
    category: 'display';
    config: ProgressConfig;
  };
}

export default function ProgressBarBlock({ 
  block, 
  mode, 
  context,
  className 
}: ProgressBarBlockProps) {
  const { 
    title,
    showPercentage = true,
    showSteps = false,
    steps = ['Start', 'In Progress', 'Review', 'Complete'],
    color = 'blue',
    size = 'medium',
  } = block.config;
  
  // Get progress from context or calculate from form completion
  const progress = context?.progress || 0;
  const currentStep = Math.floor((progress / 100) * steps.length);
  
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };
  
  const sizeClasses = {
    small: 'h-1',
    medium: 'h-2',
    large: 'h-3',
  };
  
  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      {(title || showPercentage) && (
        <div className="flex justify-between items-center">
          {title && <span className="text-sm font-medium text-gray-700">{title}</span>}
          {showPercentage && (
            <span className="text-sm font-semibold text-gray-900">{progress}%</span>
          )}
        </div>
      )}
      
      {/* Progress Bar */}
      <div className={cn('bg-gray-100 rounded-full overflow-hidden', sizeClasses[size])}>
        <div 
          className={cn('h-full transition-all duration-500', colorClasses[color])}
          style={{ width: `${progress}%` }}
        />
      </div>
      
      {/* Steps */}
      {showSteps && (
        <div className="flex justify-between">
          {steps.map((step, index) => (
            <div 
              key={index}
              className={cn(
                'flex flex-col items-center gap-1',
                index <= currentStep ? 'text-gray-900' : 'text-gray-400'
              )}
            >
              <div className={cn(
                'w-3 h-3 rounded-full border-2',
                index < currentStep 
                  ? cn(colorClasses[color], 'border-transparent')
                  : index === currentStep
                    ? 'border-blue-500 bg-white'
                    : 'border-gray-300 bg-white'
              )} />
              <span className="text-xs">{step}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Edit mode info */}
      {mode === 'edit' && (
        <p className="text-xs text-gray-400 text-center italic">
          Progress updates automatically based on form completion
        </p>
      )}
    </div>
  );
}
