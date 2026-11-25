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
    <div>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Архив</span>
          <h2 className="welcome-title">Проекты</h2>
          <p className="welcome-sub">Все ваши обработки в одном месте.</p>
        </div>
      </div>

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
