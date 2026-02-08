'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import Code from '@tiptap/extension-code';
import Blockquote from '@tiptap/extension-blockquote';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import CodeBlock from '@tiptap/extension-code-block';
import HardBreak from '@tiptap/extension-hard-break';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import History from '@tiptap/extension-history';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import { Markdown } from 'tiptap-markdown';
import Mention from '@tiptap/extension-mention';
import { tagMentionSuggestion } from './tagMentionSuggestion';
import { peopleMentionSuggestion } from './peopleMentionSuggestion';
import { useEffect, useRef } from 'react';

// Create separate mention extensions for tags (#) and people (@)
const TagMention = Mention.extend({ name: 'tagMention' });
const PeopleMention = Mention.extend({ name: 'peopleMention' });

interface EditorProps {
  content?: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

// Helper to extract markdown from editor
function getMarkdownFromEditor(editor: Editor | null): string {
  if (!editor) return '';
  // The tiptap-markdown extension adds getMarkdown method to the editor
  const storage = editor.storage as { markdown?: { getMarkdown: () => string } };
  return storage.markdown?.getMarkdown() ?? '';
}

function TipTapEditor({
  content = '',
  onChange,
  placeholder = 'Start writing...',
  editable = true,
  className = '',
}: EditorProps) {
  const isInitialMount = useRef(true);

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Heading.configure({
        levels: [1, 2, 3],
      }),
      Bold,
      Italic,
      Strike,
      Code.configure({
        HTMLAttributes: {
          class: 'bg-muted px-1 py-0.5 rounded text-sm font-mono',
        },
      }),
      Blockquote.configure({
        HTMLAttributes: {
          class: 'border-l-4 border-primary pl-4 italic',
        },
      }),
      BulletList.configure({
        keepMarks: true,
        keepAttributes: false,
      }),
      OrderedList.configure({
        keepMarks: true,
        keepAttributes: false,
      }),
      ListItem,
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'bg-muted rounded-md p-4 font-mono text-sm',
        },
      }),
      HardBreak,
      HorizontalRule,
      Dropcursor,
      Gapcursor,
      History,
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-4 hover:text-primary/80',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto',
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: 'not-prose pl-0',
        },
      }),
      TaskItem.configure({
        HTMLAttributes: {
          class: 'flex items-start gap-2',
        },
        nested: true,
      }),
      Highlight.configure({
        HTMLAttributes: {
          class: 'bg-yellow-200 dark:bg-yellow-800 px-1 rounded',
        },
      }),
      Typography,
      Markdown.configure({
        html: true,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: true,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      TagMention.configure({
        HTMLAttributes: {
          class: 'inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary',
        },
        suggestion: tagMentionSuggestion,
      }),
      PeopleMention.configure({
        HTMLAttributes: {
          class: 'inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-sm font-medium text-blue-600 dark:text-blue-400',
        },
        suggestion: peopleMentionSuggestion,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      const markdown = getMarkdownFromEditor(editor);
      onChange?.(markdown);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3',
      },
    },
    immediatelyRender: false,
  });

  // Update content when prop changes
  useEffect(() => {
    if (editor && !isInitialMount.current) {
      const currentMarkdown = getMarkdownFromEditor(editor);
      if (content !== currentMarkdown) {
        editor.commands.setContent(content);
      }
    }
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [content, editor]);

  // Update editable state when prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editable, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`border rounded-lg bg-background overflow-hidden ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
}

// Export helper methods for parent components to use
function getMarkdown(editor: Editor | null): string {
  return getMarkdownFromEditor(editor);
}

function setMarkdown(editor: Editor | null, markdown: string) {
  editor?.commands.setContent(markdown);
}

export {
  TipTapEditor,
  getMarkdown,
  setMarkdown,
  useEditor,
};

export type { Editor };
