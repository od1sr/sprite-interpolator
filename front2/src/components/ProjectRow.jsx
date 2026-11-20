import React from 'react';

export default function ProjectRow({ project }) {
  const isDone = project.status === 'done';
  const isRun = project.status === 'run';
  const isErr = project.status === 'err';
  
  let pillClass = 'pill';
  let pillText = 'В очереди';
  if (isDone) { pillClass += ' pill-ok'; pillText = 'Готово'; }
  if (isRun) { pillClass += ' pill-run'; pillText = 'В обработке'; }
  if (isErr) { pillClass += ' pill-err'; pillText = 'Ошибка'; }

  return (
    <div className="proj" data-status={project.status}>
      <div className="thumb" style={{'--h': project.hue}}></div>
      <div className="proj-main">
        <div className="proj-name">{project.name} <span className={pillClass}>{pillText}</span></div>
        <div className="proj-meta">{project.meta}</div>
      </div>
      <div className="proj-bar">
        <div className={`bar ${isDone ? 'done' : ''}`}><i style={{width: `${project.progress}%`}}></i></div>
        <span className="pct">{isErr ? '—' : Math.round(project.progress) + '%'}</span>
      </div>
      <button className="icon-btn">⋯</button>
    </div>
  );
}