import React, { useState, useMemo } from 'react';
import { Meeting, MemoryBankConfig } from '../types';
import { extractMemoryBankContent, mergeMemoryBankContent, extractSessionsInDateRange } from '../services/ai';
import { Brain, Calendar, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface MemoryBankDialogProps {
  meetings: Meeting[];
  memoryBankMeeting: Meeting | null;
  memoryBankConfig: MemoryBankConfig;
  onClose: () => void;
  onCreateMemoryBank: () => void;
  onUpdateMemoryBank: (newContent: string, sessionsProcessed: number) => void;
}

export const MemoryBankDialog: React.FC<MemoryBankDialogProps> = ({
  meetings,
  memoryBankMeeting,
  memoryBankConfig,
  onClose,
  onCreateMemoryBank,
  onUpdateMemoryBank,
}) => {
  // Default start date: last update or 30 days ago
  const getDefaultStartDate = () => {
    if (memoryBankConfig.lastUpdateTimestamp > 0) {
      return new Date(memoryBankConfig.lastUpdateTimestamp).toISOString().split('T')[0];
    }
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return thirtyDaysAgo.toISOString().split('T')[0];
  };

  // Default end date: today
  const getDefaultEndDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [extractedContent, setExtractedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Get eligible meetings (exclude Memory Bank, dividers, archived)
  const eligibleMeetings = useMemo(() => {
    return meetings.filter(m => {
      if (m.id === memoryBankConfig.meetingId) return false;
      if (m.isDivider) return false;
      if (m.isArchived) return false;
      return true;
    });
  }, [meetings, memoryBankConfig.meetingId]);

  // Extract sessions from each meeting that are within the date range
  const filteredContent = useMemo(() => {
    const startDateObj = new Date(startDate);
    startDateObj.setHours(0, 0, 0, 0); // Start of day

    const endDateObj = new Date(endDate);
    endDateObj.setHours(23, 59, 59, 999); // End of day

    const results: { title: string; content: string }[] = [];

    for (const meeting of eligibleMeetings) {
      const sessionContent = extractSessionsInDateRange(meeting.content, startDateObj, endDateObj);
      if (sessionContent.trim()) {
        results.push({
          title: meeting.title,
          content: sessionContent
        });
      }
    }

    return results;
  }, [eligibleMeetings, startDate, endDate]);

  // Count total sessions found
  const sessionCount = useMemo(() => {
    return filteredContent.reduce((count, item) => {
      // Count the number of date separators + 1 for the content
      const separators = (item.content.match(/\n\n---\n\n/g) || []).length;
      return count + separators + 1;
    }, 0);
  }, [filteredContent]);

  const handleExtract = async () => {
    if (filteredContent.length === 0) {
      setError('No new sessions found in the selected date range. Sessions are identified by date headers (e.g., "1/10/2025") in your meeting content.');
      return;
    }

    setLoading(true);
    setError(null);
    setExtractedContent(null);

    try {
      const extracted = await extractMemoryBankContent(filteredContent);
      setExtractedContent(extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!extractedContent) return;

    setSaving(true);
    setError(null);

    try {
      let finalContent: string;

      // If Memory Bank has been updated before, merge new content with existing
      // Check lastUpdateTimestamp to determine if there's meaningful existing content
      const shouldMerge = memoryBankConfig.lastUpdateTimestamp > 0;

      if (shouldMerge && memoryBankMeeting?.content) {
        // Strip HTML from existing content for merging
        // Also remove the header, update history section to focus on the actual content
        const existingContent = memoryBankMeeting.content;
        const plainExisting = existingContent
          .replace(/<img[^>]*>/gi, '') // Remove images
          .replace(/<h1>Memory Bank<\/h1>/gi, '') // Remove title
          .replace(/<p><em>Last updated:.*?<\/em><\/p>/gi, '') // Remove last updated line
          .replace(/<hr>/gi, '') // Remove horizontal rules
          .replace(/<h3>Update History<\/h3>[\s\S]*$/i, '') // Remove update history section
          .replace(/<[^>]*>/g, '') // Strip remaining HTML tags
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (plainExisting.length > 50) {
          finalContent = await mergeMemoryBankContent(plainExisting, extractedContent);
        } else {
          finalContent = extractedContent;
        }
      } else {
        finalContent = extractedContent;
      }

      onUpdateMemoryBank(finalContent, sessionCount);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Memory Bank');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // If no Memory Bank exists, show create screen
  if (!memoryBankMeeting) {
    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onKeyDown={handleKeyDown}
      >
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Create Memory Bank</h2>
            <p className="text-gray-600 mb-6">
              The Memory Bank stores critical information extracted from your meeting notes:
              decisions, goals, insights, and key data points.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={onCreateMemoryBank}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Create Memory Bank
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-800">Update Memory Bank</h2>
            </div>
            <div className="text-sm text-gray-500">
              <span className="bg-gray-100 px-2 py-1 rounded">Esc</span> close
            </div>
          </div>
          {memoryBankConfig.lastUpdateTimestamp > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {new Date(memoryBankConfig.lastUpdateTimestamp).toLocaleString()}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Date Range Selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Calendar className="w-4 h-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border-gray-300"
              />
              <label className="text-sm font-medium text-gray-700">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 border-gray-300"
              />
            </div>
            <p className="text-sm text-gray-500">
              {sessionCount} session{sessionCount !== 1 ? 's' : ''} found from {filteredContent.length} meeting{filteredContent.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Extract Button */}
          {!extractedContent && !loading && (
            <button
              onClick={handleExtract}
              disabled={filteredContent.length === 0}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Brain className="w-5 h-5" />
              Extract Critical Information
            </button>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
              <span className="ml-3 text-gray-600">Analyzing {sessionCount} sessions from {filteredContent.length} meetings...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Error</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Preview */}
          {extractedContent && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">Preview Extracted Content</h3>
                <button
                  onClick={() => setExtractedContent(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear & Re-extract
                </button>
              </div>
              <div className="border rounded-lg p-4 bg-gray-50 max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                  {extractedContent}
                </pre>
              </div>
            </div>
          )}

          {/* Success State */}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-800">Memory Bank updated successfully!</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-end items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          {extractedContent && (
            <button
              onClick={handleSave}
              disabled={saving || success}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save to Memory Bank'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
