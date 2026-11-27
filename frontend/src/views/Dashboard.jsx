import React from 'react';
import Billing from './Billing';

export default function Dashboard({ user, projects, onNewProcess, onPlanChange, onOpenProjects }) {
  const firstName = (user?.display_name || user?.username || 'Пользователь').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
  const activeCount = projects.filter(project => project.status === 'run').length;
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
        <button type="button" className="stat stat--total" data-code="Σ" onClick={() => onOpenProjects('all')}>
          <div className="stat-label">Обработок в этой сессии</div>
          <div className="stat-val">{projects.length}</div>
          <div className="stat-foot"><span className="stat-dots" /> SESSION LOG <span className="stat-go" aria-hidden="true">↗</span></div>
        </button>

        <button type="button" className="stat stat--active" data-code="RUN" onClick={() => onOpenProjects('run')}>
          <div className="stat-label">В обработке</div>
          <div className="stat-val">{activeCount}</div>
          <div className="stat-foot"><span className="live-dot" /> IN PROGRESS <span className="stat-go" aria-hidden="true">↗</span></div>
        </button>

        <button type="button" className="stat stat--done" data-code="OK" onClick={() => onOpenProjects('done')}>
          <div className="stat-label">Завершено</div>
          <div className="stat-val">{completedCount}</div>
          <div className="stat-foot"><span className="stat-check">✓</span> COMPLETED <span className="stat-go" aria-hidden="true">↗</span></div>
        </button>

        <button type="button" className="stat stat--errors" data-code="ERR" onClick={() => onOpenProjects('err')}>
          <div className="stat-label">С ошибкой</div>
          <div className="stat-val">{failedCount}</div>
          <div className="stat-foot"><span className="stat-warn">!</span> NEEDS REVIEW <span className="stat-go" aria-hidden="true">↗</span></div>
        </button>
      </div>

      <section id="billing-section" className="dashboard-billing">
        <Billing user={user} onPlanChange={onPlanChange} />
      </section>
    </div>
  );
}
