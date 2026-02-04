import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { PeopleSuggestion, type PeopleSuggestionRef } from './PeopleSuggestion';
import { Person } from '@/db/schema/people';
import type { SuggestionOptions } from '@tiptap/suggestion';

/**
 * Suggestion configuration for people mentions with @ trigger
 */
export const peopleMentionSuggestion: Omit<SuggestionOptions, 'editor'> = {
  char: '@',
  
  items: async ({ query }): Promise<Person[]> => {
    try {
      const params = new URLSearchParams();
      if (query) {
        params.set('search', query);
      }
      
      const response = await fetch(`/api/people?${params.toString()}`);
      if (!response.ok) {
        console.error('Failed to fetch people');
        return [];
      }
      
      const people: Person[] = await response.json();
      return people;
    } catch (error) {
      console.error('Error fetching people:', error);
      return [];
    }
  },

  render: () => {
    let component: ReactRenderer<PeopleSuggestionRef> | undefined;
    let popup: TippyInstance[] | undefined;

    return {
      onStart: (props) => {
        component = new ReactRenderer(PeopleSuggestion, {
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
