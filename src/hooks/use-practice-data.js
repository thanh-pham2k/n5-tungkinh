'use client';
import { useEffect, useState } from 'react';
export default function usePracticeData(enabled = true) {
  const [state, setState] = useState({ data: null, error: '' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    import('../data/practice-data')
      .then((module) => {
        if (active) setState({ data: module.default, error: '' });
      })
      .catch(() => {
        if (active)
          setState({ data: null, error: 'Không tải được bộ bài IELTS. Hãy tải lại trang.' });
      });
    return () => {
      active = false;
    };
  }, [enabled]);
  return state;
}
