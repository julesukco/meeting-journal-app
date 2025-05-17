import React, { useState, useEffect, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Import styles
import { Meeting } from '../types';
import ImageResize from 'quill-image-resize-module-react';
import { getMeetings, exportMeetings, importMeetings } from '../services/storage';
import { Delta } from 'quill';
import { marked } from 'marked';

// Register the image resize module with Quill
if (typeof window !== 'undefined') {
  const Quill = ReactQuill.Quill;
  Quill.register('modules/imageResize', ImageResize);
}

interface EditorProps {
  meeting: Meeting | null;
  onUpdateMeeting: (meeting: Meeting) => void;
  processCompletedItems: (content: string) => string;
}

export const Editor: React.FC<EditorProps> = ({ 
  meeting, 
  onUpdateMeeting,
  processCompletedItems,
}) => {
  const [content, setContent] = useState('');
  const quillRef = React.useRef<ReactQuill>(null);
  const [editorReady, setEditorReady] = useState(false);

  // Register Quill modules once when the component mounts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const Quill = ReactQuill.Quill;
      try {
        // Try to get the module - if it throws, it's not registered
        Quill.import('modules/imageResize');
      } catch {
        // Module not registered, so register it
        Quill.register('modules/imageResize', ImageResize);
      }
    }
  }, []);

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

  // Configure Quill to preserve all attributes on images
  useEffect(() => {
    if (quillRef.current) {
      const Quill = ReactQuill.Quill;
      const Image = Quill.import('formats/image');
      
      // Override the image format to preserve all attributes
      class CustomImage extends Image {
        static formats(domNode: HTMLElement) {
          // Preserve all attributes that might be set by the resize module
          const formats: Record<string, string> = {};
          if (domNode.hasAttribute('width')) {
            formats['width'] = domNode.getAttribute('width') || '';
          }
          if (domNode.hasAttribute('height')) {
            formats['height'] = domNode.getAttribute('height') || '';
          }
          if (domNode.hasAttribute('style')) {
            formats['style'] = domNode.getAttribute('style') || '';
          }
          return formats;
        }
        
        format(name: string, value: string) {
          if (name === 'width' || name === 'height' || name === 'style') {
            if (value) {
              this.domNode.setAttribute(name, value);
            } else {
              this.domNode.removeAttribute(name);
            }
          } else {
            super.format(name, value);
          }
        }
      }
      
      Quill.register(CustomImage, true);
    }
  }, [quillRef.current]);

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
    imageResize: {
      parchment: ReactQuill.Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize'],
      displaySize: true,
      // Make sure all attributes are preserved
      attributors: {
        width: 'width',
        height: 'height',
        style: 'style'
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
    'width', 'height', 'style', // Add these formats to preserve image sizing
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

  // Remove the previous useEffect for event handlers since we're handling it in onChange
  useEffect(() => {
    // Set editor as ready after component mounts
    setEditorReady(true);
  }, []);

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
              scrollingContainer="html"
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