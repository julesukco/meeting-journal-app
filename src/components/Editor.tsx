import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import CodeBlock from '@tiptap/extension-code-block';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { Meeting } from '../types';
import { marked } from 'marked';
import '../styles/editor.css';
import { Extension } from '@tiptap/core';

interface EditorProps {
  meeting: Meeting | null;
  onUpdateMeeting: (meeting: Meeting) => void;
  processCompletedItems: (content: string) => string;
}

// Minimal custom extension for task list tab/shift+tab indentation
const TaskListTabIndent = Extension.create({
  name: 'taskListTabIndent',
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.sinkListItem('taskItem'),
      'Shift-Tab': () => this.editor.commands.liftListItem('taskItem'),
    };
  },
});

const Editor: React.FC<EditorProps> = ({ 
  meeting, 
  onUpdateMeeting,
  processCompletedItems,
}) => {
  const [editorReady, setEditorReady] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskListTabIndent,
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
      // Position cursor at the end and scroll to bottom
      editor.commands.focus('end');
      const editorElement = document.querySelector('.ProseMirror');
      if (editorElement) {
        editorElement.scrollTop = editorElement.scrollHeight;
      }
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
      // Custom: Tab/Shift+Tab to indent/outdent task list items
      if (editor && editor.isActive('taskItem')) {
        if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          editor.chain().focus().sinkListItem('taskItem').run();
        } else if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          editor.chain().focus().liftListItem('taskItem').run();
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

  // Toolbar button helper
  const ToolbarButton = ({ onClick, active, label, icon, title, disabled }: {
    onClick: () => void,
    active?: boolean,
    label: string,
    icon?: React.ReactNode,
    title?: string,
    disabled?: boolean,
  }) => (
    <button
      type="button"
      className={`px-2 py-1 rounded hover:bg-gray-200 mx-1 ${active ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onMouseDown={e => { e.preventDefault(); if (!disabled) onClick(); }}
      title={title || label}
      tabIndex={-1}
      disabled={disabled}
    >
      {icon || label}
    </button>
  );

  const inTable = editor?.isActive('table');

  return (
    <div className="flex-1 flex flex-col h-screen">
      {meeting ? (
        <div className="flex-1 flex flex-col">
          {/* Sticky Toolbar Only */}
          <div className="sticky z-20 bg-white border-b border-gray-200 flex items-center px-2 py-1" style={{minHeight: 44, top: 49}}>
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBold().run()}
              active={editor?.isActive('bold')}
              label="Bold"
              icon={<b>B</b>}
              title="Bold (Cmd+B)"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              active={editor?.isActive('italic')}
              label="Italic"
              icon={<i>I</i>}
              title="Italic (Cmd+I)"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              active={editor?.isActive('underline')}
              label="Underline"
              icon={<u>U</u>}
              title="Underline (Cmd+U)"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleStrike().run()}
              active={editor?.isActive('strike')}
              label="Strikethrough"
              icon={<s>S</s>}
              title="Strikethrough"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
              active={editor?.isActive('codeBlock')}
              label="Code Block"
              icon={<span>&lt;/&gt;</span>}
              title="Code Block"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              active={editor?.isActive('bulletList')}
              label="Bullet List"
              icon={<span>&bull; List</span>}
              title="Bullet List"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              active={editor?.isActive('orderedList')}
              label="Numbered List"
              icon={<span>1. List</span>}
              title="Numbered List"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
              active={editor?.isActive('taskList')}
              label="Checkbox"
              icon={<span>&#9744;</span>}
              title="Checkbox"
            />
            <input
              type="color"
              title="Text Color"
              className="mx-1 w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
              value={editor?.getAttributes('textStyle').color || '#222222'}
              onChange={e => editor?.chain().focus().setColor(e.target.value).run()}
              style={{ verticalAlign: 'middle' }}
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              label="Horizontal Rule"
              icon={<span>&mdash;</span>}
              title="Horizontal Rule"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              label="Insert Table"
              icon={<span>&#8863;</span>}
              title="Insert Table"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().addColumnBefore().run()}
              label="Add Column Before"
              icon={<span>⫷</span>}
              title={inTable ? "Add Column Before" : "Add Column Before (Insert a table first)"}
              disabled={!inTable}
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().addColumnAfter().run()}
              label="Add Column After"
              icon={<span>⫸</span>}
              title={inTable ? "Add Column After" : "Add Column After (Insert a table first)"}
              disabled={!inTable}
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().addRowBefore().run()}
              label="Add Row Before"
              icon={<span>⇧</span>}
              title={inTable ? "Add Row Before" : "Add Row Before (Insert a table first)"}
              disabled={!inTable}
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().addRowAfter().run()}
              label="Add Row After"
              icon={<span>⇩</span>}
              title={inTable ? "Add Row After" : "Add Row After (Insert a table first)"}
              disabled={!inTable}
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().deleteTable().run()}
              label="Delete Table"
              icon={<span>&#10006;</span>}
              title={inTable ? "Delete Table" : "Delete Table (Insert a table first)"}
              disabled={!inTable}
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().deleteRow().run()}
              label="Delete Row"
              icon={<span>&#10539;</span>}
              title={inTable ? "Delete Row" : "Delete Row (Insert a table first)"}
              disabled={!inTable}
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().deleteColumn().run()}
              label="Delete Column"
              icon={<span>&#10540;</span>}
              title={inTable ? "Delete Column" : "Delete Column (Insert a table first)"}
              disabled={!inTable}
            />
            <ToolbarButton
              onClick={addImage}
              label="Image"
              icon={<span>&#128247;</span>}
              title="Insert Image"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().undo().run()}
              label="Undo"
              icon={<span>&#8630;</span>}
              title="Undo"
            />
            <ToolbarButton
              onClick={() => editor?.chain().focus().redo().run()}
              label="Redo"
              icon={<span>&#8631;</span>}
              title="Redo"
            />
          </div>
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