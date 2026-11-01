'use client';
import { useEffect, useRef } from 'react';

export default function useStudyNavigation(active, onPrevious, onNext) {
  const actions = useRef({ onPrevious, onNext });
  actions.current = { onPrevious, onNext };
  useEffect(() => {
    if (!active) return;
    function handleKey(event) {
      const target = event.target;
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        document.querySelector('dialog[open]') ||
        target.isContentEditable ||
        target.closest(
          'textarea, select, input:not([type="radio"]):not([type="checkbox"]), [contenteditable="true"]',
        ) ||
        (target !== document.body && !target.closest('#study-content'))
      )
        return;
      const key = event.key.toLowerCase();
      if (key === 'a' || key === 'd') {
        event.preventDefault();
        if (key === 'a') actions.current.onPrevious();
        else actions.current.onNext();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active]);
}
