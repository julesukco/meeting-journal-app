import React, { useState } from 'react';

interface Reminder {
  id: string;
  text: string;
}

interface RemindersProps {
  reminders: Reminder[];
  onAddReminder: (text: string) => void;
  onDeleteReminder: (id: string) => void;
}

export const Reminders: React.FC<RemindersProps> = ({
  reminders,
  onAddReminder,
  onDeleteReminder,
}) => {
  const [newReminder, setNewReminder] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newReminder.trim()) {
      onAddReminder(newReminder.trim());
      setNewReminder('');
    }
  };

  return (
    <div className="p-4 border-t border-gray-200">
      <h2 className="text-lg font-semibold mb-4">Reminders</h2>
      
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newReminder}
            onChange={(e) => setNewReminder(e.target.value)}
            placeholder="Add a reminder..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Add
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <span className="text-gray-700">{reminder.text}</span>
            <button
              onClick={() => onDeleteReminder(reminder.id)}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}; 