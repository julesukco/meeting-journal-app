import React, { useState, useEffect } from 'react';
import { ActionItem } from '../types';
import { ActionItems } from './ActionItems';
import { Reminders } from './Reminders';
import { exportMeetings, importMeetings, getReminders, Reminder } from '../services/storage';

interface RightNavProps {
  isVisible: boolean;
  actionItems: ActionItem[];
  selectedMeetingId: string | undefined;
  onToggleComplete: (id: string) => void;
  onMeetingsImported?: () => void;
}

export const RightNav: React.FC<RightNavProps> = ({
  isVisible,
  actionItems,
  selectedMeetingId,
  onToggleComplete,
  onMeetingsImported,
}) => {
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // Load reminders on component mount
  useEffect(() => {
    const loadReminders = async () => {
      const loadedReminders = await getReminders();
      setReminders(loadedReminders);
    };
    loadReminders();
  }, []);

  // Save reminders whenever they change
  useEffect(() => {
    localStorage.setItem('reminders', JSON.stringify(reminders));
  }, [reminders]);

  const handleAddReminder = (text: string) => {
    const newReminder: Reminder = {
      id: Date.now().toString(),
      text,
    };
    setReminders((prev) => [...prev, newReminder]);
  };

  const handleDeleteReminder = (id: string) => {
    setReminders((prev) => prev.filter((reminder) => reminder.id !== id));
  };

  const handleExport = async () => {
    try {
      const jsonString = await exportMeetings();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'meetings.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export meetings');
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          await importMeetings(content);
          // Reload reminders after import
          const loadedReminders = await getReminders();
          setReminders(loadedReminders);
          alert('Meetings and reminders imported successfully');
          if (onMeetingsImported) onMeetingsImported();
        } catch {
          alert('Failed to import meetings and reminders');
        }
      };
      reader.readAsText(file);
    } catch {
      alert('Failed to import meetings and reminders');
    }
  };

  return (
    <div
      className={`transition-all duration-300 overflow-hidden bg-white border-l border-gray-200 flex flex-col ${
        isVisible ? 'w-64' : 'w-0'
      }`}
      style={{ minWidth: isVisible ? '16rem' : '0' }}
    >
      {isVisible && (
        <>
          <ActionItems
            items={actionItems}
            onToggleComplete={onToggleComplete}
          />
          <Reminders
            reminders={reminders}
            onAddReminder={handleAddReminder}
            onDeleteReminder={handleDeleteReminder}
          />
          <div className="flex space-x-2 p-4 mt-auto">
            <button
              onClick={handleExport}
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
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
};
