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
import { NextTimeNotes } from './NextTimeNotes';

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
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        // Clear any existing timeout
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        
        // Debounce the update to improve performance with large content
        updateTimeoutRef.current = setTimeout(() => {
          onUpdateMeeting({
            ...meeting,
            content: editor.getHTML(),
          });
        }, 300); // 300ms debounce for typing
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

        // Handle pasted images with compression
        if (files && files.length > 0) {
          const file = files[0];
          if (file.type.startsWith('image/')) {
            // Compress pasted images
            compressImage(file).then(compressedDataUrl => {
              if (editor) {
                editor.chain().focus().setImage({ src: compressedDataUrl }).run();
              }
            }).catch(error => {
              console.error('Error compressing pasted image:', error);
              // Fallback to original if compression fails
              return false;
            });
            return true; // Tell TipTap we handled the paste
          }
          return false;
        }

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

  // Image compression utility
  const compressImage = useCallback((file: File, maxWidth = 1200, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = document.createElement('img');
      
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to compressed data URL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      
      img.src = URL.createObjectURL(file);
    });
  }, []);

  // Handle image upload with compression
  const addImage = useCallback(async () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      if (input.files && input.files[0]) {
        const file = input.files[0];
        
        try {
          // Compress the image before adding to editor
          const compressedDataUrl = await compressImage(file);
          
          if (editor) {
            editor.chain().focus().setImage({ src: compressedDataUrl }).run();
          }
        } catch (error) {
          console.error('Error compressing image:', error);
          // Fallback to original file if compression fails
          const reader = new FileReader();
          reader.onload = () => {
            if (editor) {
              editor.chain().focus().setImage({ src: reader.result as string }).run();
            }
          };
          reader.readAsDataURL(file);
        }
      }
    };
  }, [editor, compressImage]);

  useEffect(() => {
    setEditorReady(true);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Only set content when the meeting changes (not on every update)
  useEffect(() => {
    if (editor && meeting) {
      editor.commands.setContent(processCompletedItems(meeting.content));
      
      // Find the last block with actual text content and position cursor there
      const doc = editor.state.doc;
      let lastNonEmptyBlockEndPos = 1; // Default to start if no content
      
      // Traverse the document to find the last block with non-empty text content
      doc.descendants((node, pos) => {
        if (node.isBlock && node.textContent.trim().length > 0) {
          // Position at the end of this block's content
          lastNonEmptyBlockEndPos = pos + node.nodeSize - 1;
        }
        return true;
      });
      
      // Position cursor at the end of the last non-empty block
      editor.commands.setTextSelection(lastNonEmptyBlockEndPos);
      editor.commands.focus();
      
      // Scroll to make the cursor visible
      const editorElement = document.querySelector('.ProseMirror');
      if (editorElement) {
        // Use a small delay to let the selection be applied before scrolling
        setTimeout(() => {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const editorRect = editorElement.getBoundingClientRect();
            // Scroll to show the cursor with some padding
            if (rect.bottom > editorRect.bottom || rect.top < editorRect.top) {
              editorElement.scrollTop = editorElement.scrollHeight;
            }
          }
        }, 10);
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
      // Table hotkeys
      if (e.metaKey && e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      }
      if (e.metaKey && e.ctrlKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (editor?.isActive('table')) {
          editor.chain().focus().addRowAfter().run();
        }
      }
      if (e.metaKey && e.ctrlKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (editor?.isActive('table')) {
          editor.chain().focus().addColumnAfter().run();
        }
      }
      // Delete row hotkey: Cmd/Ctrl + Shift + R
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (editor?.isActive('table')) {
          // Use the exact same approach as the toolbar buttons
          setTimeout(() => {
            editor?.chain().focus().deleteRow().run();
          }, 10);
        }
      }
      // Delete column hotkey: Cmd/Ctrl + Shift + C
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (editor?.isActive('table')) {
          // Use the exact same approach as the toolbar buttons
          setTimeout(() => {
            editor?.chain().focus().deleteColumn().run();
          }, 10);
        }
      }
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
    let isResizing = false;
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleImageResize = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' && !isResizing) {
        isResizing = true;
        const img = target as HTMLImageElement;
        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = img.offsetWidth;
        const startHeight = img.offsetHeight;
        const aspectRatio = startWidth / startHeight;

        const handleMouseMove = (e: MouseEvent) => {
          // Use requestAnimationFrame for smooth performance
          requestAnimationFrame(() => {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const newWidth = Math.max(50, startWidth + deltaX);
            const newHeight = newWidth / aspectRatio;

            img.style.width = `${newWidth}px`;
            img.style.height = `${newHeight}px`;
          });
        };

        const handleMouseUp = () => {
          isResizing = false;
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          
          // Debounce the editor update to prevent performance violations
          if (resizeTimeout) {
            clearTimeout(resizeTimeout);
          }
          resizeTimeout = setTimeout(() => {
            // Update the image attributes in the editor
            if (editor) {
              editor.chain().focus().updateAttributes('image', {
                width: img.offsetWidth,
                height: img.offsetHeight,
              }).run();
            }
          }, 100);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    };

    document.addEventListener('mousedown', handleImageResize);
    return () => {
      document.removeEventListener('mousedown', handleImageResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
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

  // Handle copying next time notes to the meeting content
  const handleCopyToMeeting = useCallback((notes: string) => {
    if (meeting && editor) {
      // Append the next time notes to the end of the meeting content
      editor.chain().focus().command(({ tr, commands }) => {
        const lastPos = tr.doc.content.size;
        tr.insertText(`\n\nNext time notes:\n${notes}`, lastPos);
        return true;
      }).run();
    }
  }, [meeting, editor]);

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
            {/* Text Color Button with colored 'A' icon */}
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', margin: '0 0.25rem' }} title="Text Color">
              <span
                style={{
                  color: editor?.getAttributes('textStyle').color || '#222222',
                  fontWeight: 700,
                  fontSize: '1.2em',
                  padding: '0 4px',
                  userSelect: 'none',
                }}
              >A</span>
              <input
                type="color"
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0,
                  position: 'absolute',
                  pointerEvents: 'none',
                }}
                value={editor?.getAttributes('textStyle').color || '#222222'}
                onChange={e => editor?.chain().focus().setColor(e.target.value).run()}
                tabIndex={-1}
              />
            </label>
            <ToolbarButton
              onClick={() => editor?.chain().focus().setHorizontalRule().run()}
              label="Horizontal Rule"
              icon={<span>&mdash;</span>}
              title="Horizontal Rule"
            />
            <ToolbarButton
              onClick={addImage}
              label="Image"
              icon={<span>&#128247;</span>}
              title="Insert Image"
            />
            {/* Table controls - only show when in a table */}
            {inTable && (
              <>
                <ToolbarButton
                  onClick={() => editor?.chain().focus().addRowAfter().run()}
                  label="Add Row"
                  icon={<span>+Row</span>}
                  title="Add Row (Cmd/Ctrl + R)"
                />
                <ToolbarButton
                  onClick={() => editor?.chain().focus().addColumnAfter().run()}
                  label="Add Column"
                  icon={<span>+Col</span>}
                  title="Add Column (Cmd/Ctrl + C)"
                />
                <ToolbarButton
                  onClick={() => editor?.chain().focus().deleteRow().run()}
                  label="Delete Row"
                  icon={<span>-Row</span>}
                  title="Delete Row (Cmd/Ctrl + Shift + R)"
                />
                <ToolbarButton
                  onClick={() => editor?.chain().focus().deleteColumn().run()}
                  label="Delete Column"
                  icon={<span>-Col</span>}
                  title="Delete Column (Cmd/Ctrl + Shift + C)"
                />
              </>
            )}
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
          
          {/* Next Time Notes component */}
          <NextTimeNotes 
            meeting={meeting}
            onUpdateMeeting={onUpdateMeeting}
            onCopyToMeeting={handleCopyToMeeting}
          />
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