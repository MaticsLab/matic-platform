'use client';

import { FIELD_TYPES } from '@/types/field-types';
import { FieldBlockBase, FieldBlockProps } from './FieldBlockBase';
import type { BlockComponentProps } from '../../BlockRenderer';

export default function CheckboxFieldBlock(props: BlockComponentProps) {
  return <FieldBlockBase {...props as FieldBlockProps} fieldTypeId={FIELD_TYPES.CHECKBOX} />;
}
