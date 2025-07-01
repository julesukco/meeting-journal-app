import React, { useState, useEffect, useRef } from 'react';
import { ActionItem } from '../types';
import { ActionItems } from './ActionItems';
import { Reminders, RemindersHandle } from './Reminders';
import { SummaryDialog } from './SummaryDialog';
import { getReminders, Reminder, getMeetings } from '../services/storage';
import { ChevronDown, ChevronRight, RefreshCw, BarChart3 } from 'lucide-react';

interface RightNavProps {
  actionItems: ActionItem[];
  onToggleActionItem: (id: string) => void;
  onExport: () => Promise<void>;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  selectedMeeting: {
    title: string;
    content: string;
  } | null;
}

interface Feedback {
  meetingTitle: string;
  personName: string;
  feedback: string;
  date: string;
}

export const RightNav: React.FC<RightNavProps> = ({
  actionItems,
  onToggleActionItem,
  onExport,
  onImport,
  selectedMeeting,
}) => {
  const REMINDERS_KEY = 'reminders';
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const saved = localStorage.getItem(REMINDERS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(() => {
    const isOneOnOne = selectedMeeting?.title.toLowerCase().startsWith('1-1');
    return isOneOnOne ? 'action-items' : 'reminders';
  });
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const remindersRef = useRef<RemindersHandle>(null);

  useEffect(() => {
    const isOneOnOne = selectedMeeting?.title.toLowerCase().startsWith('1-1');
    setExpandedSection(isOneOnOne ? 'action-items' : 'reminders');
    // Clear feedback when switching meetings
    setFeedback([]);
  }, [selectedMeeting]);

  // Save reminders whenever they change
  useEffect(() => {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  }, [reminders]);

  const handleAddReminder = (text: string) => {
    const newReminder: Reminder = {
      id: Date.now().toString(),
      text,
    };
    setReminders((prev: Reminder[]) => [...prev, newReminder]);
  };

  const handleDeleteReminder = (id: string) => {
    setReminders((prev: Reminder[]) => prev.filter((reminder: Reminder) => reminder.id !== id));
  };

  const handleUpdateReminder = (id: string, newText: string) => {
    setReminders((prev: Reminder[]) => prev.map(reminder => reminder.id === id ? { ...reminder, text: newText } : reminder));
  };

  const fetchFeedback = async () => {
    setIsLoadingFeedback(true);
    // Expand the feedback section when refresh is clicked
    setExpandedSection('feedback');
    try {
      const meetings = await getMeetings();
      const feedbackData: Feedback[] = [];
      
      // Only run if in a 1-1 meeting
      if (!isOneOnOne || !selectedMeeting) {
        setFeedback([]);
        setIsLoadingFeedback(false);
        return;
      }
      // Extract the person name from the current 1-1 meeting title
      const currentPerson = selectedMeeting.title.replace(/^1-1\s+/i, '').trim().toLowerCase();
      
      meetings.forEach(meeting => {
        const content = meeting.content;
        // Flexible regex for Feedback: Name - feedback or Feedback: Name: feedback
        const feedbackRegex = /Feedback:\s*([^-:]+)(?:[-:]\s*)([^<]+)/gi;
        let match;
        while ((match = feedbackRegex.exec(content)) !== null) {
          const personName = match[1].trim().toLowerCase();
          const feedbackText = match[2].trim();
          // Flexible, case-insensitive matching
          if (
            currentPerson.includes(personName) ||
            personName.includes(currentPerson)
          ) {
            feedbackData.push({
              meetingTitle: meeting.title,
              personName: match[1].trim(),
              feedback: feedbackText,
              date: meeting.date
            });
          }
        }
      });
      setFeedback(feedbackData);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setIsLoadingFeedback(false);
    }
  };

  const isOneOnOne = selectedMeeting?.title.toLowerCase().startsWith('1-1');
  
  const sections = [
    { id: 'action-items', title: 'Action Items', icon: '📝' },
    { id: 'reminders', title: 'Reminders', icon: '⏰' },
  ];

  if (isOneOnOne) {
    sections.push(
      { id: 'feedback', title: 'Feedback', icon: '💬' },
      { id: 'pa', title: 'PA', icon: '👤' },
      { id: 'goals', title: 'Goals', icon: '🎯' },
      { id: 'what-to-work-on', title: 'What to Work On', icon: '📋' }
    );
  }

  const extractSectionContent = (sectionId: string) => {
    if (!selectedMeeting?.content) {
      return '';
    }
    
    const content = selectedMeeting.content;
    
    let sectionContent = '';
    
    // Helper function to extract content between headers
    const extractBetweenHeaders = (content: string, startHeader: string, endHeader?: string) => {
      // Create a temporary div to parse HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      
      // Find all text nodes and their parent elements
      const walker = document.createTreeWalker(
        tempDiv,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let currentNode = walker.nextNode();
      let startIndex = -1;
      let endIndex = -1;
      
      // Find the start and end indices
      while (currentNode) {
        const text = currentNode.textContent || '';
        if (startIndex === -1 && text.includes(startHeader + ':')) {
          startIndex = tempDiv.innerHTML.indexOf(startHeader + ':') + startHeader.length + 1;
        }
        if (endHeader && endIndex === -1 && text.includes(endHeader + ':')) {
          endIndex = tempDiv.innerHTML.indexOf(endHeader + ':');
        }
        currentNode = walker.nextNode();
      }
      
      if (startIndex === -1) return '';
      
      // Extract the content between headers
      const extracted = tempDiv.innerHTML.slice(
        startIndex,
        endIndex === -1 ? undefined : endIndex
      ).trim();
      
      return extracted;
    };
    
    switch (sectionId) {
      case 'pa':
        sectionContent = extractBetweenHeaders(content, 'PA', 'Goals');
        break;
      case 'goals':
        sectionContent = extractBetweenHeaders(content, 'Goals', 'What to Work On');
        break;
      case 'what-to-work-on': {
        // Parse the HTML and extract only the first bullet list after the header
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        
        // Find the node that contains 'What to Work On:'
        let foundHeader = false;
        let bulletListHtml = '';
        const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_ELEMENT, null);
        while (walker.nextNode()) {
          const node = walker.currentNode as HTMLElement;
          if (!foundHeader && node.textContent && node.textContent.trim().startsWith('What to Work On:')) {
            foundHeader = true;
          } else if (foundHeader && (node.tagName === 'UL' || node.tagName === 'OL')) {
            bulletListHtml = node.outerHTML;
            break;
          }
        }
        sectionContent = bulletListHtml;
        break;
      }
    }
    
    return sectionContent;
  };

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col h-screen overflow-hidden">
      {/* Action Items - Always visible */}
      <div className="border-b border-gray-200 flex-shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-base ${actionItems.length > 0 ? 'bg-blue-100 p-1 rounded' : ''}`}>📝</span>
            <span className="font-medium text-base">Action Items</span>
          </div>
          <div className="flex items-center justify-end mb-2">
            <label className="flex items-center gap-1 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={() => setShowCompleted((v) => !v)}
                className="accent-blue-500"
              />
              Show completed
            </label>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            <ActionItems
              items={showCompleted ? actionItems : actionItems.filter(item => !item.completed)}
              onToggleComplete={onToggleActionItem}
            />
          </div>
        </div>
      </div>

      {/* Other sections */}
      <div className="flex-1 overflow-y-auto">
        {sections.filter(section => section.id !== 'action-items').map((section) => (
          <div key={section.id} className="border-b border-gray-200">
            <div
              className={`flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                section.id === 'action-items' && actionItems.length > 0 ? 'text-blue-600' : ''
              }`}
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
            >
              <div className="flex items-center gap-2">
                <span className={`text-base ${section.id === 'action-items' && actionItems.length > 0 ? 'bg-blue-100 p-1 rounded' : ''}`}>{section.icon}</span>
                <span className="font-medium text-base">{section.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {section.id === 'reminders' && (
                  <button
                    onClick={e => { e.stopPropagation(); remindersRef.current?.triggerAddReminder(); }}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 text-lg focus:outline-none"
                    title="Add Reminder"
                  >
                    +
                  </button>
                )}
                {section.id === 'feedback' && (
                  <button
                    onClick={e => { e.stopPropagation(); fetchFeedback(); }}
                    className={`w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 text-lg focus:outline-none ${isLoadingFeedback ? 'animate-spin' : ''}`}
                    title="Refresh Feedback"
                    disabled={isLoadingFeedback}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                {expandedSection === section.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </div>
            
            {expandedSection === section.id && (
              <div className="px-2 pb-2">
                {section.id === 'reminders' && (
                  <div className="max-h-[200px] overflow-y-auto -mx-2">
                    <Reminders
                      ref={remindersRef}
                      reminders={reminders}
                      onAddReminder={handleAddReminder}
                      onDeleteReminder={handleDeleteReminder}
                      onUpdateReminder={handleUpdateReminder}
                    />
                  </div>
                )}
                
                {section.id === 'feedback' && (
                  <div className="max-h-[200px] overflow-y-auto -mx-2">
                    {feedback.length === 0 ? (
                      <div className="text-gray-500 italic text-sm p-2">
                        {isLoadingFeedback ? 'Loading feedback...' : 'No feedback found. Click the refresh button to search.'}
                      </div>
                    ) : (
                      <div className="space-y-2 p-2">
                        {feedback.map((item, index) => (
                          <div key={index} className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                            {item.feedback}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                
                {['pa', 'goals', 'what-to-work-on'].includes(section.id) && (
                  <div className="prose prose-sm max-w-none bg-gray-50 rounded-lg p-3 max-h-[200px] overflow-y-auto">
                    {extractSectionContent(section.id) ? (
                      <div dangerouslySetInnerHTML={{ __html: extractSectionContent(section.id) }} />
                    ) : (
                      <div className="text-gray-500 italic text-sm">No content found in this section</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-200 flex-shrink-0 space-y-2">
        {/* Summarize button - full width */}
        <button
          onClick={() => setShowSummaryDialog(true)}
          className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg shadow-lg hover:bg-purple-600 transition-colors flex items-center justify-center"
        >
          <BarChart3 className="w-5 h-5 mr-2" />
          Summarize
        </button>
        
        {/* Import/Export buttons - side by side */}
        <div className="flex space-x-2">
          <button
            onClick={onExport}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <label className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg shadow-lg hover:bg-green-600 transition-colors cursor-pointer flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
            <input
              type="file"
              accept=".json"
              onChange={onImport}
              className="hidden"
            />
          </label>
        </div>
      </div>
      
      {/* Summary Dialog */}
      <SummaryDialog
        isOpen={showSummaryDialog}
        onClose={() => setShowSummaryDialog(false)}
      />
    </div>
  );
};
