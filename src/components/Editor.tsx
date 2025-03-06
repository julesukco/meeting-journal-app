import React, { useState, useEffect, useCallback } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Import styles
import { Meeting } from '../types';
import ImageResize from 'quill-image-resize-module-react';

// Register the image resize module with Quill
if (typeof window !== 'undefined') {
  const Quill = ReactQuill.Quill;
  Quill.register('modules/imageResize', ImageResize);
}

interface EditorProps {
  meeting: Meeting | null;
  onUpdate: (meeting: Meeting) => void;
  processContent: (content: string) => string;
}

export const Editor: React.FC<EditorProps> = ({ 
  meeting, 
  onUpdate,
  processContent 
}) => {
  const [content, setContent] = useState('');
  const quillRef = React.useRef<ReactQuill>(null);

  useEffect(() => {
    if (meeting) {
      // Use the processed content that applies strikethrough to completed items
      const processedContent = processContent(meeting.content);
      setContent(processedContent);
    } else {
      setContent('');
    }
  }, [meeting, processContent]);

  const handleChange = (value: string) => {
    setContent(value);
    if (meeting) {
      onUpdate({
        ...meeting,
        content: value,
      });
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

  // Handle paste events to capture pasted images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            
            const file = items[i].getAsFile();
            if (file && quillRef.current) {
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
            break;
          }
        }
      }
    };

    // Add paste event listener to the document
    document.addEventListener('paste', handlePaste);
    
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  // Quill editor modules/formats
  const modules = {
    toolbar: {
      container: [
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    },
    imageResize: {
      parchment: ReactQuill.Quill.import('parchment'),
      modules: ['Resize', 'DisplaySize']
    }
  };
  
  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link', 'image'
  ];

  if (!meeting) {
    return (
      <div className="flex-1 p-6 bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Select a meeting or create a new one</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 flex flex-col">
      <div className="mb-4">
        <input
          type="text"
          value={meeting.title}
          onChange={(e) => onUpdate({ ...meeting, title: e.target.value })}
          className="w-full text-2xl font-bold border-b border-gray-300 pb-2 focus:outline-none"
        />
      </div>
      
      <div className="flex-1 overflow-auto">
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={content}
          onChange={handleChange}
          modules={modules}
          formats={formats}
          className="h-full"
        />
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>Tip: Type "AI: [task]" to create an action item. Paste images directly into the editor and resize them by dragging the handles.</p>
      </div>
    </div>
  );
};