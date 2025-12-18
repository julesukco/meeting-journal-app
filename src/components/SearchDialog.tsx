import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Meeting, AIConfig, AISearchResult } from '../types';
import { getAIConfig, callAI, formatMeetingsForAI } from '../services/ai';

interface SearchDialogProps {
  meetings: Meeting[];
  currentMeeting?: Meeting | null;
  onSelect: (meeting: Meeting, matchIndex: number, match: {start: number, end: number}, searchTerm?: string) => void;
  onClose: () => void;
  onOpenAIConfig: () => void;
}

type SearchMode = 'basic' | 'ai';

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

function removeImageTags(html: string) {
  return html.replace(/<img[^>]*>/gi, '');
}

export const SearchDialog: React.FC<SearchDialogProps> = ({ meetings, currentMeeting, onSelect, onClose, onOpenAIConfig }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMeetingIndex, setSelectedMeetingIndex] = useState(0);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0);
  const [mode, setMode] = useState<SearchMode>('basic');
  
  // AI-specific state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AISearchResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Load AI config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await getAIConfig();
        setAiConfig(config);
      } catch (error) {
        console.error('Error loading AI config:', error);
      }
    };
    loadConfig();
  }, []);

  // Find meetings with at least one match in title or content (excluding image tags in content)
  const matchingMeetings = meetings
    .map(meeting => {
      const titleMatches = getMatches(meeting.title, searchTerm);
      const cleanContent = removeImageTags(meeting.content);
      const contentMatches = getMatches(cleanContent, searchTerm);
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
    const cleanContent = removeImageTags(selectedMeeting.content);
    const contentMatches = getMatches(cleanContent, searchTerm);
    for (const m of contentMatches) {
      const contextStart = Math.max(0, m.start - 20);
      const contextEnd = Math.min(cleanContent.length, m.end + 20);
      matchSnippets.push({
        text: stripHtmlTags(cleanContent.substring(m.start, m.end)),
        start: m.start,
        end: m.end,
        isTitle: false,
        before: stripHtmlTags(cleanContent.substring(contextStart, m.start)),
        after: stripHtmlTags(cleanContent.substring(m.end, contextEnd)),
      });
    }
  }

  useEffect(() => {
    if (mode === 'basic') {
      inputRef.current?.focus();
    } else {
      aiInputRef.current?.focus();
    }
  }, [mode]);

  // Reset match index when meeting changes
  useEffect(() => {
    setSelectedMatchIndex(0);
  }, [selectedMeetingIndex]);

  // Handle AI search - only uses the current meeting context
  const handleAISearch = useCallback(async () => {
    if (!aiPrompt.trim()) return;
    
    if (!aiConfig) {
      setAiError('AI configuration not loaded. Please try again.');
      return;
    }

    if (!currentMeeting) {
      setAiError('No meeting selected. Please select a meeting first.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiResult(null);

    try {
      // Only use the current meeting for AI context
      const meetingContext = formatMeetingsForAI([currentMeeting]);
      const result = await callAI(aiPrompt, meetingContext, aiConfig);
      setAiResult(result);
      // Focus on result area for scrolling
      setTimeout(() => resultRef.current?.focus(), 100);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, aiConfig, currentMeeting]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Global shortcuts (work in both modes)
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        return;
      case ',':
        // Ctrl+, opens AI config
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onOpenAIConfig();
          return;
        }
        break;
    }

    // Tab to switch modes
    if (e.key === 'Tab' && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setMode(mode === 'basic' ? 'ai' : 'basic');
      return;
    }

    // Mode-specific key handling
    if (mode === 'basic') {
      handleBasicModeKeyDown(e);
    } else {
      handleAIModeKeyDown(e);
    }
  };

  const handleBasicModeKeyDown = (e: React.KeyboardEvent) => {
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
          }, searchTerm);
        }
        break;
      case 'Tab':
        // Regular Tab switches to AI mode
        if (!e.shiftKey) {
          e.preventDefault();
          setMode('ai');
        }
        break;
    }
  };

  const handleAIModeKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        // Ctrl+Enter or Cmd+Enter to submit
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleAISearch();
        }
        break;
      case 'Tab':
        // Regular Tab switches back to basic mode
        if (!e.shiftKey) {
          e.preventDefault();
          setMode('basic');
        }
        break;
      case 'ArrowUp':
        // Allow scrolling in result with arrow keys when focused on result
        if (document.activeElement === resultRef.current) {
          // Let default behavior handle scrolling
        }
        break;
      case 'ArrowDown':
        // Allow scrolling in result with arrow keys when focused on result
        if (document.activeElement === resultRef.current) {
          // Let default behavior handle scrolling
        }
        break;
      case 'r':
        // Ctrl+R to refocus on input for new query
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          aiInputRef.current?.focus();
          aiInputRef.current?.select();
        }
        break;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 flex flex-col max-h-[80vh]">
        {/* Mode tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setMode('basic')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'basic'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">🔍</span>
            Basic Search
            <span className="ml-2 text-xs text-gray-400">(Tab to switch)</span>
          </button>
          <button
            onClick={() => setMode('ai')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'ai'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">✨</span>
            AI Search
            <span className="ml-2 text-xs text-gray-400">(Tab to switch)</span>
          </button>
        </div>

        {mode === 'basic' ? (
          /* Basic Search Mode */
          <>
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
                placeholder="Search meetings... (↑↓ to navigate, Enter to select, Esc to close)"
                className="w-full px-4 py-2 text-lg border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-1 min-h-0 overflow-hidden">
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
                        onSelect(selectedMeeting, idx, { start: snippet.start, end: snippet.end }, searchTerm);
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
          </>
        ) : (
          /* AI Search Mode */
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4">
              <div className="relative">
                <textarea
                  ref={aiInputRef}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={currentMeeting ? `Ask AI about "${currentMeeting.title}"... (Ctrl+Enter to search)` : "Select a meeting first to use AI search"}
                  rows={3}
                  className="w-full px-4 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  disabled={aiLoading || !currentMeeting}
                />
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <button
                    onClick={onOpenAIConfig}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                    title="AI Settings (Ctrl+,)"
                  >
                    ⚙️ Settings
                  </button>
                  <button
                    onClick={handleAISearch}
                    disabled={aiLoading || !aiPrompt.trim() || !currentMeeting}
                    className={`px-3 py-1 text-sm rounded ${
                      aiLoading || !aiPrompt.trim() || !currentMeeting
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {aiLoading ? '...' : 'Search (Ctrl+↵)'}
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <span className="bg-gray-100 px-1.5 py-0.5 rounded">Ctrl+Enter</span> search
                <span className="bg-gray-100 px-1.5 py-0.5 rounded ml-2">Tab</span> switch mode
                <span className="bg-gray-100 px-1.5 py-0.5 rounded ml-2">Ctrl+,</span> settings
                <span className="bg-gray-100 px-1.5 py-0.5 rounded ml-2">Ctrl+R</span> new query
                <span className="bg-gray-100 px-1.5 py-0.5 rounded ml-2">Esc</span> close
              </div>
            </div>

            {/* AI Results Area */}
            <div className="flex-1 overflow-hidden border-t">
              {aiLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3"></div>
                    <p className="text-gray-600">Analyzing meeting: {currentMeeting?.title || 'Unknown'}...</p>
                    <p className="text-sm text-gray-400 mt-1">This may take a moment</p>
                  </div>
                </div>
              )}

              {aiError && (
                <div className="p-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <span className="text-red-500 mr-2">⚠️</span>
                      <div>
                        <p className="text-red-800 font-medium">Error</p>
                        <p className="text-red-600 text-sm mt-1">{aiError}</p>
                        {aiError.includes('API key') && (
                          <button
                            onClick={onOpenAIConfig}
                            className="mt-2 text-sm text-purple-600 hover:text-purple-700 underline"
                          >
                            Open AI Settings (Ctrl+,)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {aiResult && (
                <div 
                  ref={resultRef}
                  tabIndex={0}
                  className="h-full overflow-y-auto p-4 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:ring-inset"
                >
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <span className="mr-2">✨</span>
                      <span className="font-medium text-purple-800">AI Response</span>
                      <span className="ml-auto text-xs text-gray-500">
                        {new Date(aiResult.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
                      {aiResult.response}
                    </div>
                  </div>
                </div>
              )}

              {!aiLoading && !aiError && !aiResult && (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <span className="text-4xl mb-3 block">✨</span>
                    {currentMeeting ? (
                      <>
                        <p>Ask AI about: <span className="font-medium text-gray-600">{currentMeeting.title}</span></p>
                        <p className="text-sm mt-2">Examples:</p>
                        <ul className="text-sm mt-1 space-y-1">
                          <li>"Summarize the key points"</li>
                          <li>"What action items were discussed?"</li>
                          <li>"What decisions were made?"</li>
                        </ul>
                      </>
                    ) : (
                      <p>Select a meeting first to use AI search</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer with keyboard hints */}
        <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
          <span>
            {mode === 'basic' 
              ? `${matchingMeetings.length} matching meetings`
              : currentMeeting 
                ? `AI context: ${currentMeeting.title}`
                : 'No meeting selected for AI'
            }
          </span>
          <span>Press <span className="bg-gray-200 px-1 rounded">Esc</span> to close</span>
        </div>
      </div>
    </div>
  );
};
