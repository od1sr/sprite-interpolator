import React from 'react';
import Dropzone from '../components/Dropzone';
import ProjectRow from '../components/ProjectRow';

export default function Dashboard({ user, projects, onAddProject, onNewProcess }) {
  const firstName = user?.name?.split(' ')[0] || 'Пользователь';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

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
        <div className="stat"><div className="stat-label">Всего проектов</div><div className="stat-val">128</div><div className="stat-sub up">+12 за неделю</div></div>
        <div className="stat"><div className="stat-label">В обработке</div><div className="stat-val">{projects.filter(p => p.status === 'run').length}</div></div>
        <div className="stat"><div className="stat-label">Минут обработано</div><div className="stat-val">1 482</div></div>
        <div className="stat"><div className="stat-label">Остаток квоты</div><div className="stat-val">64%</div></div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Быстрая обработка</h3><span className="muted-sm">MP4 · MOV · WebM · до 2 ГБ</span></div>
        <Dropzone
          title="Перетащите видео сюда"
          sub="Выбор файла откроет форму обработки"
          onFile={onAddProject}
        />
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Последние проекты</h3></div>
        <div className="proj-list">
          {projects.slice(0, 4).map(p => <ProjectRow key={p.id} project={p} />)}
        </div>
      </div>
    </div>
  );
}