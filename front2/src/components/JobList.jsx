import React from 'react'

const STATUS_LABELS = {
  pending: 'Ожидает',
  processing: 'Обработка…',
  done: 'Готово',
  error: 'Ошибка',
}

export default function JobList({ jobs }) {
  if (jobs.length === 0) return null

  return (
    <div className="jobs-section">
      <h3>Список задач</h3>
      {jobs.map((job) => (
        <div className="job-card" key={job.id}>
          <div className={`job-status ${job.status}`} />
          <div className="job-info">
            <div className="job-name" title={job.fileName}>{job.fileName}</div>
            <div className="job-meta">
              {job.scale}× · {job.fps ? `${job.fps} fps` : 'fps без изм.'} · {STATUS_LABELS[job.status]}
            </div>
          </div>
          {job.status === 'done' && job.downloadUrl && (
            <a className="job-download" href={job.downloadUrl} download>
              Скачать
            </a>
          )}
        </div>
      ))}
    </div>
  )
}