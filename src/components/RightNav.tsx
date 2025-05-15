import React, { useState, useEffect } from 'react';
import { ActionItem } from '../types';
import { ActionItems } from './ActionItems';
import { Reminders } from './Reminders';
import { getReminders, Reminder } from '../services/storage';

interface RightNavProps {
  actionItems: ActionItem[];
  onToggleActionItem: (id: string) => void;
  onExport: () => Promise<void>;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const RightNav: React.FC<RightNavProps> = ({
  actionItems,
  onToggleActionItem,
  onExport,
  onImport,
}) => {
  const REMINDERS_KEY = 'reminders';
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    const saved = localStorage.getItem(REMINDERS_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [showCompleted, setShowCompleted] = useState(false);

  // Save reminders whenever they change
  useEffect(() => {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
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

  return (
    <div className="w-64 bg-white border-l border-gray-200 flex flex-col h-screen">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="font-semibold text-lg">Action Items</span>
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
      <ActionItems
        items={showCompleted ? actionItems : actionItems.filter(item => !item.completed)}
        onToggleComplete={onToggleActionItem}
      />
      <Reminders
        reminders={reminders}
        onAddReminder={handleAddReminder}
        onDeleteReminder={handleDeleteReminder}
      />
      <div className="flex space-x-2 p-4 mt-auto">
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
