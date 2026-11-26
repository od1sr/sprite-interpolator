import React from 'react';

export default function Dashboard({ user, projects, onNewProcess }) {
  const firstName = user?.name?.split(' ')[0] || 'Пользователь';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const activeCount = projects.filter(project => project.status === 'run' || project.status === 'queue').length;
  const completedCount = projects.filter(project => project.status === 'done').length;
  const failedCount = projects.filter(project => project.status === 'err').length;

  return (
    <div id="view-dashboard">
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Личный кабинет</span>
          <h2 className="welcome-title">{greeting}, {firstName}</h2>
          <p className="welcome-sub">Вот что происходит в вашем рабочем пространстве сегодня.</p>
        </div>
        <button className="btn btn-primary" onClick={onNewProcess}>+ Новая обработка</button>
      </div>

      <div className="stats">
        <div className="stat stat--total" data-code="Σ">
          <div className="stat-label">Обработок в этой сессии</div>
          <div className="stat-val">{projects.length}</div>
          <div className="stat-foot"><span className="stat-dots" /> SESSION LOG</div>
        </div>

        <div className="stat stat--active" data-code="RUN">
          <div className="stat-label">В обработке</div>
          <div className="stat-val">{activeCount}</div>
          <div className="stat-foot"><span className="live-dot" /> IN PROGRESS</div>
        </div>

        <div className="stat stat--done" data-code="OK">
          <div className="stat-label">Завершено</div>
          <div className="stat-val">{completedCount}</div>
          <div className="stat-foot"><span className="stat-check">✓</span> COMPLETED</div>
        </div>

        <div className="stat stat--errors" data-code="ERR">
          <div className="stat-label">С ошибкой</div>
          <div className="stat-val">{failedCount}</div>
          <div className="stat-foot"><span className="stat-warn">!</span> NEEDS REVIEW</div>
        </div>
      </div>
    </div>
  );
}
