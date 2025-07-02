import React, { useEffect, useState } from 'react';
import { Meeting } from '../types';
import { getMeetings } from '../services/storage';
import { X, Calendar, Clock } from 'lucide-react';

interface SummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MeetingUpdate {
  meeting: Meeting;
  updateDates: Date[];
  hasRecentUpdates: boolean;
  recentSections: { date: Date; content: string }[];
}

export const SummaryDialog: React.FC<SummaryDialogProps> = ({ isOpen, onClose }) => {
  const [meetingUpdates, setMeetingUpdates] = useState<MeetingUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const extractRecentSections = (content: string): { dates: Date[], recentSections: { date: Date, content: string }[] } => {
    const dates: Date[] = [];
    const recentSections: { date: Date, content: string }[] = [];

    // Parse HTML into a DOM tree
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Date patterns
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      /([A-Za-z]+\s+\d{1,2},\s+\d{4})/g,
      /(\d{1,2}\s+[A-Za-z]+\s+\d{4})/g,
      /(\d{4}-\d{1,2}-\d{1,2})/g,
    ];

    // Helper to check if a string contains a date and return the date if it's recent
    const getRecentDate = (text: string, sevenDaysAgo: Date): Date | null => {
      for (const pattern of datePatterns) {
        const matches = text.match(pattern);
        if (matches) {
          for (const match of matches) {
            const date = new Date(match);
            if (!isNaN(date.getTime()) && date >= sevenDaysAgo) {
              return date;
            }
          }
        }
      }
      return null;
    };

    // Get all block-level elements (p, li, div, etc.)
    const blocks: HTMLElement[] = [];
    tempDiv.childNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (["P", "DIV", "LI", "OL", "UL", "H1", "H2", "H3", "H4", "H5", "H6"].includes(el.tagName)) {
          blocks.push(el);
        }
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        // Wrap stray text nodes in a <p>
        const p = document.createElement('p');
        p.textContent = node.textContent;
        blocks.push(p);
      }
    });

    // Find all date header blocks and their indices
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateHeaders: { date: Date, blockIndex: number }[] = [];
    blocks.forEach((block, i) => {
      const text = block.textContent?.trim() || '';
      const date = getRecentDate(text, new Date(0)); // get all dates, filter later
      if (date) {
        dateHeaders.push({ date, blockIndex: i });
      }
    });

    // Only keep date headers within the last 7 days
    const recentHeaders = dateHeaders.filter(h => h.date >= sevenDaysAgo);
    dates.push(...recentHeaders.map(h => h.date));

    // For each recent header, collect blocks from that header up to the next date header
    for (let i = 0; i < recentHeaders.length; ++i) {
      const currentHeader = recentHeaders[i];
      // Find this header's index in the full dateHeaders array
      const fullIdx = dateHeaders.findIndex(h => h.blockIndex === currentHeader.blockIndex && h.date.getTime() === currentHeader.date.getTime());
      const start = currentHeader.blockIndex;
      const end = (fullIdx + 1 < dateHeaders.length) ? dateHeaders[fullIdx + 1].blockIndex : blocks.length;
      // Join the HTML of the blocks for this section
      const sectionHtml = blocks.slice(start, end).map(b => b.outerHTML).join('');
      recentSections.push({ date: currentHeader.date, content: sectionHtml });
    }
    return { dates, recentSections };
  };

  const loadMeetingUpdates = async () => {
    setIsLoading(true);
    try {
      const meetings = await getMeetings();
      const updates: MeetingUpdate[] = meetings
        .filter(meeting => !meeting.isDivider)
        .map(meeting => {
          const { dates, recentSections } = extractRecentSections(meeting.content);
          return {
            meeting,
            updateDates: dates,
            hasRecentUpdates: dates.length > 0,
            recentSections
          };
        })
        .filter(update => update.hasRecentUpdates)
        .sort((a, b) => {
          const aLatest = Math.max(...a.updateDates.map(d => d.getTime()));
          const bLatest = Math.max(...b.updateDates.map(d => d.getTime()));
          return bLatest - aLatest;
        });
      setMeetingUpdates(updates);
    } catch (error) {
      console.error('Error loading meeting updates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMeetingUpdates();
    }
  }, [isOpen]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Last 7 Days Summary</h2>
            <p className="text-gray-600 mt-1">
              Content from meetings with updates in the past week
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600">Loading updates...</span>
            </div>
          ) : meetingUpdates.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Recent Updates</h3>
              <p className="text-gray-600">No meetings with updates found in the last 7 days.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {meetingUpdates.map((update, index) => (
                <div key={update.meeting.id} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {update.meeting.title}
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {update.recentSections.map((section, idx) => (
                      <div key={idx} className="bg-white rounded border p-3">
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: section.content || 'No content' }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">
              {meetingUpdates.length} meeting{meetingUpdates.length !== 1 ? 's' : ''} with recent activity
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};