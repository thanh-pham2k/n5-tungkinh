'use client';
import { useState } from 'react';
import { Button, Status } from '../ui/primitives';
import { loginUser } from '../../services/study-library-client';

export default function LoginView({ onLoginSuccess }) {
  const [username, setUsername] = useState('thanhpv');
  const [password, setPassword] = useState('1');
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

  function selectAccount(name, pass) {
    setUsername(name);
    setPassword(pass);
    setError('');
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
            Chọn tài khoản để vào không gian học tập cá nhân. Dữ liệu được quản lý riêng theo từng
            tài khoản.
          </p>
        </header>

        <div className="account-presets" aria-label="Tài khoản có sẵn">
          <p className="eyebrow">Tài khoản truy cập</p>
          <div className="preset-buttons">
            <button
              type="button"
              className={`button preset-btn ${username === 'thanhpv' ? 'button-primary' : ''}`}
              onClick={() => selectAccount('thanhpv', '1')}
            >
              <span className="preset-badge">thanhpv</span>
              <small>Dữ liệu hiện tại (chính)</small>
            </button>
            <button
              type="button"
              className={`button preset-btn ${username === 'yentr' ? 'button-primary' : ''}`}
              onClick={() => selectAccount('yentr', '1')}
            >
              <span className="preset-badge">yentr</span>
              <small>Tài khoản cá nhân riêng</small>
            </button>
          </div>
        </div>

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

        <footer className="login-footer">
          <small>
            Mật khẩu mặc định: <code>1</code> · Hệ thống phân quyền độc lập
          </small>
        </footer>
      </div>
    </div>
  );
}
