import React, { useEffect, useState } from 'react';

export default function Sidebar({ currentView, setView, user, getPlan }) {
  const displayName = user?.display_name || user?.username || 'Пользователь';
  const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const plan = getPlan();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('zarya.sidebar.collapsed') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('zarya.sidebar.collapsed', collapsed ? '1' : '0');
    } catch {
      // Ignore storage errors — collapsing still works for this session.
    }
  }, [collapsed]);

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
    { id: 'settings', label: 'Настройки', icon: settingsIcon, mobileOnly: true },
  ];

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="side-top">
        <div className="brand side-brand">
          <span className="brand-mark"></span>
          <span className="brand-text">Zarya</span>
        </div>
        <button
          className="side-toggle"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-expanded={!collapsed}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
          </svg>
        </button>
      </div>
      {menuItems.map(item => (
        <button
          key={item.id}
          className={`side-item ${item.mobileOnly ? 'mobile-only' : ''} ${currentView === item.id ? 'active' : ''}`}
          onClick={() => setView(item.id)}
          title={collapsed ? item.label : undefined}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            {typeof item.icon === 'string' ? <path d={item.icon}/> : item.icon}
          </svg>
          <span className="side-item-label">{item.label}</span>
        </button>
      ))}
      <div className="side-foot">
        <div className="user-chip" title={`${displayName} · Тариф ${plan.name}`}>
          <div className="avatar sm">{initials}</div>
          <div className="uc-info"><b>{displayName}</b><span>Тариф {plan.name}</span></div>
          <button
            className={`chip-settings ${currentView === 'settings' ? 'active' : ''}`}
            onClick={() => setView('settings')}
            title="Настройки"
            aria-label="Настройки"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {settingsIcon}
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}