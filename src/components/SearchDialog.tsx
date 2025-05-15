import React, { useState, useEffect, useRef } from 'react';
import { Meeting } from '../types';

interface SearchDialogProps {
  meetings: Meeting[];
  onSelect: (meeting: Meeting) => void;
  onClose: () => void;
}

export const SearchDialog: React.FC<SearchDialogProps> = ({ meetings, onSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredMeetings = meetings.filter(meeting =>
    meeting.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    // Focus the input when the dialog opens
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredMeetings.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredMeetings[selectedIndex]) {
          onSelect(filteredMeetings[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4">
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search meetings..."
            className="w-full px-4 py-2 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="max-h-96 overflow-y-auto">
          {filteredMeetings.map((meeting, index) => (
            <div
              key={meeting.id}
              className={`px-4 py-2 cursor-pointer ${
                index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => onSelect(meeting)}
            >
              <div className="font-medium">{meeting.title}</div>
              <div className="text-sm text-gray-500">
                {new Date(meeting.date).toLocaleDateString()}
              </div>
            </div>
          ))}
          {filteredMeetings.length === 0 && (
            <div className="px-4 py-2 text-gray-500">
              No meetings found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 