import React from 'react';

// Переводим статусы из api.md (queued, processing) в красивые ярлыки
const STATUS_LABELS = {
  queued: 'В очереди',
  processing: 'Обработка…',
  completed: 'Готово',
  failed: 'Ошибка',
  cancelled: 'Отменено',
};

export default function JobList({ job ,downloadUrl}) {
  // Если задачи еще нет, ничего не рисуем
  if (!job) return null;

  // Определяем CSS-класс для точки-индикатора
  let statusClass = 'pending';
  if (job.status === 'processing') statusClass = 'processing';
  if (job.status === 'completed') statusClass = 'done';
  if (job.status === 'failed') statusClass = 'error';

  return (
    <div className="jobs-section">
      <h3>Статус обработки</h3>
      <div className="job-card">
        <div className={`job-status ${statusClass}`} />
        
        <div className="job-info">
          {/* Имя файла у нас не приходит в Job, поэтому пишем просто ID видео */}
          <div className="job-name" title={job.id}>Задача #{job.id.slice(0, 8)}</div>
          <div className="job-meta">
            {job.status === 'processing' && `Прогресс: ${job.progress || 0}% · `}
            {STATUS_LABELS[job.status] || job.status}
          </div>
        </div>

        {/* Если задача завершилась успешно, показываем кнопку скачать */}
        {job.status === 'completed' && (
          <a 
            className="job-download" 
            href={"/upscaled.mp4"} 
            download
          >
            Скачать
          </a>
        )}
      </div>
       {/* ВИЗУАЛЬНАЯ ШКАЛА ПРОГРЕССА */}
        {(job.status === 'processing' || job.status === 'queued') && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>
              <span>Прогресс</span>
              <span>{job.progress || 0}%</span>
            </div>
            <div style={{ 
              width: '100%', height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' 
            }}>
              <div 
                style={{ 
                  width: `${job.progress || 0}%`, height: '100%', background: 'var(--blue)', transition: 'width 0.5s ease-out' 
                }} 
              />
            </div>
          </div>
        )}
      
      {/* Если бэкенд вернул ошибку, показываем ее */}
      {job.status === 'failed' && job.error && (
        <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>
          ⚠️ {job.error.message}
        </div>
      )}
    </div>
  );
}