import React from 'react';

const TABS = [
  { id: 'all', label: 'Все' },
  { id: 'queue', label: 'В очереди' },
  { id: 'run', label: 'В обработке' },
  { id: 'done', label: 'Готово' },
  { id: 'err', label: 'Ошибка' },
  { id: 'cancel', label: 'Отменено' },
];

export default function Projects({ filter, onFilterChange }) {
  return (
    <div className="projects-head">
      <span className="welcome-eyebrow">Архив / Все обработки</span>
      <p className="welcome-sub">Каждая обработка — отдельный проект со своими экспортами.</p>

      <div className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab ${filter === tab.id ? 'active' : ''}`}
            onClick={() => onFilterChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
