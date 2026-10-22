import React from 'react';

// Переводим статусы из api.md (queued, processing) в красивые ярлыки
const STATUS_LABELS = {
  queued: 'В очереди',
  processing: 'Обработка…',
  completed: 'Готово',
  failed: 'Ошибка',
  cancelled: 'Отменено',
};

export default function JobList({ job }) {
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
            href={`http://localhost:8000/api/v1/jobs/${job.id}/result/download`} 
            download
          >
            Скачать
          </a>
        )}
      </div>
      
      {/* Если бэкенд вернул ошибку, показываем ее */}
      {job.status === 'failed' && job.error && (
        <div style={{ color: '#ef4444', fontSize: '13px', marginTop: '8px' }}>
          ⚠️ {job.error.message}
        </div>
      )}
    </div>
  );
}