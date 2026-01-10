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

type SearchMode = 'basic' | 'ai' | 'talkingPoints';

// Extract date-separated sessions from meeting content
function extractSessions(htmlContent: string): Array<{date: string, content: string}> {
  const stripped = stripHtmlTags(htmlContent);
  const lines = stripped.split('\n');
  const sessions: Array<{date: string, content: string}> = [];

  // Match dates like 1/5/26, 01/05/2026, etc.
  const datePattern = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;

  let currentDate = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (datePattern.test(trimmed)) {
      // Save previous session if exists
      if (currentDate && currentContent.length > 0) {
        sessions.push({ date: currentDate, content: currentContent.join('\n') });
      }
      currentDate = trimmed;
      currentContent = [];
    } else if (currentDate) {
      currentContent.push(line);
    }
  }

  // Don't forget last session
  if (currentDate && currentContent.length > 0) {
    sessions.push({ date: currentDate, content: currentContent.join('\n') });
  }

  return sessions;
}

// Build AI prompt for talking points generation
function buildTalkingPointsPrompt(meeting: Meeting, sessions: Array<{date: string, content: string}>): string {
  const recentSessions = sessions.slice(-3).reverse(); // Last 3, most recent first

  let prompt = `You are preparing for a recurring meeting titled "${meeting.title}".
Based on the recent sessions below, generate 5-7 talking points for the upcoming meeting.

Focus on:
- Unresolved items or open questions from recent discussions
- Follow-ups that need status updates
- Decisions that may need revisiting
- Key topics that were discussed recently

`;

  if (meeting.attendees?.length > 0) {
    prompt += `Attendees: ${meeting.attendees.join(', ')}\n\n`;
  }

  prompt += `=== Recent Sessions (most recent first) ===\n\n`;

  if (recentSessions.length === 0) {
    // Fallback: use entire content as one session
    prompt += `--- Full Meeting Notes ---\n${stripHtmlTags(meeting.content).trim()}\n\n`;
  } else {
    for (const session of recentSessions) {
      prompt += `--- ${session.date} ---\n${session.content.trim()}\n\n`;
    }
  }

  prompt += `Generate concise, actionable talking points for the next session:`;

  return prompt;
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

  // Talking Points state
  const [talkingPointsLoading, setTalkingPointsLoading] = useState(false);
  const [talkingPointsResult, setTalkingPointsResult] = useState<AISearchResult | null>(null);
  const [talkingPointsError, setTalkingPointsError] = useState<string | null>(null);
  const [talkingPointsGenerated, setTalkingPointsGenerated] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const talkingPointsRef = useRef<HTMLDivElement>(null);
  const meetingsListRef = useRef<HTMLDivElement>(null);

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
    } else if (mode === 'ai') {
      aiInputRef.current?.focus();
    }
    // talkingPoints mode auto-focuses on results when they load
  }, [mode]);

  // Reset match index when meeting changes
  useEffect(() => {
    setSelectedMatchIndex(0);
  }, [selectedMeetingIndex]);

  // Scroll selected meeting into view when navigating with keyboard
  useEffect(() => {
    if (meetingsListRef.current && matchingMeetings.length > 0) {
      const selectedElement = meetingsListRef.current.children[selectedMeetingIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedMeetingIndex, matchingMeetings.length]);

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

  // Generate talking points for the current meeting
  const generateTalkingPoints = useCallback(async () => {
    if (!aiConfig) {
      setTalkingPointsError('AI configuration not loaded. Please try again.');
      return;
    }

    if (!currentMeeting) {
      setTalkingPointsError('No meeting selected. Please select a meeting first.');
      return;
    }

    setTalkingPointsLoading(true);
    setTalkingPointsError(null);
    setTalkingPointsResult(null);

    try {
      const sessions = extractSessions(currentMeeting.content);
      const prompt = buildTalkingPointsPrompt(currentMeeting, sessions);
      const result = await callAI(prompt, '', aiConfig);
      setTalkingPointsResult(result);
      setTalkingPointsGenerated(true);
      setTimeout(() => talkingPointsRef.current?.focus(), 100);
    } catch (error) {
      setTalkingPointsError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setTalkingPointsLoading(false);
    }
  }, [aiConfig, currentMeeting]);

  // Auto-generate talking points when switching to that mode
  useEffect(() => {
    if (mode === 'talkingPoints' && currentMeeting && !talkingPointsGenerated && !talkingPointsLoading) {
      generateTalkingPoints();
    }
  }, [mode, currentMeeting, talkingPointsGenerated, talkingPointsLoading, generateTalkingPoints]);

  // Reset talking points when meeting changes
  useEffect(() => {
    setTalkingPointsResult(null);
    setTalkingPointsError(null);
    setTalkingPointsGenerated(false);
  }, [currentMeeting?.id]);

  // Copy talking points to clipboard
  const copyTalkingPoints = useCallback(() => {
    if (talkingPointsResult) {
      navigator.clipboard.writeText(talkingPointsResult.response);
    }
  }, [talkingPointsResult]);

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

    // Ctrl+Tab to switch modes (cycles through all three)
    if (e.key === 'Tab' && !e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setMode(mode === 'basic' ? 'ai' : mode === 'ai' ? 'talkingPoints' : 'basic');
      return;
    }

    // Mode-specific key handling
    if (mode === 'basic') {
      handleBasicModeKeyDown(e);
    } else if (mode === 'ai') {
      handleAIModeKeyDown(e);
    } else {
      handleTalkingPointsModeKeyDown(e);
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
          // Close dialog first, then navigate to selection
          onClose();
          setTimeout(() => {
            onSelect(selectedMeeting, selectedMatchIndex, {
              start: matchSnippets[selectedMatchIndex].start,
              end: matchSnippets[selectedMatchIndex].end,
            }, searchTerm);
          }, 50);
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
        // Regular Tab switches to talking points mode
        if (!e.shiftKey) {
          e.preventDefault();
          setMode('talkingPoints');
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

  const handleTalkingPointsModeKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Tab':
        // Regular Tab switches back to basic mode
        if (!e.shiftKey) {
          e.preventDefault();
          setMode('basic');
        }
        break;
      case 'r':
        // Ctrl+R to regenerate
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setTalkingPointsGenerated(false);
          generateTalkingPoints();
        }
        break;
      case 'c':
        // Ctrl+C to copy (when not selecting text)
        if ((e.ctrlKey || e.metaKey) && talkingPointsResult) {
          // Only copy if no text is selected
          const selection = window.getSelection();
          if (!selection || selection.toString().length === 0) {
            e.preventDefault();
            copyTalkingPoints();
          }
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
          <button
            onClick={() => setMode('talkingPoints')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              mode === 'talkingPoints'
                ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">💡</span>
            Talking Points
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
              <div ref={meetingsListRef} className="w-1/3 border-r max-h-96 overflow-y-auto">
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
                        // Close dialog first, then navigate to selection
                        onClose();
                        setTimeout(() => {
                          onSelect(selectedMeeting, idx, { start: snippet.start, end: snippet.end }, searchTerm);
                        }, 50);
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
        ) : mode === 'ai' ? (
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
        ) : (
          /* Talking Points Mode */
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-800">
                    {currentMeeting ? `Talking Points for: ${currentMeeting.title}` : 'Talking Points'}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Auto-generated from your last 3 sessions
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setTalkingPointsGenerated(false);
                      generateTalkingPoints();
                    }}
                    disabled={talkingPointsLoading || !currentMeeting}
                    className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                      talkingPointsLoading || !currentMeeting
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title="Regenerate (Ctrl+R)"
                  >
                    🔄 Regenerate
                  </button>
                  <button
                    onClick={copyTalkingPoints}
                    disabled={!talkingPointsResult}
                    className={`px-3 py-1.5 text-sm rounded flex items-center gap-1 ${
                      !talkingPointsResult
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                    title="Copy to clipboard"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <span className="bg-gray-100 px-1.5 py-0.5 rounded">Ctrl+R</span> regenerate
                <span className="bg-gray-100 px-1.5 py-0.5 rounded ml-2">Tab</span> switch mode
                <span className="bg-gray-100 px-1.5 py-0.5 rounded ml-2">Esc</span> close
              </div>
            </div>

            {/* Talking Points Results Area */}
            <div className="flex-1 overflow-hidden">
              {talkingPointsLoading && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-3"></div>
                    <p className="text-gray-600">Generating talking points...</p>
                    <p className="text-sm text-gray-400 mt-1">Analyzing your recent sessions</p>
                  </div>
                </div>
              )}

              {talkingPointsError && (
                <div className="p-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <span className="text-red-500 mr-2">⚠️</span>
                      <div>
                        <p className="text-red-800 font-medium">Error</p>
                        <p className="text-red-600 text-sm mt-1">{talkingPointsError}</p>
                        <button
                          onClick={() => {
                            setTalkingPointsGenerated(false);
                            generateTalkingPoints();
                          }}
                          className="mt-2 text-sm text-green-600 hover:text-green-700 underline"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {talkingPointsResult && (
                <div
                  ref={talkingPointsRef}
                  tabIndex={0}
                  className="h-full overflow-y-auto p-4 focus:outline-none focus:ring-2 focus:ring-green-200 focus:ring-inset"
                >
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center mb-3">
                      <span className="mr-2">💡</span>
                      <span className="font-medium text-green-800">Suggested Talking Points</span>
                      <span className="ml-auto text-xs text-gray-500">
                        {new Date(talkingPointsResult.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
                      {talkingPointsResult.response}
                    </div>
                  </div>
                </div>
              )}

              {!talkingPointsLoading && !talkingPointsError && !talkingPointsResult && !currentMeeting && (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <span className="text-4xl mb-3 block">💡</span>
                    <p>Select a meeting first to generate talking points</p>
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
              : mode === 'ai'
                ? (currentMeeting ? `AI context: ${currentMeeting.title}` : 'No meeting selected for AI')
                : (currentMeeting ? `Talking points for: ${currentMeeting.title}` : 'No meeting selected')
            }
          </span>
          <span>Press <span className="bg-gray-200 px-1 rounded">Esc</span> to close</span>
        </div>
      </div>
    </div>
  );
};
