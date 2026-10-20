import React from 'react'

const SCALE_OPTIONS = [
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
]

const FPS_OPTIONS = [
  { label: '30 → 60', value: 60 },
  { label: '60 → 120', value: 120 },
  { label: 'Без изменения', value: 0 },
]

export default function ParametersPanel({
  file,
  scale,
  setScale,
  fps,
  setFps,
  processing,
  onSubmit,
  originalResolution,
}) {
  const hasFile = !!file

  const targetResolution = originalResolution
    ? `${Math.round(originalResolution.w * scale)} × ${Math.round(originalResolution.h * scale)} px`
    : '—'

  return (
    <div className="params-panel">
      <div className="params-header">
        <h2>Параметры обработки</h2>
      </div>

      <div className="params-hint">
        Выберите множитель разрешения и целевую частоту кадров, затем нажмите
        «Обработать», чтобы улучшить видео с помощью AI.
      </div>

      <div className="params-section">
        <div className="params-section-title">Множитель разрешения</div>
        <div className="option-group">
          {SCALE_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`option-btn ${scale === o.value ? 'active' : ''}`}
              onClick={() => setScale(o.value)}
              disabled={!hasFile}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="params-section-title">Частота кадров (FPS)</div>
        <div className="option-group" style={{ flexWrap: 'wrap' }}>
          {FPS_OPTIONS.map((o) => (
            <button
              key={o.value}
              className={`option-btn ${fps === o.value ? 'active' : ''}`}
              onClick={() => setFps(o.value)}
              disabled={!hasFile}
              style={{ flex: o.value === 0 ? '1 1 100%' : 1 }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {file && (
        <div className="file-info-row">
          <span className="name" title={file.name}>{file.name}</span>
          <span className="from">{originalResolution ? `${originalResolution.w}×${originalResolution.h}` : '—'}</span>
          <span className="arrow">→</span>
          <span className="to">{targetResolution}</span>
        </div>
      )}

      <button
        className="action-btn"
        disabled={!hasFile || processing}
        onClick={onSubmit}
      >
        {processing ? (
          <>
            <span className="spinner" /> Обработка…
          </>
        ) : (
          'Обработать ➜'
        )}
      </button>
    </div>
  )
}