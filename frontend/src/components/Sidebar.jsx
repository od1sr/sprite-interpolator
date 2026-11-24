import React from 'react';

export default function Sidebar({ currentView, setView, user, getPlan, onLogout }) {
  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const plan = getPlan();

  const settingsIcon = (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  );

  const menuItems = [
    { id: 'dashboard', label: 'Обзор', icon: 'M3 3h7.5v7.5H3zM13.5 3h7.5v7.5h-7.5zM3 13.5h7.5v7.5H3zM13.5 13.5h7.5v7.5h-7.5z' },
    { id: 'new', label: 'Новая обработка', icon: 'M12 5v14M5 12h14' },
    { id: 'projects', label: 'Проекты', icon: 'M3 7.5A2 2 0 0 1 5 5.5h4l2 2.2h8a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z' },
    { id: 'settings', label: 'Настройки', icon: settingsIcon },
    { id: 'billing', label: 'Тариф и оплата', icon: 'M2.5 5.5h19v13H2.5zM2.5 10h19' },
  ];

  return (
    <aside className="sidebar">
      <div className="brand side-brand"><span className="brand-mark"></span><span>Zarya</span></div>
      <div className="side-label">Рабочее пространство</div>
      {menuItems.map(item => (
        <button key={item.id} className={`side-item ${currentView === item.id ? 'active' : ''}`} onClick={() => setView(item.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {typeof item.icon === 'string' ? <path d={item.icon}/> : item.icon}
          </svg>
          {item.label}
        </button>
      ))}
      <div className="side-foot">
        <div className="user-chip">
          <div className="avatar sm">{initials}</div>
          <div className="uc-info"><b>{user?.name}</b><span>Тариф {plan.name}</span></div>
        </div>
        <button className="side-item" onClick={onLogout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/></svg>
          Выйти
        </button>
      </div>
    </aside>
  );
}