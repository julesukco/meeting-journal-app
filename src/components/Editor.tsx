import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
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
import { Node as ProseMirrorNode } from 'prosemirror-model';

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

// Custom extension for image resizing
const ResizableImage = Extension.create({
  name: 'resizableImage',
  addGlobalAttributes() {
    return [
      {
        types: ['image'],
        attributes: {
          width: {
            default: null,
            parseHTML: element => element.getAttribute('width'),
            renderHTML: attributes => {
              if (!attributes.width) {
                return {};
              }
              return {
                width: attributes.width,
                style: `width: ${attributes.width}px`,
              };
            },
          },
          height: {
            default: null,
            parseHTML: element => element.getAttribute('height'),
            renderHTML: attributes => {
              if (!attributes.height) {
                return {};
              }
              return {
                height: attributes.height,
                style: `height: ${attributes.height}px`,
              };
            },
          },
        },
      },
    ];
  },
});

// Custom font size extension that extends TextStyle
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize,
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },
});

const Editor: React.FC<EditorProps> = ({ 
  meeting, 
  onUpdateMeeting,
  processCompletedItems,
}) => {
  const [editorReady, setEditorReady] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      TaskListTabIndent,
      TextStyle,
      FontSize,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full h-auto cursor-pointer',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 hover:text-blue-800 underline',
        },
      }),
      ResizableImage,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
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
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none prose-p:my-0.5 prose-headings:my-1 prose-ul:my-0.5 prose-ol:my-0.5 prose-blockquote:my-1 prose-pre:my-1 prose-table:my-1 prose-li:my-0.5 prose-headings:leading-tight prose-p:leading-tight prose-li:leading-tight',
      },
      handlePaste(view, event, slice) {
        const text = event.clipboardData?.getData('text/plain') || '';
        const html = event.clipboardData?.getData('text/html') || '';
        const files = event.clipboardData?.files;

        // Handle pasted images (leave as is)
        if (files && files.length > 0) return false;

        // Handle HTML table
        if (html && /<table[\s>]/i.test(html)) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          const table = doc.querySelector('table');
          if (table) {
            const rows = Array.from(table.querySelectorAll('tr')).map(tr =>
              Array.from(tr.querySelectorAll('th,td')).map(cell => cell.textContent || '')
            );
            if (rows.length && editor) {
              let htmlTable = '<table><tbody>';
              for (const row of rows) {
                htmlTable += '<tr>' + row.map(cell => `<td>${cell.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('') + '</tr>';
              }
              htmlTable += '</tbody></table>';
              editor.commands.insertContent(htmlTable);
              return true; // Tell TipTap we handled the paste
            }
          }
          return true;
        }

        // Handle tabular plain text (tab-separated or CSV-like)
        const isTabular = /\t/.test(text) && /\n/.test(text);
        if (isTabular) {
          const rows = text.trim().split(/\r?\n/).map(row => row.split(/\t/));
          if (rows.length && editor) {
            let htmlTable = '<table><tbody>';
            for (const row of rows) {
              htmlTable += '<tr>' + row.map(cell => `<td>${cell.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`).join('') + '</tr>';
            }
            htmlTable += '</tbody></table>';
            editor.commands.insertContent(htmlTable);
            return true;
          }
          return true;
        }
        // Let TipTap handle all other pastes
        return false;
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

  // Add keyboard shortcut for task list and font size
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
      // Font size shortcuts: Cmd/Ctrl + = for increase, Cmd/Ctrl + - for decrease
      if ((e.metaKey || e.ctrlKey) && e.key === '=' && !e.shiftKey) {
        e.preventDefault();
        increaseFontSize();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        decreaseFontSize();
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

  // Handle link clicks
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A') {
        e.preventDefault();
        const href = target.getAttribute('href');
        if (href) {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    };

    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  }, []);

  // Add image resize handlers
  useEffect(() => {
    const handleImageResize = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement;
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = img.offsetWidth;
        const startHeight = img.offsetHeight;
        const aspectRatio = startWidth / startHeight;

        const handleMouseMove = (e: MouseEvent) => {
          const deltaX = e.clientX - startX;
          const deltaY = e.clientY - startY;
          const newWidth = Math.max(50, startWidth + deltaX);
          const newHeight = newWidth / aspectRatio;

          img.style.width = `${newWidth}px`;
          img.style.height = `${newHeight}px`;
        };

        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          
          // Update the image attributes in the editor
          if (editor) {
            editor.chain().focus().updateAttributes('image', {
              width: img.offsetWidth,
              height: img.offsetHeight,
            }).run();
          }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    };

    document.addEventListener('mousedown', handleImageResize);
    return () => document.removeEventListener('mousedown', handleImageResize);
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

  // Font size change handlers
  const increaseFontSize = () => {
    if (editor) {
      const currentSize = editor.getAttributes('textStyle').fontSize;
      let newSize = '1.2em';
      if (currentSize) {
        const size = parseFloat(currentSize);
        const unit = currentSize.replace(/[\d.]/g, '');
        newSize = `${Math.min(size * 1.2, 3.0)}${unit}`;
      }
      editor.chain().focus().setMark('textStyle', { fontSize: newSize }).run();
    }
  };

  const decreaseFontSize = () => {
    if (editor) {
      const currentSize = editor.getAttributes('textStyle').fontSize;
      let newSize = '0.8em';
      if (currentSize) {
        const size = parseFloat(currentSize);
        const unit = currentSize.replace(/[\d.]/g, '');
        newSize = `${Math.max(size * 0.8, 0.5)}${unit}`;
      }
      editor.chain().focus().setMark('textStyle', { fontSize: newSize }).run();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen" ref={editorRef}>
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
              onClick={decreaseFontSize}
              active={!!editor?.getAttributes('textStyle').fontSize}
              label="Decrease Font Size"
              icon={<span className="font-size-button decrease">A-</span>}
              title="Decrease Font Size (Cmd/Ctrl + -)"
            />
            <ToolbarButton
              onClick={increaseFontSize}
              active={!!editor?.getAttributes('textStyle').fontSize}
              label="Increase Font Size"
              icon={<span className="font-size-button increase">A+</span>}
              title="Increase Font Size (Cmd/Ctrl + =)"
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