import React, { useEffect, useRef, useState } from 'react';

export default function ProjectRow({ project }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const actionsRef = useRef(null);
  const triggerRef = useRef(null);
  const isDone = project.status === 'done';
  const isRun = project.status === 'run';
  const isErr = project.status === 'err';
  
  let pillClass = 'pill';
  let pillText = 'В очереди';
  if (isDone) { pillClass += ' pill-ok'; pillText = 'Готово'; }
  if (isRun) { pillClass += ' pill-run'; pillText = 'В обработке'; }
  if (isErr) { pillClass += ' pill-err'; pillText = 'Ошибка'; }

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!actionsRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

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
      <div className="project-actions" ref={actionsRef}>
        <button
          ref={triggerRef}
          type="button"
          className="icon-btn"
          aria-label={`Действия проекта ${project.name}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="project-menu" role="menu" aria-label={`Меню проекта ${project.name}`}>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setDetailsOpen(true);
                setMenuOpen(false);
              }}
            >
              Сведения о проекте
            </button>
            {project.downloadUrl ? (
              <a href={project.downloadUrl} download role="menuitem">Скачать результат</a>
            ) : (
              <button type="button" role="menuitem" disabled title="Файл результата недоступен">
                Скачать результат
              </button>
            )}
          </div>
        )}
      </div>
      {detailsOpen && (
        <div className="project-details" role="region" aria-label={`Сведения о проекте ${project.name}`}>
          <strong>{project.name}</strong>
          <p>Статус: {pillText}</p>
          <p>{project.meta}</p>
          <p>Готовность: {isErr ? '—' : `${Math.round(project.progress)}%`}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDetailsOpen(false)}>
            Закрыть
          </button>
        </div>
      )}
    </div>
  );
}