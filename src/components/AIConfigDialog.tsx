import React, { useState, useEffect, useRef } from 'react';
import { AIConfig } from '../types';
import { getAIConfig, saveAIConfig } from '../services/ai';

interface AIConfigDialogProps {
  onClose: () => void;
}

export const AIConfigDialog: React.FC<AIConfigDialogProps> = ({ onClose }) => {
  const [config, setConfig] = useState<AIConfig>({
    apiKey: '',
    apiEndpoint: '',
    systemPrompt: '',
  });
  const [activeField, setActiveField] = useState<'apiKey' | 'apiEndpoint' | 'systemPrompt'>('apiKey');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const apiEndpointRef = useRef<HTMLInputElement>(null);
  const systemPromptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const storedConfig = await getAIConfig();
        setConfig(storedConfig);
      } catch (error) {
        console.error('Error loading AI config:', error);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  useEffect(() => {
    // Focus on API key field when dialog opens
    if (!loading) {
      apiKeyRef.current?.focus();
    }
  }, [loading]);

  const handleSave = async () => {
    try {
      await saveAIConfig(config);
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Error saving AI config:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Tab':
        e.preventDefault();
        // Cycle through fields
        if (activeField === 'apiKey') {
          setActiveField('apiEndpoint');
          apiEndpointRef.current?.focus();
        } else if (activeField === 'apiEndpoint') {
          setActiveField('systemPrompt');
          systemPromptRef.current?.focus();
        } else {
          setActiveField('apiKey');
          apiKeyRef.current?.focus();
        }
        break;
      case 'Enter':
        // Save on Ctrl+Enter or Cmd+Enter
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleSave();
        }
        break;
      case 's':
        // Save on Ctrl+S
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleSave();
        }
        break;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-800">AI Configuration</h2>
            <div className="text-sm text-gray-500">
              <span className="bg-gray-100 px-2 py-1 rounded mr-2">Tab</span> navigate
              <span className="bg-gray-100 px-2 py-1 rounded mx-2">Ctrl+S</span> save
              <span className="bg-gray-100 px-2 py-1 rounded ml-2">Esc</span> close
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key
            </label>
            <input
              ref={apiKeyRef}
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              onFocus={() => setActiveField('apiKey')}
              placeholder="Enter your API key"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                activeField === 'apiKey' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300'
              }`}
            />
            <p className="mt-1 text-xs text-gray-500">Your API key will be stored locally</p>
          </div>

          {/* API Endpoint */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Endpoint
            </label>
            <input
              ref={apiEndpointRef}
              type="text"
              value={config.apiEndpoint}
              onChange={(e) => setConfig({ ...config, apiEndpoint: e.target.value })}
              onFocus={() => setActiveField('apiEndpoint')}
              placeholder="https://api.example.com/ai"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                activeField === 'apiEndpoint' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300'
              }`}
            />
            <p className="mt-1 text-xs text-gray-500">The AI API endpoint URL (POST request with 'prompt' parameter)</p>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              System Prompt
            </label>
            <textarea
              ref={systemPromptRef}
              value={config.systemPrompt}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              onFocus={() => setActiveField('systemPrompt')}
              placeholder="Enter a system prompt to guide AI responses..."
              rows={4}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 resize-none ${
                activeField === 'systemPrompt' ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300'
              }`}
            />
            <p className="mt-1 text-xs text-gray-500">
              This prompt will be prepended to every AI request to guide the response format
            </p>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end items-center gap-3">
          {saved && (
            <span className="text-green-600 text-sm">Settings saved!</span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
