// Sound of Text is an external service. Cache successful requests for this session only.
const cache = new Map();
export const VOICES = Object.freeze({ en: 'en-US', ja: 'ja-JP', vi: 'vi-VN' });
// Keep requests comfortably below the provider's text limit, including for long sentences.
export function splitSpeechText(text, limit = 180) {
  const characters = Array.from(text.trim());
  const chunks = [];
  while (characters.length > limit) {
    const candidate = characters.slice(0, limit).join('');
    let boundary = -1;
    for (const match of candidate.matchAll(/[.!?。！？](?:[\s]|$)|\s/g)) {
      const end = Array.from(candidate.slice(0, match.index + match[0].length)).length;
      if (end >= limit / 2) boundary = end;
    }
    chunks.push(
      characters
        .splice(0, boundary > 0 ? boundary : limit)
        .join('')
        .trim(),
    );
  }
  const last = characters.join('').trim();
  if (last) chunks.push(last);
  return chunks.filter(Boolean);
}
export async function createSpeechUrl(text, language, signal) {
  if (!text?.trim()) throw new Error('Không có nội dung để phát.');
  if (!VOICES[language]) throw new Error('Ngôn ngữ audio không được hỗ trợ.');
  const key = `${language}:${text}`;
  if (cache.has(key)) return cache.get(key);
  const create = await fetch('https://api.soundoftext.com/sounds', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ engine: 'Google', data: { text, voice: VOICES[language] } }),
  });
  if (!create.ok) throw new Error(`Dịch vụ audio không phản hồi (${create.status}).`);
  const { id } = await create.json();
  if (!id) throw new Error('Dịch vụ không trả về mã audio.');
  for (let attempt = 0; attempt < 30; attempt++) {
    signal?.throwIfAborted();
    const response = await fetch(`https://api.soundoftext.com/sounds/${id}`, { signal });
    if (!response.ok) throw new Error(`Không lấy được audio (${response.status}).`);
    const result = await response.json();
    if (result.status === 'Done' && result.location) {
      cache.set(key, result.location);
      return result.location;
    }
    if (result.status === 'Error') throw new Error('Không tạo được audio. Hãy thử lại.');
    await wait(700, signal);
  }
  throw new Error('Tạo audio quá lâu. Hãy thử lại.');
}
export function wait(delayMs, signal) {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, delayMs);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export function playAudio(audio, url, settings, signal) {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const cleanup = () => {
      audio.onended = null;
      audio.onerror = null;
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      audio.pause();
      reject(signal.reason);
    };
    audio.onended = () => {
      cleanup();
      resolve();
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error('Không phát được audio. Hãy thử lại.'));
    };
    signal.addEventListener('abort', abort, { once: true });
    audio.src = url;
    audio.volume = settings.volume / 100;
    audio.playbackRate = settings.rate;
    audio.play().catch((error) => {
      cleanup();
      reject(error);
    });
  });
}
