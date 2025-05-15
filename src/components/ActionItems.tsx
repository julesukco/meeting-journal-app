import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { ActionItem } from '../types';

interface ActionItemsProps {
  items: ActionItem[];
  onToggleComplete: (id: string) => void;
}

export function ActionItems({ items, onToggleComplete }: ActionItemsProps) {
  return (
    <div className="bg-gray-50 border-l border-gray-200 w-64 p-4 h-screen overflow-y-auto">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-2 p-2 hover:bg-gray-100 rounded-lg mb-2"
        >
          <button
            onClick={() => onToggleComplete(item.id)}
            className="mt-1 flex-shrink-0"
          >
            {item.completed ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <Circle className="w-5 h-5 text-gray-400" />
            )}
          </button>
          <div className={item.completed ? 'line-through text-gray-500' : ''}>
            {item.text}
          </div>
        </div>
      ))}
    </div>
  );
}