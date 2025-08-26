import React, { useState, useEffect, useRef } from 'react';
import { Meeting } from '../types';
import { Copy, ChevronUp } from 'lucide-react';

interface NextTimeNotesProps {
  meeting: Meeting | null;
  onUpdateMeeting: (meeting: Meeting) => void;
  onCopyToMeeting: (notes: string) => void;
}

export const NextTimeNotes: React.FC<NextTimeNotesProps> = ({ 
  meeting, 
  onUpdateMeeting,
  onCopyToMeeting
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize notes from meeting
  useEffect(() => {
    if (meeting) {
      setNotes(meeting.nextTimeNotes || '');
    } else {
      setNotes('');
    }
  }, [meeting?.id]);

  // Handle saving notes with debounce
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newNotes = e.target.value;
    setNotes(newNotes);
    
    if (meeting) {
      // Clear any existing timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      
      // Set a new timeout to save after 500ms of inactivity
      updateTimeoutRef.current = setTimeout(() => {
        onUpdateMeeting({
          ...meeting,
          nextTimeNotes: newNotes,
          updatedAt: Date.now()
        });
      }, 500);
    }
  };

  // Handle copy to meeting and clear
  const handleCopyAndClear = () => {
    if (meeting && notes.trim()) {
      onCopyToMeeting(notes);
      setNotes('');
      onUpdateMeeting({
        ...meeting,
        nextTimeNotes: '',
        updatedAt: Date.now()
      });
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [notes]);

  if (!meeting) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="fixed bottom-0 bg-white border-t border-gray-300 shadow-lg transition-all duration-300 ease-in-out"
      style={{ 
        height: isExpanded ? 'auto' : '32px',
        maxHeight: '60%', // Increased from 40% to 60%
        zIndex: 50,
        opacity: isExpanded ? 1 : 0.95,
        left: isExpanded ? 'calc(50% - 250px)' : 'calc(50% - 150px)', // Narrower when expanded (500px width)
        right: isExpanded ? 'calc(50% - 250px)' : 'calc(50% - 150px)', // Narrower when expanded (500px width)
        transform: isExpanded ? 'translateY(0)' : 'translateY(calc(100% - 32px))',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
        boxShadow: isExpanded ? '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -1px rgba(0, 0, 0, 0.06)' : '0 -2px 4px -1px rgba(0, 0, 0, 0.06)'
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div 
        className={`flex items-center justify-between px-4 py-1 cursor-pointer transition-all duration-300 ${
          notes.trim() 
            ? 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700' 
            : 'bg-gray-200 hover:bg-gray-300'
        } ${
          isExpanded ? 'border-b border-gray-200' : 'rounded-t-xl'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <ChevronUp 
            className={`w-4 h-4 mr-2 transition-transform duration-300 ${
              notes.trim() ? 'text-white' : 'text-gray-600'
            } ${
              isExpanded ? 'transform rotate-180' : ''
            }`} 
          />
          <span className={`font-medium text-sm ${notes.trim() ? 'text-white' : 'text-gray-700'}`}>Next Time Notes</span>
        </div>
        {isExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopyAndClear();
            }}
            className={`flex items-center px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              notes.trim() 
                ? 'bg-white text-indigo-700 hover:bg-gray-100' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Copy to meeting and clear"
            disabled={!notes.trim()}
          >
            <Copy className="w-3 h-3 mr-1" />
            <span>Copy & Clear</span>
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div className="p-4 overflow-auto bg-gray-50" style={{ maxHeight: 'calc(60% - 40px)' }}>
          <textarea
            ref={textareaRef}
            value={notes}
            onChange={handleNotesChange}
            placeholder="Add notes for next time..."
            className="w-full p-3 border border-gray-200 rounded-lg shadow-inner resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
            style={{ minHeight: '160px', fontSize: '0.95rem', lineHeight: '1.5' }}
          />
          <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
            <span>Hover away to minimize</span>
            <span>{notes.length > 0 ? `${notes.length} characters` : 'No notes yet'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
