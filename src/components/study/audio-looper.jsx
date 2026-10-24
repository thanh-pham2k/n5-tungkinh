'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, MoreActions, RubyText, Status } from '../ui/primitives';
export default function AudioLooper({ settings, active }) {
  const audio = useRef(null),
    localUrl = useRef('');
  const [lessons, setLessons] = useState([]),
    [lessonIndex, setLessonIndex] = useState(0),
    [trackIndex, setTrackIndex] = useState(-1),
    [source, setSource] = useState(''),
    [localName, setLocalName] = useState(''),
    [status, setStatus] = useState('Chọn file audio trên thiết bị hoặc bài public để bắt đầu.'),
    [error, setError] = useState(''),
    [repeats, setRepeats] = useState(5),
    [completed, setCompleted] = useState(0),
    [mode, setMode] = useState('sequential'),
    [speed, setSpeed] = useState(1),
    [full, setFull] = useState(false);
  const lesson = lessons[lessonIndex],
    track = localName ? undefined : lesson?.tracks[trackIndex];
  useEffect(() => {
    let disposed = false;
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/data/lesson-mapper.json`)
      .then((response) => {
        if (!response.ok)
          throw new Error('Không tải được danh mục audio public. Bạn vẫn có thể chọn file local.');
        return response.json();
      })
      .then((payload) => {
        if (!disposed) setLessons(payload.lessons || []);
      })
      .catch((e) => {
        if (!disposed) setError(e.message);
      });
    return () => {
      disposed = true;
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    };
  }, []);
  useEffect(() => {
    if (audio.current) {
      audio.current.playbackRate = speed;
      audio.current.volume = settings.volume / 100;
    }
  }, [speed, settings.volume, source]);
  useEffect(() => {
    if (!active) audio.current?.pause();
  }, [active]);
  async function play() {
    if (!source) {
      setError('Vui lòng chọn audio trước.');
      return;
    }
    try {
      audio.current.playbackRate = speed;
      await audio.current.play();
      setError('');
      setStatus(`Đang phát: ${localName || track?.label}`);
    } catch {
      setError('Không phát được audio. Kiểm tra file hoặc nhấn Phát để thử lại.');
    }
  }
  function selectTrack(index, nextLesson = lessonIndex) {
    const next = lessons[nextLesson]?.tracks[index];
    if (!next) return;
    if (localUrl.current) {
      URL.revokeObjectURL(localUrl.current);
      localUrl.current = '';
    }
    setLocalName('');
    setTrackIndex(index);
    setLessonIndex(nextLesson);
    setSource(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${next.src}`);
    setCompleted(0);
    setError('');
    setStatus(`Đã chọn: ${next.label}. Nhấn Phát để nghe.`);
  }
  function ended() {
    if (localName || completed + 1 < repeats) {
      setCompleted(completed + 1);
      audio.current.currentTime = 0;
      play();
      return;
    }
    const tracks = lesson?.tracks || [];
    if (!tracks.length) return;
    const nextIndex =
      mode === 'random' && tracks.length > 1
        ? (trackIndex + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length
        : (trackIndex + 1) % tracks.length;
    selectTrack(nextIndex);
    audio.current.src = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/${tracks[nextIndex].src}`;
    audio.current.playbackRate = speed;
    audio.current.play().catch(() => setError('Nhấn Phát để tiếp tục nhóm mới.'));
  }
  const vocabulary = (
    <ol className="looper-vocabulary">
      {track?.items.map((item, index) => (
        <li key={index}>
          <strong>
            <RubyText text={item.japanese} />
          </strong>
          <span>{item.vietnamese}</span>
        </li>
      ))}
    </ol>
  );
  return (
    <div className="study-panel">
      <article className="study-card">
        <label className="field">
          Audio trên thiết bị
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              audio.current?.pause();
              if (localUrl.current) URL.revokeObjectURL(localUrl.current);
              localUrl.current = URL.createObjectURL(file);
              setSource(localUrl.current);
              setLocalName(file.name);
              setCompleted(0);
              setError('');
              setStatus(`Đã chọn ${file.name}. Nhấn Phát để nghe lặp.`);
            }}
          />
        </label>
        <p className="helper">File local được phát trên thiết bị, không tải lên server.</p>
      </article>
      <div className="audio-deck">
        <audio
          ref={audio}
          controls
          src={source || undefined}
          onEnded={ended}
          onError={() =>
            setError('Không đọc được file audio. Hãy chọn file khác hoặc kiểm tra kết nối.')
          }
        />
        <div className="action-wrap">
          <Button variant="primary" onClick={play}>
            ▶ Phát
          </Button>
          <Button
            onClick={() => {
              audio.current?.pause();
              setStatus('Đã tạm dừng.');
            }}
          >
            Ⅱ Tạm dừng
          </Button>
          <Button
            disabled={!source}
            onClick={() => {
              audio.current.currentTime = 0;
              setCompleted(0);
              play();
            }}
          >
            ↻ Từ đầu
          </Button>
        </div>
        <Status>
          {status}
          {source ? ` · Đã lặp ${completed} lần` : ''}
        </Status>
      </div>
      <MoreActions title="Tốc độ & vòng lặp">
        <label className="field">
          Tốc độ
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Lặp trước khi chuyển nhóm
          <input
            type="number"
            min="1"
            step="1"
            value={repeats}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isSafeInteger(value) && value > 0) setRepeats(value);
            }}
          />
        </label>
        <label className="field">
          Chuyển nhóm
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="sequential">Tuần tự</option>
            <option value="random">Ngẫu nhiên</option>
          </select>
        </label>
      </MoreActions>
      <Status error>{error}</Status>
      <div>
        <h2>Thư viện audio public</h2>
        {lessons.length ? (
          <>
            <label className="field">
              Bài học
              <select value={lessonIndex} onChange={(e) => selectTrack(0, Number(e.target.value))}>
                {lessons.map((lesson, index) => (
                  <option value={index} key={lesson.id || index}>
                    {lesson.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="word-bank">
              {lesson?.tracks.map((track, index) => (
                <Button
                  key={index}
                  variant={!localName && index === trackIndex ? 'primary' : 'secondary'}
                  onClick={() => selectTrack(index)}
                >
                  {track.label}
                </Button>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">
            Checkout hiện chưa có file audio public. Chọn file local để sử dụng; thư viện sẽ xuất
            hiện khi có MP3 được tạo từ dữ liệu nguồn.
          </p>
        )}
      </div>
      {track && (
        <article className="study-card">
          <div className="card-top">
            <h2>Từ / câu trong nhóm</h2>
            <Button onClick={() => setFull(true)}>Xem đầy đủ</Button>
          </div>
          {vocabulary}
        </article>
      )}
      <Dialog open={full} onClose={() => setFull(false)} title={track?.label || 'Danh sách từ'}>
        {vocabulary}
      </Dialog>
    </div>
  );
}
