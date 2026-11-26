import React from 'react';

export default function Sidebar({ currentView, setView, user, getPlan, onLogout, isAdmin }) {
  const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const plan = getPlan();

  const menuItems = [
    { id: 'dashboard', label: 'Обзор', icon: 'M3 3h7.5v7.5H3zM13.5 3h7.5v7.5h-7.5zM3 13.5h7.5v7.5H3zM13.5 13.5h7.5v7.5h-7.5z' },
    { id: 'new', label: 'Новая обработка', icon: 'M12 5v14M5 12h14' },
    { id: 'projects', label: 'Проекты', icon: 'M3 7.5A2 2 0 0 1 5 5.5h4l2 2.2h8a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z' },
    { id: 'settings', label: 'Настройки', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
  ];

  if (isAdmin) {
    menuItems.push({ 
      id: 'admin', 
      label: 'Админ-панель', 
      icon: 'M12 3l7.5 3.2v5.6c0 4.6-3.1 8.2-7.5 9.2-4.4-1-7.5-4.6-7.5-9.2V6.2L12 3Z' 
    });
  }

  return (
    <aside className="sidebar">
      <div className="brand side-brand"><span className="brand-mark"></span><span>Zarya</span></div>
      <div className="side-label">Рабочее пространство</div>
      {menuItems.map(item => (
        <button 
          key={item.id} 
          className={`side-item ${currentView === item.id ? 'active' : ''}`} 
          onClick={() => setView(item.id)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d={item.icon}/>
          </svg>
          {item.label}
        </button>
      ))}
      <div className="side-foot">
        <div className="user-chip">
          <div className="avatar sm">{initials}</div>
          <div className="uc-info">
            <b>{user?.name}</b>
            <span>Тариф {plan.name}</span>
            {isAdmin && <span style={{color: 'var(--accent)', fontSize: '11px', marginTop: '2px'}}>Администратор</span>}
          </div>
        </div>
        <button className="side-item" onClick={onLogout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/>
            <path d="M10 16l-4-4 4-4"/>
            <path d="M6 12h10"/>
          </svg>
          Выйти
        </button>
      </div>
    </aside>
  );
}