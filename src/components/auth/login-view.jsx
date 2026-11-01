'use client';
import { useState } from 'react';
import { Button, Status } from '../ui/primitives';
import { loginUser } from '../../services/study-library-client';

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = await loginUser(username.trim(), password);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      setError(err.message || 'Tên đăng nhập hoặc mật khẩu không đúng.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <header className="login-header">
          <div className="brand login-brand">
            <span className="brand-mark" aria-hidden="true">
              言
            </span>
            <span>
              KOTOBA<span className="brand-lab"> LAB</span>
              <small>HỌC MỘT CHÚT. NHỚ THẬT LÂU.</small>
            </span>
          </div>
          <h1>Đăng nhập</h1>
          <p className="helper">
            Đăng nhập để vào không gian học tập cá nhân. Dữ liệu được quản lý riêng theo từng tài
            khoản.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="field">
            <label htmlFor="login-username">Tên đăng nhập</label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={busy}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Mật khẩu</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
          </div>

          {error && <Status error>{error}</Status>}

          <Button type="submit" variant="primary" className="login-submit-btn" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập ↗'}
          </Button>
        </form>
      </div>
    </div>
  );
}
