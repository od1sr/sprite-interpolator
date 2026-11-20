import React, { useState } from 'react';

export default function Auth({ mode, setMode, onLogin, onRegister, onBack }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'login') onLogin(email, name);
    else onRegister(name, email);
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <h2>{mode === 'login' ? 'Вход в Zarya' : 'Создание аккаунта'}</h2>
          <p>{mode === 'login' ? 'Продолжите работу над проектами' : 'Начните обрабатывать видео за пару минут'}</p>
        </div>
        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label className="field">
              <span>Имя</span>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Как к вам обращаться" required />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@studio.com" required />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </label>
          <button className="btn btn-primary btn-block" type="submit">{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть аккаунт? '}
          <a onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </a>
        </p>
        <a className="auth-back" onClick={onBack}>← На главную</a>
      </div>
    </div>
  );
}