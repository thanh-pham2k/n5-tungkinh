'use client';
import { useState } from 'react';
import useAuth from '../hooks/use-auth';
import LoginView from './auth/login-view';
import { Button, Status } from './ui/primitives';

const SKILLS = [
  { id: 'reading', name: 'Reading', description: 'Đọc theo chủ đề' },
  { id: 'listening', name: 'Listening', description: 'Luyện nghe tiếng Anh' },
  { id: 'speaking', name: 'Speaking', description: 'Luyện nói theo tình huống' },
  { id: 'writing', name: 'Writing', description: 'Luyện viết và tự đối chiếu' },
];

export default function EnglishSkills() {
  const { user, loading, setUser } = useAuth();
  const [selected, setSelected] = useState(null);
  if (loading) return <Status>Đang kiểm tra phiên đăng nhập…</Status>;
  if (!user) return <LoginView onLoginSuccess={setUser} />;
  const skill = SKILLS.find((item) => item.id === selected);
  return (
    <main className="english-skills-page">
      {skill ? (
        <Button onClick={() => setSelected(null)}>← English Skills</Button>
      ) : (
        <a className="button" href={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`}>
          ← Công cụ học
        </a>
      )}
      <p className="eyebrow">ENGLISH SKILLS</p>
      {skill ? (
        <>
          <h1>{skill.name}</h1>
          <p>{skill.description}</p>
          <section
            className="english-skills-empty"
            aria-label={skill.id === 'reading' ? 'Chủ đề đọc' : 'Bài học'}
          >
            <h2>{skill.id === 'reading' ? 'Chủ đề đọc' : 'Bài học'}</h2>
            <p>{skill.id === 'reading' ? 'Chưa có chủ đề đọc.' : 'Chưa có bài học.'}</p>
          </section>
        </>
      ) : (
        <>
          <h1>Luyện bốn kỹ năng</h1>
          <p>Chọn kỹ năng để học.</p>
          <div className="english-skills-list">
            {SKILLS.map((item) => (
              <button
                className="english-skills-item"
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
              >
                <span>
                  <strong>{item.name}</strong>
                  <br />
                  {item.description}
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
