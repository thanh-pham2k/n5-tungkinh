'use client';
import { useRef, useState } from 'react';
import { createLesson, studyRequest } from '../services/study-library-client';
export default function useStudyLibrary(tool) {
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const current = useRef(null),
    attempts = useRef(new Map()),
    queue = useRef(Promise.resolve());
  function restore(record) {
    current.current = record;
    setLesson(record);
    setError('');
  }
  async function save(source, language = 'en') {
    const key = JSON.stringify([tool, source, language]);
    if (!attempts.current.has(key)) attempts.current.set(key, crypto.randomUUID());
    setSaving(true);
    setError('');
    try {
      const record = await createLesson({
        tool,
        source,
        language,
        requestId: attempts.current.get(key),
      });
      attempts.current.delete(key);
      restore(record);
      return record;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  }
  function updateProgress(patch) {
    const id = current.current?.id;
    if (!id) return Promise.reject(new Error('Hãy nạp và lưu bài trước.'));
    const next = queue.current
      .catch(() => {})
      .then(async () => {
        if (current.current?.id !== id) return;
        const record = current.current;
        const progress = { ...record.progress, ...patch };
        try {
          const result = await studyRequest(`/study-contents/${id}/progress`, {
            method: 'PUT',
            body: JSON.stringify({ version: record.version, progress }),
          });
          if (current.current?.id === id) {
            current.current = {
              ...record,
              progress: result.data.progress,
              version: result.data.version,
            };
            setLesson(current.current);
            setError('');
          }
        } catch (e) {
          setError(e.message);
          throw e;
        }
      });
    queue.current = next;
    return next;
  }
  return { lesson, error, saving, save, restore, updateProgress };
}
