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
}

export const SummaryDialog: React.FC<SummaryDialogProps> = ({ isOpen, onClose }) => {
  const [meetingUpdates, setMeetingUpdates] = useState<MeetingUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const extractDateHeadings = (content: string): Date[] => {
    const dates: Date[] = [];
    
    // Create a temporary div to parse HTML content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    
    // Get all text content and split by lines
    const textContent = tempDiv.textContent || '';
    const lines = textContent.split('\n');
    
    // Common date patterns to match
    const datePatterns = [
      // MM/DD/YYYY, MM/DD/YY
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      // Month DD, YYYY
      /([A-Za-z]+\s+\d{1,2},\s+\d{4})/g,
      // DD Month YYYY
      /(\d{1,2}\s+[A-Za-z]+\s+\d{4})/g,
      // YYYY-MM-DD
      /(\d{4}-\d{1,2}-\d{1,2})/g,
    ];
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // Skip if line is too long (likely not a date heading)
      if (trimmedLine.length > 50) return;
      
      // Check each date pattern
      datePatterns.forEach(pattern => {
        const matches = trimmedLine.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const date = new Date(match);
            if (!isNaN(date.getTime())) {
              dates.push(date);
            }
          });
        }
      });
    });
    
    // Remove duplicates and sort by date
    const uniqueDates = Array.from(new Set(dates.map(d => d.getTime())))
      .map(time => new Date(time))
      .sort((a, b) => b.getTime() - a.getTime());
    
    return uniqueDates;
  };

  const loadMeetingUpdates = async () => {
    setIsLoading(true);
    try {
      const meetings = await getMeetings();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const updates: MeetingUpdate[] = meetings
        .filter(meeting => !meeting.isDivider) // Filter out divider entries
        .map(meeting => {
          const updateDates = extractDateHeadings(meeting.content);
          const recentDates = updateDates.filter(date => date >= sevenDaysAgo);
          
          return {
            meeting,
            updateDates: recentDates,
            hasRecentUpdates: recentDates.length > 0
          };
        })
        .filter(update => update.hasRecentUpdates || new Date(update.meeting.updatedAt) >= sevenDaysAgo)
        .sort((a, b) => {
          // Sort by most recent update date
          const aLatest = Math.max(
            ...a.updateDates.map(d => d.getTime()),
            a.meeting.updatedAt
          );
          const bLatest = Math.max(
            ...b.updateDates.map(d => d.getTime()),
            b.meeting.updatedAt
          );
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
              Meetings and updates from the past week
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
              <p className="text-gray-600">No meetings or updates found in the last 7 days.</p>
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
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span className="mr-4">Meeting Date: {update.meeting.date}</span>
                        <Clock className="w-4 h-4 mr-1" />
                        <span>Last Modified: {formatTime(update.meeting.updatedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {update.updateDates.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Recent Update Dates Found:
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {update.updateDates.map((date, dateIndex) => (
                          <span
                            key={dateIndex}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {formatDate(date)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Show a preview of the meeting content */}
                  <div className="text-sm text-gray-600">
                    <div className="max-h-24 overflow-hidden">
                      <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ 
                          __html: update.meeting.content.substring(0, 200) + '...' 
                        }} 
                      />
                    </div>
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