import React, { useState, useEffect, useRef } from 'react';
import { Meeting } from '../types';

interface SearchDialogProps {
  meetings: Meeting[];
  onSelect: (meeting: Meeting, matchIndex: number, match: {start: number, end: number}) => void;
  onClose: () => void;
}

function getMatches(text: string, search: string) {
  if (!search) return [];
  const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  const matches = [];
  let match;
  while ((match = regex.exec(text))) {
    matches.push({ start: match.index, end: match.index + match[0].length });
    // Prevent infinite loop for zero-length matches
    if (match.index === regex.lastIndex) regex.lastIndex++;
  }
  return matches;
}

function stripHtmlTags(str: string) {
  return str.replace(/<[^>]*>/g, '');
}

export const SearchDialog: React.FC<SearchDialogProps> = ({ meetings, onSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMeetingIndex, setSelectedMeetingIndex] = useState(0);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find meetings with at least one match in title or content
  const matchingMeetings = meetings
    .map(meeting => {
      const titleMatches = getMatches(meeting.title, searchTerm);
      const contentMatches = getMatches(meeting.content, searchTerm);
      return {
        meeting,
        titleMatches,
        contentMatches,
        totalMatches: titleMatches.length + contentMatches.length,
      };
    })
    .filter(m => m.totalMatches > 0);

  const selectedMeeting = matchingMeetings[selectedMeetingIndex]?.meeting;
  const matchSnippets: {text: string, start: number, end: number, isTitle: boolean, before: string, after: string}[] = [];
  if (selectedMeeting && searchTerm) {
    // Title matches
    const titleMatches = getMatches(selectedMeeting.title, searchTerm);
    for (const m of titleMatches) {
      const contextStart = Math.max(0, m.start - 20);
      const contextEnd = Math.min(selectedMeeting.title.length, m.end + 20);
      matchSnippets.push({
        text: stripHtmlTags(selectedMeeting.title.substring(m.start, m.end)),
        start: m.start,
        end: m.end,
        isTitle: true,
        before: stripHtmlTags(selectedMeeting.title.substring(contextStart, m.start)),
        after: stripHtmlTags(selectedMeeting.title.substring(m.end, contextEnd)),
      });
    }
    // Content matches (show a snippet of context)
    const contentMatches = getMatches(selectedMeeting.content, searchTerm);
    for (const m of contentMatches) {
      const contextStart = Math.max(0, m.start - 20);
      const contextEnd = Math.min(selectedMeeting.content.length, m.end + 20);
      matchSnippets.push({
        text: stripHtmlTags(selectedMeeting.content.substring(m.start, m.end)),
        start: m.start,
        end: m.end,
        isTitle: false,
        before: stripHtmlTags(selectedMeeting.content.substring(contextStart, m.start)),
        after: stripHtmlTags(selectedMeeting.content.substring(m.end, contextEnd)),
      });
    }
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset match index when meeting changes
  useEffect(() => {
    setSelectedMatchIndex(0);
  }, [selectedMeetingIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (document.activeElement === inputRef.current) {
          setSelectedMeetingIndex(prev => Math.min(prev + 1, matchingMeetings.length - 1));
        } else {
          setSelectedMatchIndex(prev => Math.min(prev + 1, matchSnippets.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (document.activeElement === inputRef.current) {
          setSelectedMeetingIndex(prev => Math.max(prev - 1, 0));
        } else {
          setSelectedMatchIndex(prev => Math.max(prev - 1, 0));
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedMeeting && matchSnippets[selectedMatchIndex]) {
          onSelect(selectedMeeting, selectedMatchIndex, {
            start: matchSnippets[selectedMatchIndex].start,
            end: matchSnippets[selectedMatchIndex].end,
          });
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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 flex flex-col">
        <div className="p-4">
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedMeetingIndex(0);
              setSelectedMatchIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search meetings..."
            className="w-full px-4 py-2 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-1 min-h-0">
          {/* Meetings list */}
          <div className="w-1/3 border-r max-h-96 overflow-y-auto">
            {matchingMeetings.length === 0 && (
              <div className="px-4 py-2 text-gray-500">No meetings found</div>
            )}
            {matchingMeetings.map((m, idx) => (
              <div
                key={m.meeting.id}
                className={`px-4 py-2 cursor-pointer ${idx === selectedMeetingIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => {
                  setSelectedMeetingIndex(idx);
                  setSelectedMatchIndex(0);
                }}
              >
                <div className="font-medium">{m.meeting.title}</div>
                <div className="text-sm text-gray-500">{new Date(m.meeting.date).toLocaleDateString()}</div>
                <div className="text-xs text-blue-600">{m.totalMatches} match{m.totalMatches !== 1 ? 'es' : ''}</div>
              </div>
            ))}
          </div>
          {/* Matches list */}
          <div className="flex-1 max-h-96 overflow-y-auto">
            {selectedMeeting && matchSnippets.length > 0 ? (
              matchSnippets.map((snippet, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-2 cursor-pointer ${idx === selectedMatchIndex ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                  onClick={() => {
                    onSelect(selectedMeeting, idx, { start: snippet.start, end: snippet.end });
                  }}
                >
                  <span className="text-gray-400 font-mono">{snippet.before}</span>
                  <span className="font-mono bg-yellow-100 px-1 rounded">
                    {snippet.text}
                  </span>
                  <span className="text-gray-400 font-mono">{snippet.after}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {snippet.isTitle ? 'Title' : 'Content'}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-gray-500">No matches in this meeting</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 