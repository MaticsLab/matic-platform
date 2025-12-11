'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Separator } from '@/ui-components/separator';
import type { BlockComponentProps } from '../BlockRenderer';

export default function DividerBlock({ className }: BlockComponentProps) {
  return <Separator className={cn('my-4', className)} />;
}
