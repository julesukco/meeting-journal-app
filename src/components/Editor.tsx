import React, { useCallback } from 'react';
import { Meeting } from '../types';

interface EditorProps {
  meeting: Meeting | null;
  onUpdate: (meeting: Meeting) => void;
  processContent: (content: string) => string;
}

export function Editor({ meeting, onUpdate, processContent }: EditorProps) {
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!meeting) return;
      onUpdate({ ...meeting, content: e.target.value });
    },
    [meeting, onUpdate]
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!meeting) return;
      onUpdate({ ...meeting, title: e.target.value });
    },
    [meeting, onUpdate]
  );

  // When displaying the content, use processContent
  const displayContent = meeting ? processContent(meeting.content) : '';

  if (!meeting) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select or create a meeting to start taking notes
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen p-6">
      <input
        type="text"
        value={meeting.title}
        onChange={handleTitleChange}
        className="text-2xl font-bold mb-4 bg-transparent border-none focus:outline-none"
        placeholder="Meeting Title"
      />
      <textarea
        value={displayContent}
        onChange={handleContentChange}
        className="flex-1 resize-none bg-transparent border-none focus:outline-none"
        placeholder="Start taking notes... Use 'AI: ' to mark action items"
      />
    </div>
  );
}