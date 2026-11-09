'use client';
import { useEffect, useState } from 'react';
import { Button, Dialog } from './ui/primitives';
import useAuth from '../hooks/use-auth';
import LoginView from './auth/login-view';
import { TOOLS } from './study-tools';

export default function YentrShell({
  currentTab,
  onLogout,
  onToolSelect,
  focus = false,
  contextGroup,
  contextLabel,
  headerActions,
  children,
}) {
  const { user, loading, setUser, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('kotoba_sidebar_collapsed') === 'true') {
        setCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('kotoba_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  if (loading) return null;
  if (!user) return <LoginView onLoginSuccess={setUser} />;
  if (['toeic', 'french'].includes(currentTab) && user.username !== 'yentr') {
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

  const links =
    user.username === 'yentr'
      ? [
          ['toeic', '📚', '600 từ vựng TOEIC', '/toeic-600/'],
          ['french', '🇫🇷', 'Tiếng Pháp A1–A2', '/french/'],
        ]
      : [
          ['eviu', '📚', 'EVIU', '/eviu/'],
          ['foundation', '📖', 'English Foundation', '/foundation/'],
          ['skills', '✦', 'English Skills', '/english-skills/'],
          ['work', '✎', 'Tiếng Anh công việc · 30 ngày', '/markdown/?course=list'],
          ['markdown', '≡', 'Markdown & Quiz', '/markdown/'],
        ];
  const nav = (
    <>
      {user.username === 'thanhpv' &&
        [...new Set(TOOLS.map((item) => item.group))].map((group) => (
          <div className="nav-group" key={group}>
            <span className="eyebrow">{group}</span>
            {TOOLS.filter((item) => item.group === group).map((item) =>
              onToolSelect ? (
                <button
                  type="button"
                  key={item.id}
                  className={`nav-item ${currentTab === item.id ? 'is-current' : ''}`}
                  aria-current={currentTab === item.id ? 'page' : undefined}
                  onClick={() => {
                    onToolSelect(item.id);
                    setMenu(false);
                  }}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  {item.name}
                  {currentTab === item.id && (
                    <span className="nav-arrow" aria-hidden="true">
                      ↗
                    </span>
                  )}
                </button>
              ) : (
                <a key={item.id} className="nav-item" href={`${basePath}/?tool=${item.id}`}>
                  <span aria-hidden="true">{item.icon}</span>
                  {item.name}
                </a>
              ),
            )}
          </div>
        ))}
      <div className="nav-group">
        <span className="eyebrow">Khóa học</span>
        {links.map(([id, icon, label, href]) => (
          <a
            key={id}
            className={`nav-item ${currentTab === id ? 'is-current' : ''}`}
            aria-current={currentTab === id ? 'page' : undefined}
            href={`${basePath}${href}`}
            target={['work', 'markdown'].includes(id) ? '_blank' : undefined}
            rel={['work', 'markdown'].includes(id) ? 'noopener noreferrer' : undefined}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
            {currentTab === id && (
              <span className="nav-arrow" aria-hidden="true">
                ↗
              </span>
            )}
          </a>
        ))}
      </div>
    </>
  );

  return (
    <div
      className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${focus ? 'focus-mode' : ''}`}
    >
      <a className="skip-link" href="#study-content">
        Đến nội dung học
      </a>
      <aside className="sidebar">
        <div className="sidebar-header">
          <a className="brand" href={`${basePath}/`}>
            <span className="brand-mark" aria-hidden="true">
              言
            </span>
            <span>
              KOTOBA<span className="brand-lab"> LAB</span>
              <small>HỌC MỘT CHÚT. NHỚ THẬT LÂU.</small>
            </span>
          </a>
          <Button
            variant="secondary"
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            aria-label="Thu gọn thanh bên"
            title="Thu gọn thanh bên"
          >
            ◀ Ẩn
          </Button>
        </div>
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
            aria-label="Đăng xuất"
          >
            Đăng xuất
          </Button>
        </div>
        <p className="sidebar-note">
          日本語 · English · Français
          <br />
          Không gian nhỏ cho những tiến bộ lớn.
        </p>
      </aside>
      <div className="app-workspace">
        <header className="app-header">
          <div className="header-left">
            <div className="mobile-brand">
              <span aria-hidden="true">言</span> KOTOBA LAB
            </div>
            <Button
              className="desktop-sidebar-toggle"
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Hiện thanh bên' : 'Ẩn thanh bên'}
              title={collapsed ? 'Hiện thanh bên' : 'Ẩn thanh bên'}
              aria-expanded={!collapsed}
            >
              {collapsed ? '▶ Hiện menu' : '◀ Ẩn menu'}
            </Button>
            <span className="header-context">
              {contextGroup || 'Khóa học'} <span aria-hidden="true">/</span>{' '}
              {contextLabel || links.find(([id]) => id === currentTab)?.[2] || 'Công cụ học'}
            </span>
          </div>
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
            <Button className="button-logout" onClick={handleLogout}>
              Đăng xuất
            </Button>
            {headerActions}
          </div>
        </header>
        <main id="study-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          Từng từ một. Từng ngày một. <span>言語 & IELTS</span>
        </footer>
      </div>
      <Dialog open={menu} onClose={() => setMenu(false)} title="Khóa học">
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
            aria-label="Đăng xuất"
          >
            Đăng xuất
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
