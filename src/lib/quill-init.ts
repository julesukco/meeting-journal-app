import { Quill } from 'react-quill';
import ImageResize from 'quill-image-resize-module-react';

let isInitialized = false;

export function initializeQuillModules() {
  if (typeof window === 'undefined' || isInitialized) {
    return;
  }

  try {
    // Try to get the module - if it throws, it's not registered
    Quill.import('modules/imageResize');
  } catch {
    // Module not registered, so register it
    Quill.register('modules/imageResize', ImageResize);
  }

  isInitialized = true;
} 