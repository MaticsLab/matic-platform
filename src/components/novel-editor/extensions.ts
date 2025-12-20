import {
  AIHighlight,
  CharacterCount,
  CodeBlockLowlight,
  Color,
  CustomKeymap,
  GlobalDragHandle,
  HighlightExtension,
  HorizontalRule,
  Mathematics,
  Placeholder,
  StarterKit,
  TaskItem,
  TaskList,
  TextStyle,
  TiptapImage,
  TiptapLink,
  TiptapUnderline,
  Twitter,
  UpdatedImage,
  UploadImagesPlugin,
  Youtube,
} from "novel";

import { Markdown } from "tiptap-markdown";
import { cx } from "class-variance-authority";
import { common, createLowlight } from "lowlight";

// AI Highlight extension
const aiHighlight = AIHighlight;

// Placeholder configuration
const placeholder = Placeholder.configure({
  placeholder: ({ node }: any) => {
    if (node.type.name === 'heading') {
      return `Heading ${node.attrs.level}`
    }
    return "Press '/' for commands, or just start typing..."
  },
  includeChildren: true,
});

const tiptapLink = TiptapLink.configure({
  HTMLAttributes: {
    class: cx(
      "text-blue-600 underline underline-offset-[3px] hover:text-blue-700 transition-colors cursor-pointer",
    ),
  },
});

const tiptapImage = TiptapImage.extend({
  addProseMirrorPlugins() {
    return [
      UploadImagesPlugin({
        imageClass: cx("opacity-40 rounded-lg border border-gray-200"),
      }),
    ];
  },
}).configure({
  allowBase64: true,
  HTMLAttributes: {
    class: cx("rounded-lg border border-gray-200"),
  },
});

const updatedImage = UpdatedImage.configure({
  HTMLAttributes: {
    class: cx("rounded-lg border border-gray-200"),
  },
});

const taskList = TaskList.configure({
  HTMLAttributes: {
    class: cx("not-prose pl-2 "),
  },
});

const taskItem = TaskItem.configure({
  HTMLAttributes: {
    class: cx("flex gap-2 items-start my-4"),
  },
  nested: true,
});

const horizontalRule = HorizontalRule.configure({
  HTMLAttributes: {
    class: cx("mt-4 mb-6 border-t border-gray-300"),
  },
});

const starterKit = StarterKit.configure({
  // Disable these as we use custom versions
  codeBlock: false, // Using CodeBlockLowlight instead
  bulletList: {
    HTMLAttributes: {
      class: cx("list-disc list-outside leading-3 -mt-2"),
    },
  },
  orderedList: {
    HTMLAttributes: {
      class: cx("list-decimal list-outside leading-3 -mt-2"),
    },
  },
  listItem: {
    HTMLAttributes: {
      class: cx("leading-normal -mb-2"),
    },
  },
  blockquote: {
    HTMLAttributes: {
      class: cx("border-l-4 border-gray-300 pl-4"),
    },
  },
  code: {
    HTMLAttributes: {
      class: cx("rounded-md bg-gray-200 px-1.5 py-1 font-mono font-medium"),
      spellcheck: "false",
    },
  },
  horizontalRule: false,
  dropcursor: {
    color: "#DBEAFE",
    width: 4,
  },
  gapcursor: false,
});

const codeBlockLowlight = CodeBlockLowlight.configure({
  lowlight: createLowlight(common),
});

const youtube = Youtube.configure({
  HTMLAttributes: {
    class: cx("rounded-lg border border-gray-200"),
  },
  inline: false,
});

const twitter = Twitter.configure({
  HTMLAttributes: {
    class: cx("not-prose"),
  },
  inline: false,
});

const mathematics = Mathematics.configure({
  HTMLAttributes: {
    class: cx("text-foreground rounded p-1 hover:bg-gray-100 cursor-pointer"),
  },
  katexOptions: {
    throwOnError: false,
  },
});

const characterCount = CharacterCount.configure();

// Markdown extension for serialization (used by AI features)
const markdown = Markdown.configure({
  html: true,
  transformCopiedText: true,
  transformPastedText: true,
});

export const defaultExtensions = [
  starterKit,
  placeholder,
  tiptapLink,
  updatedImage, // Using UpdatedImage instead of TiptapImage to avoid duplicate
  taskList,
  taskItem,
  horizontalRule,
  aiHighlight,
  codeBlockLowlight,
  youtube,
  twitter,
  mathematics,
  characterCount,
  TiptapUnderline,
  HighlightExtension,
  TextStyle,
  Color,
  CustomKeymap,
  GlobalDragHandle,
  markdown,
];
