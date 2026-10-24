'use client';
import { useEffect, useState } from 'react';
import { readCatalog } from '../services/study-library-client';
export default function usePracticeData(enabled = true) {
  const [state, setState] = useState({ data: null, error: '' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    readCatalog('ielts')
      .then((data) => {
        if (active) setState({ data, error: '' });
      })
      .catch((error) => {
        if (active) setState({ data: null, error: error.message });
      });
    return () => {
      active = false;
    };
  }, [enabled]);
  return state;
}
