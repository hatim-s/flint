import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Tag } from '@/db/schema/tags';

interface TagSuggestionProps {
  items: Tag[];
  command: (item: { id: string; label: string }) => void;
}

interface TagSuggestionRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * Tag suggestion dropdown component for TipTap Mention extension
 * Displays a list of tags that can be filtered and selected with keyboard navigation
 */
const TagSuggestion = forwardRef<TagSuggestionRef, TagSuggestionProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selected index when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [props.items]);

    const selectItem = (index: number) => {
      const item = props.items[index];
      if (item) {
        props.command({ id: item.id, label: item.name });
      }
    };

    const upHandler = () => {
      setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
    };

    const downHandler = () => {
      setSelectedIndex((selectedIndex + 1) % props.items.length);
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }

        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }

        if (event.key === 'Enter') {
          enterHandler();
          return true;
        }

        return false;
      },
    }));

    if (props.items.length === 0) {
      return (
        <div className="z-50 min-w-[200px] overflow-hidden rounded-md border border-neutral-200 bg-white p-2 shadow-md dark:border-neutral-800 dark:bg-neutral-950">
          <div className="px-2 py-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            No tags found. Type to create new tag.
          </div>
        </div>
      );
    }

    return (
      <div className="z-50 min-w-[200px] overflow-hidden rounded-md border border-neutral-200 bg-white shadow-md dark:border-neutral-800 dark:bg-neutral-950">
        <div className="max-h-[300px] overflow-y-auto p-1">
          {props.items.map((item, index) => (
            <button
              key={item.id}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${index === selectedIndex
                  ? 'bg-neutral-100 dark:bg-neutral-800'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'
                }`}
              onClick={() => selectItem(index)}
              type="button"
            >
              <span
                className="h-3 w-3 flex-shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="flex-1 truncate text-left">{item.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
);

TagSuggestion.displayName = 'TagSuggestion';

export { TagSuggestion };
export type { TagSuggestionProps, TagSuggestionRef };
