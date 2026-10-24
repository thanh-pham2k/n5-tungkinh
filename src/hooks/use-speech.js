'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createSpeechUrl, playAudio, wait } from '../services/audio-service';
export default function useSpeech(settings) {
  const current = useRef(null);
  const audioRef = useRef(null);
  const [state, setState] = useState({ phase: 'idle', index: -1, error: '' });
  const stop = useCallback(() => {
    current.current?.abort();
    current.current = null;
    setState({ phase: 'idle', index: -1, error: '' });
  }, []);
  useEffect(() => () => current.current?.abort(), []);
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.volume / 100;
      audioRef.current.playbackRate = settings.rate;
    }
  }, [settings.volume, settings.rate]);
  useEffect(() => {
    stop();
  }, [settings.language, stop]);
  const play = useCallback(
    async (segments) => {
      current.current?.abort();
      const controller = new AbortController();
      current.current = controller;
      const audio = new Audio();
      audioRef.current = audio;
      try {
        for (const segment of segments) {
          if (!segment.text || segment.count === 0) continue;
          setState({ phase: 'loading', index: segment.index ?? 0, error: '' });
          const url = await createSpeechUrl(
            segment.text,
            segment.language || settings.language,
            controller.signal,
          );
          for (let repeat = 0; repeat < (segment.count ?? settings.repeats); repeat++) {
            setState({ phase: 'playing', index: segment.index ?? 0, error: '' });
            await playAudio(audio, url, settings, controller.signal);
            await wait(settings.delay * 1000, controller.signal);
          }
        }
        if (current.current === controller) setState({ phase: 'idle', index: -1, error: '' });
      } catch (error) {
        if (!controller.signal.aborted)
          setState((s) => ({
            ...s,
            phase: 'error',
            error: error.message || 'Không phát được audio.',
          }));
      }
    },
    [settings],
  );
  return { ...state, play, stop, busy: state.phase === 'playing' || state.phase === 'loading' };
}
