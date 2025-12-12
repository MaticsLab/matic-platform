/**
 * Default templates for ending pages
 * Based on the user's design mockup
 */

import { EndingBlock } from '@/types/ending-blocks'

export const DEFAULT_ENDING_TEMPLATE: EndingBlock[] = [
  {
    id: 'icon-1',
    blockType: 'icon',
    props: {
      name: 'check-circle',
      color: '#3B82F6',
      size: 'xl'
    },
    metadata: { order: 0 }
  },
  {
    id: 'heading-1',
    blockType: 'heading',
    props: {
      text: 'Thank You for Your Submission!',
      level: 'h1',
      align: 'center',
      color: '#111827'
    },
    metadata: { order: 1 }
  },
  {
    id: 'paragraph-1',
    blockType: 'paragraph',
    props: {
      text: "We've received your application and will review it carefully. You'll hear from us soon via email.",
      align: 'center',
      color: '#6B7280',
      size: 'base'
    },
    metadata: { order: 2 }
  },
  {
    id: 'spacer-1',
    blockType: 'spacer',
    props: {
      height: 24
    },
    metadata: { order: 3 }
  },
  {
    id: 'button-group-1',
    blockType: 'button-group',
    props: {
      layout: 'horizontal',
      alignment: 'center',
      buttons: JSON.stringify([
        {
          text: 'View Dashboard',
          action: 'dashboard',
          variant: 'outline',
          visible: true
        },
        {
          text: 'Submit Another',
          action: 'submit-another',
          variant: 'primary',
          visible: true
        }
      ])
    },
    metadata: { order: 4 }
  },
  {
    id: 'spacer-2',
    blockType: 'spacer',
    props: {
      height: 32
    },
    metadata: { order: 5 }
  },
  {
    id: 'footer-1',
    blockType: 'footer-message',
    props: {
      text: 'A confirmation email has been sent to your inbox.',
      size: 'sm',
      color: '#9CA3AF',
      align: 'center'
    },
    metadata: { order: 6 }
  }
]
