/**
 * Slash Commands Extension
 * 
 * Provides Notion-like slash command functionality for inserting blocks.
 * Triggers on "/" keystroke and shows a command palette.
 */

import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
  fieldType: string;
  category: string;
  keywords?: string[];
  defaultConfig?: Record<string, unknown>;
}

export interface SlashCommandsOptions {
  commands: SlashCommandItem[];
  onSelect: (item: SlashCommandItem) => void;
  render: () => {
    onStart: (props: SuggestionProps<SlashCommandItem>) => void;
    onUpdate: (props: SuggestionProps<SlashCommandItem>) => void;
    onKeyDown: (props: SuggestionKeyDownProps) => boolean;
    onExit: () => void;
  };
}

export const SlashCommandsPluginKey = new PluginKey('slashCommands');

export const SlashCommandsExtension = Extension.create<SlashCommandsOptions>({
  name: 'slashCommands',

  addOptions() {
    return {
      commands: [],
      onSelect: () => {},
      render: () => ({
        onStart: () => {},
        onUpdate: () => {},
        onKeyDown: () => false,
        onExit: () => {},
      }),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        pluginKey: SlashCommandsPluginKey,
        command: ({ editor, range, props }: { editor: any; range: any; props: SlashCommandItem }) => {
          // Delete the slash character and trigger the selection
          editor.chain().focus().deleteRange(range).run();
          this.options.onSelect(props);
        },
        items: ({ query }: { query: string }) => {
          const lower = query.toLowerCase();
          return this.options.commands
            .filter(
              (item) =>
                item.label.toLowerCase().includes(lower) ||
                item.description.toLowerCase().includes(lower) ||
                item.category.toLowerCase().includes(lower) ||
                item.keywords?.some((k) => k.includes(lower))
            )
            .slice(0, 10);
        },
        render: this.options.render,
      }),
    ];
  },
});

export default SlashCommandsExtension;
