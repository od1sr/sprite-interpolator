import React, { useState } from 'react';

export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="password-input-wrap">
      <input
        {...props}
        className={`password-input-control${props.className ? ` ${props.className}` : ''}`}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={visible}
        title={visible ? 'Скрыть пароль' : 'Показать пароль'}
        onClick={() => setVisible((current) => !current)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
          {visible ? <circle cx="12" cy="12" r="3" /> : <><circle cx="12" cy="12" r="3" /><path d="m3 3 18 18" /></>}
        </svg>
      </button>
    </span>
  );
}
