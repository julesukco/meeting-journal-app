import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Import styles
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import { Meeting } from '../types';
import { getMeetings, exportMeetings, importMeetings } from '../services/storage';
import { Delta } from 'quill';
import { marked } from 'marked';

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
  const [content, setContent] = useState('');
  const quillRef = useRef<ReactQuill>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Add scroll to bottom function
  const scrollToBottom = useCallback(() => {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const editorElement = quill.root;
      if (editorElement) {
        editorElement.scrollTop = editorElement.scrollHeight;
      }
    }
  }, []);

  useEffect(() => {
    setEditorReady(true);
  }, []);

  // Handle content updates
  useEffect(() => {
    if (meeting && editorReady) {
      // Use the processed content that applies strikethrough to completed items
      const processedContent = processCompletedItems(meeting.content);
      setContent(processedContent);
    } else if (!meeting) {
      setContent('');
    }
  }, [meeting, processCompletedItems, editorReady]);

  const handleChange = (value: string) => {
    setContent(value);
    if (meeting) {
      onUpdateMeeting({
        ...meeting,
        content: value,
      });
    }
    // Always scroll to cursor position after any change
    const quill = quillRef.current?.getEditor();
    if (quill) {
      const range = quill.getSelection();
      if (range) {
        try {
          const [leaf] = quill.getLeaf(range.index);
          if (leaf && leaf.domNode && typeof leaf.domNode.scrollIntoView === 'function') {
            leaf.domNode.scrollIntoView({ behavior: 'smooth', block: 'end' });
          } else {
            // Fallback to scrolling the editor container
            const editorElement = quill.root;
            if (editorElement) {
              editorElement.scrollTop = editorElement.scrollHeight;
            }
          }
        } catch (error) {
          // If anything fails, fallback to scrolling the editor container
          const editorElement = quill.root;
          if (editorElement) {
            editorElement.scrollTop = editorElement.scrollHeight;
          }
        }
      }
    }
  };

  // Handle image upload
  const imageHandler = useCallback(() => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = () => {
      if (input.files) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          const quill = quillRef.current?.getEditor();
          if (quill) {
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'image', reader.result);
          }
        };
        reader.readAsDataURL(file);
      }
    };
  }, []);

  // Handle paste events to capture pasted images and markdown tables
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData) {
        const text = e.clipboardData.getData('text/plain');
        // Simple check for markdown table (pipe and dash lines)
        if (/^\s*\|(.|\n)*\|\s*$/m.test(text) && /\|\s*-+\s*\|/.test(text)) {
          e.preventDefault();
          // Convert markdown to HTML
          const htmlOrPromise = marked.parse(text);
          const insertHtml = (html: string) => {
            const quill = quillRef.current?.getEditor();
            if (quill) {
              const range = quill.getSelection(true);
              quill.clipboard.dangerouslyPasteHTML(range.index, html);
            }
          };
          if (typeof htmlOrPromise === 'string') {
            insertHtml(htmlOrPromise);
          } else if (htmlOrPromise instanceof Promise) {
            htmlOrPromise.then(insertHtml);
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  // Quill editor modules/formats
  const modules = {
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
        [{ 'indent': '-1' }, { 'indent': '+1' }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    clipboard: {
      matchVisual: false, // Helps with preserving styles on paste
      preserveWhitespace: true, // Preserve whitespace on paste
      preserveNewlines: true // Explicitly preserve newlines
    }
  };
  
  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'indent',
    'link', 'image',
    'white-space', // Add this to preserve whitespace
    'header', // Add header format
    'blockquote', // Add blockquote format
    'pre' // Add pre format to preserve whitespace
  ];

  const handleExport = async () => {
    try {
      const jsonString = await exportMeetings();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'meetings.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting meetings:', error);
      alert('Failed to export meetings');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          await importMeetings(content);
          alert('Meetings imported successfully');
          // Reload the current meeting if it exists
          if (meeting) {
            const meetings = await getMeetings();
            const updatedMeeting = meetings.find(m => m.id === meeting.id);
            if (updatedMeeting) {
              onUpdateMeeting(updatedMeeting);
            }
          }
        } catch (error) {
          console.error('Error importing meetings:', error);
          alert('Failed to import meetings');
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Error importing meetings:', error);
      alert('Failed to import meetings');
    }
  };

  // Add a style tag for the Quill editor font
  const editorFontStyle = {
    fontFamily: `'Inter', 'Segoe UI', 'Helvetica Neue', Arial, 'Liberation Sans', sans-serif`,
    fontSize: '1.05rem',
    lineHeight: 1.7,
    color: '#222',
  };

  return (
    <div className="flex-1 flex flex-col h-screen">
      {meeting ? (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <ReactQuill
              ref={quillRef}
              value={content}
              onChange={handleChange}
              modules={modules}
              formats={formats}
              className="h-full"
              theme="snow"
              preserveWhitespace={true}
              style={editorFontStyle}
            />
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