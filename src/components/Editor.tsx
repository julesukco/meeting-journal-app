import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { Meeting } from '../types';
import { marked } from 'marked';
import '../styles/editor.css';

interface EditorProps {
  meeting: Meeting | null;
  onUpdateMeeting: (meeting: Meeting) => void;
  processCompletedItems: (content: string) => string;
}

const Editor: React.FC<EditorProps> = ({ 
  meeting, 
  onUpdateMeeting,
  processCompletedItems,
}) => {
  const [editorReady, setEditorReady] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      if (meeting) {
        onUpdateMeeting({
          ...meeting,
          content: editor.getHTML(),
        });
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
    },
  });

  // Handle image upload
  const addImage = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = () => {
      if (input.files) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          if (editor) {
            editor.chain().focus().setImage({ src: reader.result as string }).run();
          }
        };
        reader.readAsDataURL(file);
      }
    };
  }, [editor]);

  useEffect(() => {
    setEditorReady(true);
  }, []);

  // Only set content when the meeting changes (not on every update)
  useEffect(() => {
    if (editor && meeting) {
      editor.commands.setContent(processCompletedItems(meeting.content));
    } else if (editor && !meeting) {
      editor.commands.setContent('');
    }
    // Only run when meeting id changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, meeting?.id]);

  // Add keyboard shortcut for task list
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Command + Shift + 9 (Mac) or Ctrl + Shift + 9 (Windows)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === '9') {
        e.preventDefault();
        if (editor) {
          if (editor.isActive('taskItem')) {
            editor.chain().focus().splitListItem('taskItem').run();
          } else {
            editor.chain().focus().toggleTaskList().run();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor]);

  // Handle paste events to capture markdown tables and images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData) {
        const text = e.clipboardData.getData('text/plain');
        const files = e.clipboardData.files;

        // Handle pasted images
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith('image/')) {
            e.preventDefault();
            const reader = new FileReader();
            reader.onload = () => {
              if (editor) {
                editor.chain().focus().setImage({ src: reader.result as string }).run();
              }
            };
            reader.readAsDataURL(file);
            return;
          }
        }

        // Handle markdown tables
        if (/^\s*\|(.|\n)*\|\s*$/m.test(text) && /\|\s*-+\s*\|/.test(text)) {
          e.preventDefault();
          // Convert markdown to HTML
          const htmlOrPromise = marked.parse(text);
          if (editor) {
            const insertHtml = (html: string) => {
              editor.commands.insertContent(html);
            };
            if (typeof htmlOrPromise === 'string') {
              insertHtml(htmlOrPromise);
            } else if (htmlOrPromise instanceof Promise) {
              htmlOrPromise.then(insertHtml);
            }
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [editor]);

  return (
    <div className="flex-1 flex flex-col h-screen">
      {meeting ? (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <EditorContent editor={editor} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-lg">
          Select a meeting to view or edit
        </div>
      )}
    </div>
  );
};

// Add display name for better debugging
Editor.displayName = 'Editor';

export { Editor };