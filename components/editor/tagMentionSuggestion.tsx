import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { TagSuggestion, type TagSuggestionRef } from './TagSuggestion';
import { Tag } from '@/db/schema/tags';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { api } from '@/api/client';

/**
 * Suggestion configuration for tag mentions with # trigger
 */
export const tagMentionSuggestion: Omit<SuggestionOptions, 'editor'> = {
  char: '#',

  items: async ({ query }): Promise<Tag[]> => {
    try {
      const params = new URLSearchParams();
      if (query) {
        params.set('search', query);
      }

      const response = await api.tags.$get({
        query: Object.fromEntries(params.entries()),
      });
      if (!response.ok) {
        console.error('Failed to fetch tags');
        return [];
      }

      const tags: Tag[] = await response.json();
      return tags;
    } catch (error) {
      console.error('Error fetching tags:', error);
      return [];
    }
  },

  render: () => {
    let component: ReactRenderer<TagSuggestionRef> | undefined;
    let popup: TippyInstance[] | undefined;

    return {
      onStart: (props) => {
        component = new ReactRenderer(TagSuggestion, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },

      onUpdate(props) {
        component?.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }

        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit() {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
};
