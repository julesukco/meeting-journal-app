import React, { useState, useEffect, useRef } from 'react';
import { ActionItem } from '../types';
import { ActionItems } from './ActionItems';
import { Reminders, RemindersHandle } from './Reminders';
import { getReminders, Reminder } from '../services/storage';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  const remindersRef = useRef<RemindersHandle>(null);

  useEffect(() => {
    const isOneOnOne = selectedMeeting?.title.toLowerCase().startsWith('1-1');
    setExpandedSection(isOneOnOne ? 'action-items' : 'reminders');
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

  const isOneOnOne = selectedMeeting?.title.toLowerCase().startsWith('1-1');
  
  const sections = [
    { id: 'action-items', title: 'Action Items', icon: '📝' },
    { id: 'reminders', title: 'Reminders', icon: '⏰' },
  ];

  if (isOneOnOne) {
    sections.push(
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
      case 'what-to-work-on':
        sectionContent = extractBetweenHeaders(content, 'What to Work On', 'AI');
        break;
    }
    
    return sectionContent;
  };

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col h-screen overflow-hidden">
      {/* Action Items - Always visible */}
      <div className="border-b border-gray-200 flex-shrink-0">
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">📝</span>
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
              className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{section.icon}</span>
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
                {expandedSection === section.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </div>
            </div>
            
            {expandedSection === section.id && (
              <div className="px-4 pb-4">
                {section.id === 'reminders' && (
                  <div className="max-h-[200px] overflow-y-auto">
                    <Reminders
                      ref={remindersRef}
                      reminders={reminders}
                      onAddReminder={handleAddReminder}
                      onDeleteReminder={handleDeleteReminder}
                      onUpdateReminder={handleUpdateReminder}
                    />
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

      <div className="flex space-x-2 p-4 border-t border-gray-200 flex-shrink-0">
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
  );
};
