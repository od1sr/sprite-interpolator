import React, { useEffect, useState } from 'react';
import PasswordInput from '../components/PasswordInput';

export default function Auth({ mode, setMode, onLogin, onRegister, onBack }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPassword('');
    setError('');
  }, [mode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') await onLogin(login, password);
      else await onRegister(login, password, displayName);
    } catch (submitError) {
      setError(submitError?.message || 'Не удалось войти. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = () => {
    setError('');
    setMode(mode === 'login' ? 'register' : 'login');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-shell">
        <aside className="auth-aside" aria-hidden="true">
          <div className="brand">
            <span className="brand-mark" />
            <span>Zarya</span>
          </div>
          <div className="auth-aside-mark">Z</div>
          <div className="auth-aside-code">VIDEO ENGINE / ACCESS TERMINAL</div>
          <ol className="auth-steps">
            <li>INTERPOLATE</li>
            <li>UPSCALE</li>
            <li>COLOR CORRECT</li>
          </ol>
        </aside>

        <div className="auth-card">
          <div className="auth-head">
            <h2>{mode === 'login' ? 'Вход в Zarya' : 'Создание аккаунта'}</h2>
            <p>{mode === 'login' ? 'Продолжите работу над своими проектами' : 'У вас будет отдельное рабочее пространство'}</p>
          </div>
          <form id="authForm" onSubmit={handleSubmit}>
            {mode === 'register' && (
              <label className="field">
                <span>Имя</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Как к вам обращаться"
                  maxLength={120}
                />
              </label>
            )}
            <label className="field">
              <span>Логин</span>
              <input
                type="text"
                value={login}
                onChange={e => setLogin(e.target.value)}
                placeholder="studio_name"
                autoComplete="username"
                required
                minLength={mode === 'register' ? 3 : 1}
                maxLength={64}
                pattern={mode === 'register' ? '[A-Za-z0-9_.-]+' : undefined}
              />
            </label>
            <label className="field">
              <span>Пароль</span>
              <PasswordInput
                key={mode}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 8 : 1}
                required
              />
            </label>
            <div className={`form-error${error ? ' show' : ''}`} role="alert">{error}</div>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy
                ? (mode === 'login' ? 'Вход…' : 'Создание…')
                : (mode === 'login' ? 'Войти' : 'Создать аккаунт')}
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
            <a onClick={switchMode}>
              {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
            </a>
          </p>
          <a className="auth-back" onClick={onBack}>← На главную</a>
        </div>
      </div>
    </div>
  );
}
