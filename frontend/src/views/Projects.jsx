import React, { useState } from 'react';
import ProjectRow from '../components/ProjectRow';

export default function Projects({ projects }) {
  const [filter, setFilter] = useState('all');

  const filteredProjects = filter === 'all' 
    ? projects 
    : projects.filter(p => p.status === filter);

  const tabs = [
    { id: 'all', label: 'Все' },
    { id: 'run', label: 'В обработке' },
    { id: 'done', label: 'Готово' },
    { id: 'err', label: 'Ошибка' },
    { id: 'unavailable', label: 'Не подключён' },
  ];

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
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            className={`tab ${filter === tab.id ? 'active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="proj-list">
          {filteredProjects.length > 0 ? (
            filteredProjects.map(p => <ProjectRow key={p.id} project={p} />)
          ) : (
            <div className="empty">Нет проектов в этой категории</div>
          )}
        </div>
      </div>
    </div>
  );
}