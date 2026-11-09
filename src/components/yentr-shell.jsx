'use client';
import { useState } from 'react';
import { Button, Dialog } from './ui/primitives';
import useAuth from '../hooks/use-auth';
import LoginView from './auth/login-view';

export default function YentrShell({ currentTab, onLogout, children }) {
  const { user, loading, setUser, logout } = useAuth();
  const [menu, setMenu] = useState(false);

  if (loading) return null;
  if (!user) return <LoginView onLoginSuccess={setUser} />;
  if (user.username !== 'yentr') {
    return (
      <main className="foundation-page">
        <p className="status-error" role="alert">
          Bạn không có quyền xem mục này.
        </p>
      </main>
    );
  }

  const handleLogout = onLogout || logout;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  const nav = (
    <div className="nav-group">
      <span className="eyebrow">Khóa học</span>
      <a
        className={`nav-item ${currentTab === 'toeic' ? 'is-current' : ''}`}
        href={`${basePath}/toeic-600/`}
      >
        <span aria-hidden="true">📚</span>
        600 từ vựng TOEIC
        {currentTab === 'toeic' && (
          <span className="nav-arrow" aria-hidden="true">
            ↗
          </span>
        )}
      </a>
      <a
        className={`nav-item ${currentTab === 'french' ? 'is-current' : ''}`}
        href={`${basePath}/french/`}
      >
        <span aria-hidden="true">🇫🇷</span>
        Tiếng Pháp A1–A2
        {currentTab === 'french' && (
          <span className="nav-arrow" aria-hidden="true">
            ↗
          </span>
        )}
      </a>
    </div>
  );

  return (
    <div className="app-shell">
      <a className="skip-link" href="#study-content">
        Đến nội dung học
      </a>
      <aside className="sidebar">
        <a className="brand" href={`${basePath}/`}>
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
            onClick={handleLogout}
            aria-label="Thoát tài khoản"
          >
            Đăng xuất
          </Button>
        </div>
        <p className="sidebar-note">
          English · Français
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
            Khóa học <span aria-hidden="true">/</span>{' '}
            {currentTab === 'french' ? 'Tiếng Pháp A1–A2' : '600 từ vựng TOEIC'}
          </span>
          <div className="header-actions">
            <Button
              className="mobile-menu"
              onClick={() => setMenu(true)}
              aria-label="Đổi công cụ học"
            >
              ☰ Công cụ
            </Button>
            <span className="user-chip" title={`Tài khoản: ${user.name}`}>
              <span aria-hidden="true">👤</span> {user.name}
            </span>
            <Button
              className="button-logout"
              onClick={handleLogout}
              style={{ display: 'inline-flex' }}
            >
              Đăng xuất
            </Button>
          </div>
        </header>
        <main id="study-content" tabIndex={-1}>
          {children}
        </main>
      </div>
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
              handleLogout();
            }}
            aria-label="Thoát tài khoản"
          >
            Đăng xuất
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
