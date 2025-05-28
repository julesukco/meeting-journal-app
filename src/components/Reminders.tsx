import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { Plus } from 'lucide-react';

interface Reminder {
  id: string;
  text: string;
}

interface RemindersProps {
  reminders: Reminder[];
  onAddReminder: (text: string) => void;
  onDeleteReminder: (id: string) => void;
  onUpdateReminder?: (id: string, newText: string) => void;
}

export interface RemindersHandle {
  triggerAddReminder: () => void;
}

export const Reminders = forwardRef<RemindersHandle, RemindersProps>(
  ({ reminders, onAddReminder, onDeleteReminder, onUpdateReminder }, ref) => {
    const [newReminder, setNewReminder] = useState('');
    const [showInput, setShowInput] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState('');

    useImperativeHandle(ref, () => ({
      triggerAddReminder: () => setShowInput(true),
    }));

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (newReminder.trim()) {
        onAddReminder(newReminder.trim());
        setNewReminder('');
        setShowInput(false);
      }
    };

    return (
      <div className="p-4 border-t border-gray-200">
        {showInput && (
          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newReminder}
                onChange={(e) => setNewReminder(e.target.value)}
                placeholder="Add a reminder..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowInput(false);
                    setNewReminder('');
                  }
                }}
              />
              <button
                type="submit"
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowInput(false); setNewReminder(''); }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              {editingId === reminder.id ? (
                <input
                  type="text"
                  value={editingText}
                  onChange={e => setEditingText(e.target.value)}
                  onBlur={() => { setEditingId(null); setEditingText(''); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && editingText.trim()) {
                      e.preventDefault();
                      onUpdateReminder?.(reminder.id, editingText.trim());
                      setEditingId(null);
                      setEditingText('');
                    } else if (e.key === 'Escape') {
                      setEditingId(null);
                      setEditingText('');
                    }
                  }}
                  className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm mr-2"
                  autoFocus
                />
              ) : (
                <span
                  className="text-gray-700 flex-1 cursor-pointer"
                  onDoubleClick={() => { setEditingId(reminder.id); setEditingText(reminder.text); }}
                  title="Double-click to edit"
                >
                  {reminder.text}
                </span>
              )}
              <button
                onClick={() => onDeleteReminder(reminder.id)}
                className="text-gray-400 hover:text-red-500 transition-colors ml-2"
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
  }
); 