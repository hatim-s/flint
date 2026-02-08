import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Person } from '@/db/schema/people';
import { User } from 'lucide-react';

interface PeopleSuggestionProps {
  items: Person[];
  command: (item: { id: string; label: string }) => void;
}

interface PeopleSuggestionRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

/**
 * People suggestion dropdown component for TipTap Mention extension
 * Displays a list of people/contacts that can be filtered and selected with keyboard navigation
 */
const PeopleSuggestion = forwardRef<PeopleSuggestionRef, PeopleSuggestionProps>(
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
        <div className="z-50 min-w-[240px] overflow-hidden rounded-md border border-neutral-200 bg-white p-2 shadow-md dark:border-neutral-800 dark:bg-neutral-950">
          <div className="px-2 py-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            No people found. Type to create new contact.
          </div>
        </div>
      );
    }

    return (
      <div className="z-50 min-w-[240px] overflow-hidden rounded-md border border-neutral-200 bg-white shadow-md dark:border-neutral-800 dark:bg-neutral-950">
        <div className="max-h-[300px] overflow-y-auto p-1">
          {props.items.map((item, index) => (
            <button
              key={item.id}
              className={`flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none transition-colors ${index === selectedIndex
                  ? 'bg-neutral-100 dark:bg-neutral-800'
                  : 'hover:bg-neutral-50 dark:hover:bg-neutral-900'
                }`}
              onClick={() => selectItem(index)}
              type="button"
            >
              <User className="h-4 w-4 flex-shrink-0 text-neutral-500 dark:text-neutral-400" />
              <div className="flex flex-1 flex-col items-start overflow-hidden">
                <span className="w-full truncate text-left font-medium">{item.name}</span>
                {item.email && (
                  <span className="w-full truncate text-left text-xs text-neutral-500 dark:text-neutral-400">
                    {item.email}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }
);

PeopleSuggestion.displayName = 'PeopleSuggestion';

export { PeopleSuggestion };
export type { PeopleSuggestionProps, PeopleSuggestionRef };
