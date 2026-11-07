'use client';
import { useEffect, useRef, useState } from 'react';

export default function SelectionSpeech({ speech, onSave }) {
  const [selection, setSelection] = useState(null);
  const speechRef = useRef(speech);
  const savedButtons = useRef([]);
  speechRef.current = speech;

  useEffect(() => {
    function updateSelection() {
      const current = window.getSelection();
      const lesson = document.getElementById('lesson-output');
      if (
        !current ||
        current.isCollapsed ||
        !lesson?.contains(current.anchorNode) ||
        !lesson.contains(current.focusNode)
      ) {
        setSelection(null);
        return;
      }
      const text = current.toString().trim();
      if (!text) {
        setSelection(null);
        return;
      }
      const rect = current.getRangeAt(0).getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - 52, rect.right - 44));
      const top =
        rect.top >= 52 ? rect.top - 52 : Math.min(window.innerHeight - 52, rect.bottom + 8);
      setSelection({ text, left, top, range: current.getRangeAt(0).cloneRange() });
    }
    function dismiss() {
      setSelection(null);
    }
    document.addEventListener('selectionchange', updateSelection);
    window.addEventListener('resize', dismiss);
    document.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('selectionchange', updateSelection);
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('scroll', dismiss, true);
      savedButtons.current.forEach(({ button }) => button.remove());
      savedButtons.current = [];
    };
  }, []);

  if (!selection) return null;
  return (
    <button
      type="button"
      className="button selection-speech-button"
      style={{ left: selection.left, top: selection.top }}
      aria-label="Nghe đoạn đã chọn"
      title="Nghe đoạn đã chọn"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        const language = /[\u3040-\u30ff\u3400-\u9fff]/u.test(selection.text) ? 'ja' : 'en';
        onSave({ text: selection.text, language });
        const range = selection.range;
        const endElement =
          range.endContainer.nodeType === Node.ELEMENT_NODE
            ? range.endContainer
            : range.endContainer.parentElement;
        const anchor = endElement?.closest('button, a, label, input, textarea, select');
        const parent = anchor?.parentElement || endElement;
        const exists = savedButtons.current.some(
          (entry) =>
            entry.button.isConnected && entry.parent === parent && entry.text === selection.text,
        );
        if (parent && !exists && document.getElementById('lesson-output')?.contains(parent)) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'button saved-selection-speech-button';
          button.setAttribute('aria-label', `Nghe lại: ${selection.text}`);
          button.title = 'Nghe lại đoạn này';
          button.textContent = '🔊';
          button.addEventListener('click', () =>
            speechRef.current.play([{ text: selection.text, language, count: 1 }]),
          );
          if (anchor) anchor.after(button);
          else {
            const insertion = range.cloneRange();
            insertion.collapse(false);
            insertion.insertNode(button);
          }
          savedButtons.current.push({ button, parent, text: selection.text });
        }
        speech.play([{ text: selection.text, language, count: 1 }]);
      }}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}
