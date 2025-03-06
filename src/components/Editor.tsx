import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css'; // Import styles
import { Meeting } from '../types';

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

  // Quill editor modules/formats
  const modules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ],
  };
  
  const formats = [
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'link'
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
          theme="snow"
          value={content}
          onChange={handleChange}
          modules={modules}
          formats={formats}
          className="h-full"
        />
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        <p>Tip: Type "AI: [task]" to create an action item</p>
      </div>
    </div>
  );
};