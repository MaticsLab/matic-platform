/**
 * Novel Editor Extensions Configuration
 */

import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import TiptapUnderline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'

export const defaultExtensions = [
  StarterKit.configure({
    bulletList: {
      HTMLAttributes: {
        class: 'list-disc list-outside leading-3 -mt-2',
      },
    },
    orderedList: {
      HTMLAttributes: {
        class: 'list-decimal list-outside leading-3 -mt-2',
      },
    },
    listItem: {
      HTMLAttributes: {
        class: 'leading-normal -mb-2',
      },
    },
    blockquote: {
      HTMLAttributes: {
        class: 'border-l-4 border-gray-300 pl-4',
      },
    },
    codeBlock: {
      HTMLAttributes: {
        class: 'rounded-md bg-gray-900 text-gray-100 p-4',
      },
    },
    code: {
      HTMLAttributes: {
        class: 'rounded-md bg-gray-200 px-1.5 py-1 font-mono font-medium text-sm',
        spellcheck: 'false',
      },
    },
    horizontalRule: {
      HTMLAttributes: {
        class: 'my-4 border-t border-gray-300',
      },
    },
  }),
  Placeholder.configure({
    placeholder: ({ node }: any) => {
      if (node.type.name === 'heading') {
        return `Heading ${node.attrs.level}`
      }
      return "Press '/' for commands or just start typing..."
    },
    includeChildren: true,
  }),
  TiptapLink.configure({
    HTMLAttributes: {
      class: 'text-blue-600 underline underline-offset-4 hover:text-blue-700 cursor-pointer',
    },
  }),
  TiptapImage.configure({
    HTMLAttributes: {
      class: 'rounded-lg border border-gray-200',
    },
  }),
  TiptapUnderline,
  TextStyle,
  Color,
]
