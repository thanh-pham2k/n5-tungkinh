'use client';
import { useCallback, useEffect, useState } from 'react';
import { Button, Dialog, Status } from './ui/primitives';
import InstantVocab from './study/instant-vocab';
import VocabReview from './study/vocab-review';
import WordOrder from './study/word-order';
import { SentenceStructures, SpeakingQuestions } from './study/reference-panels';
import WritingReview from './study/writing-review';
import MultipleChoice from './study/multiple-choice';
import LoginView from './auth/login-view';
import useAuth from '../hooks/use-auth';
import { createLesson } from '../services/study-library-client';
import { serializeCsv } from '../services/answer-service';

export const TOOLS = Object.freeze([
  {
    id: 'instant',
    name: 'Instant Vocab',
    description: 'Đọc, nghe, nhớ thêm một từ.',
    group: 'Từ vựng',
    icon: 'ϟ',
  },
  {
    id: 'cards',
    name: 'Vocab Review',
    description: 'Lật thẻ. Gợi nhớ. Luyện lại.',
    group: 'Từ vựng',
    icon: '▱',
  },
  {
    id: 'order',
    name: 'Word Order',
    description: 'Ghép từng mảnh thành câu hoàn chỉnh.',
    group: 'Luyện câu',
    icon: '▦',
  },
  {
    id: 'typing',
    name: 'Typing Review',
    description: 'Gõ lại câu để nhớ cách diễn đạt.',
    group: 'Luyện câu',
    icon: '⌨',
  },
  {
    id: 'structures',
    name: 'Sentence Structures',
    description: 'Từ một mẫu câu đến cách dùng thực tế.',
    group: 'Luyện câu',
    icon: '↗',
  },
  {
    id: 'speaking',
    name: 'Speaking Questions',
    description: 'Một chủ đề. Nhiều điều để nói.',
    group: 'IELTS & Viết',
    icon: '◌',
  },
  {
    id: 'writing',
    name: 'Writing Review',
    description: 'Viết câu trả lời, tự đối chiếu bài mẫu.',
    group: 'IELTS & Viết',
    icon: '✎',
  },
  {
    id: 'hot',
    name: 'Multiple Choice',
    description: 'Ôn nhanh bằng câu hỏi trắc nghiệm.',
    group: 'Ôn tập',
    icon: '✳',
  },
]);
const DEFAULT_SETTINGS = {
  language: 'en',
  rate: 1,
  volume: 100,
  vietnameseRepeats: 0,
  repeats: 3,
  delay: 0.5,
};
export default function StudyApp() {
  const { user, loading: authLoading, logout, setUser } = useAuth();
  const [tool, setTool] = useState('instant'),
    [focus, setFocus] = useState(false),
    [menu, setMenu] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [settings, setSettings] = useState(DEFAULT_SETTINGS),
    [exerciseSet, setExerciseSet] = useState(null);
  const [showTop, setShowTop] = useState(false);
  const current = TOOLS.find((item) => item.id === tool);
  const updateSettings = useCallback(
    (patch) => setSettings((previous) => ({ ...previous, ...patch })),
    [],
  );
  useEffect(() => {
    try {
      const stored = localStorage.getItem('app-audio-volume');
      if (stored !== null && Number.isFinite(Number(stored)))
        updateSettings({ volume: Math.min(100, Math.max(0, Number(stored))) });
    } catch {}
  }, [updateSettings]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setFocus(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const update = () => setShowTop(window.scrollY > 500);
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);
  function navigate(id) {
    if (!TOOLS.some((item) => item.id === id)) return;
    setTool(id);
    setMenu(false);
    setFocus(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const props = { settings, updateSettings, setFocus };
  async function practice(exercises) {
    const source = serializeCsv([
      ['vocabulary', 'hiragana', 'meaning_vi', 'example_ja', 'example_vi', 'word_order'],
      ...exercises.map((exercise) => [
        exercise.sentence,
        '',
        exercise.meaning,
        exercise.sentence,
        exercise.meaning,
        exercise.chunks.join('|'),
      ]),
    ]);
    const record = await createLesson({
      tool: 'order',
      source,
      language: 'en',
      requestId: crypto.randomUUID(),
    });
    setExerciseSet(record);
    updateSettings({ language: 'en' });
    setTool('order');
    setFocus(true);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const nav = (
    <>
      {[...new Set(TOOLS.map((item) => item.group))].map((group) => (
        <div className="nav-group" key={group}>
          <span className="eyebrow">{group}</span>
          {TOOLS.filter((item) => item.group === group).map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${tool === item.id ? 'is-current' : ''}`}
              aria-current={tool === item.id ? 'page' : undefined}
              onClick={() => navigate(item.id)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.name}
              {tool === item.id && (
                <span className="nav-arrow" aria-hidden="true">
                  ↗
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
      <a
        className="nav-item"
        href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/markdown/?course=list`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span aria-hidden="true">✎</span>Tiếng Anh công việc · 30 ngày ↗
      </a>
      <a
        className="nav-item"
        href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/markdown/`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Markdown & Quiz (mở tab mới)"
      >
        <span aria-hidden="true">≡</span>Markdown & Quiz ↗
      </a>
    </>
  );

  if (authLoading) {
    return (
      <div className="login-screen">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <Status>Đang kiểm tra phiên đăng nhập…</Status>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={setUser} />;
  }

  return (
    <div className={`app-shell ${focus ? 'focus-mode' : ''}`}>
      <a className="skip-link" href="#study-content">
        Đến nội dung học
      </a>
      <aside className="sidebar">
        <a className="brand" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}>
          <span className="brand-mark" aria-hidden="true">
            言
          </span>
          <span>
            KOTOBA<span className="brand-lab"> LAB</span>
            <small>HỌC MỘT CHÚT. NHỚ THẬT LÂU.</small>
          </span>
        </a>
        <nav aria-label="Công cụ học">{nav}</nav>
        <div className="sidebar-user">
          <div className="user-profile">
            <span className="user-chip" aria-label={`Tài khoản ${user.username}`}>
              <span aria-hidden="true">👤</span> {user.name}
            </span>
          </div>
          <Button
            variant="secondary"
            className="button-logout"
            onClick={logout}
            aria-label="Đăng xuất"
          >
            Đăng xuất
          </Button>
        </div>
        <p className="sidebar-note">
          日本語 · English · IELTS
          <br />
          Không gian nhỏ cho những tiến bộ lớn.
        </p>
      </aside>
      <div className="app-workspace">
        <header className="app-header">
          <div className="mobile-brand">
            <span aria-hidden="true">言</span> KOTOBA LAB
          </div>
          <span className="header-context">
            {current.group} <span aria-hidden="true">/</span> {current.name}
          </span>
          <div className="header-actions">
            {!focus && (
              <Button
                className="mobile-menu"
                onClick={() => setMenu(true)}
                aria-label="Đổi công cụ học"
              >
                ☰ Công cụ
              </Button>
            )}
            <span className="user-chip" title={`Tài khoản: ${user.name}`}>
              <span aria-hidden="true">👤</span> {user.name}
            </span>
            <Button className="button-logout" onClick={logout} aria-label="Đăng xuất">
              Đăng xuất
            </Button>
            <Button onClick={() => setFocus(!focus)} aria-pressed={focus}>
              {focus ? '× Thoát Focus' : '⛶ Focus'}
            </Button>
            <Button onClick={() => setSettingsOpen(true)} aria-label="Cài đặt audio">
              ⚙
            </Button>
          </div>
        </header>
        <main id="study-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">{current.group} / Không gian học</p>
              <h1>
                {current.name}
                <span className="heading-dot" aria-hidden="true">
                  .
                </span>
              </h1>
              <p className="intro">{current.description}</p>
            </div>
            <span className="page-stamp" aria-hidden="true">
              {current.icon}
            </span>
          </div>
          <section hidden={tool !== 'instant'} aria-label="Instant Vocab">
            <InstantVocab {...props} active={tool === 'instant'} focus={focus} />
          </section>
          <section hidden={tool !== 'cards'} aria-label="Vocab Review">
            <VocabReview {...props} active={tool === 'cards'} />
          </section>
          <section
            hidden={!['order', 'typing'].includes(tool)}
            aria-label={tool === 'typing' ? 'Typing Review' : 'Word Order'}
          >
            <WordOrder
              {...props}
              typing={tool === 'typing'}
              active={['order', 'typing'].includes(tool)}
              exerciseSet={exerciseSet}
            />
          </section>
          <section hidden={tool !== 'structures'} aria-label="Sentence Structures">
            <SentenceStructures onPractice={practice} active={tool === 'structures'} />
          </section>
          <section hidden={tool !== 'speaking'} aria-label="Speaking Questions">
            <SpeakingQuestions active={tool === 'speaking'} />
          </section>
          <section hidden={tool !== 'writing'} aria-label="Writing Review">
            <WritingReview {...props} />
          </section>
          <section
            className={`tab-panel ${tool === 'hot' ? 'active' : ''}`}
            hidden={tool !== 'hot'}
            aria-label="Multiple Choice"
            id="multiple-choice-panel"
          >
            <MultipleChoice {...props} active={tool === 'hot'} />
          </section>
        </main>
        <footer className="app-footer">
          Từng từ một. Từng ngày một. <span>言語 & IELTS</span>
        </footer>
      </div>
      {showTop && (
        <Button
          className="back-to-top"
          aria-label="Về đầu trang"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
            })
          }
        >
          ↑
        </Button>
      )}
      <Dialog open={menu} onClose={() => setMenu(false)} title="Bạn muốn luyện gì?">
        {nav}
        <div
          className="mobile-user-actions"
          style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            borderTop: 'var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span className="user-chip">
            <span aria-hidden="true">👤</span> {user.name}
          </span>
          <Button
            className="button-logout"
            onClick={() => {
              setMenu(false);
              logout();
            }}
            aria-label="Đăng xuất khỏi tài khoản"
          >
            Đăng xuất
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Cài đặt audio"
        footer={
          <Button variant="primary" onClick={() => setSettingsOpen(false)}>
            Xong ✓
          </Button>
        }
      >
        <div className="settings-grid">
          <label className="field">
            Ngôn ngữ
            <select
              value={settings.language}
              onChange={(e) => updateSettings({ language: e.target.value })}
            >
              <option value="en">Tiếng Anh</option>
              <option value="ja">Tiếng Nhật</option>
            </select>
          </label>
          <label className="field">
            Tốc độ phát (×)
            <input
              type="number"
              min="0.5"
              max="3"
              step="0.05"
              value={settings.rate}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 0.5 && value <= 3) updateSettings({ rate: value });
              }}
            />
          </label>
          <label className="field">
            Âm lượng · {settings.volume}%
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={settings.volume}
              onChange={(e) => {
                const volume = Number(e.target.value);
                updateSettings({ volume });
                try {
                  localStorage.setItem('app-audio-volume', String(volume));
                } catch {}
              }}
            />
          </label>
          <label className="field">
            Số lần lặp tiếng Việt
            <input
              type="number"
              min="0"
              step="1"
              value={settings.vietnameseRepeats}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isSafeInteger(value) && value >= 0)
                  updateSettings({ vietnameseRepeats: value });
              }}
            />
          </label>
          <label className="field">
            Số lần lặp tiếng Anh / Nhật
            <input
              type="number"
              min="1"
              step="1"
              value={settings.repeats}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isSafeInteger(value) && value >= 1) updateSettings({ repeats: value });
              }}
            />
          </label>
          <label className="field">
            Nghỉ giữa lượt phát (giây)
            <input
              type="number"
              min="0"
              max="10"
              step="0.1"
              value={settings.delay}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value >= 0 && value <= 10) updateSettings({ delay: value });
              }}
            />
          </label>
        </div>
      </Dialog>
    </div>
  );
}
