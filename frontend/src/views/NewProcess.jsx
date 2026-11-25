import { useEffect, useRef, useState } from 'react';
import Dropzone from '../components/Dropzone';

const SCALE_OPTIONS = [
  { value: 1, label: 'Не применять' },
  { value: 2, label: '2×' },
  { value: 4, label: '4×' },
];

const FPS_OPTIONS = [
  { value: 0, label: 'Не применять' },
  { value: 60, label: '60 FPS' },
  { value: 120, label: '120 FPS' },
];

function formatBytes(bytes) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} КБ`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
}

function formatVideoDuration(seconds) {
  if (!seconds) return '—';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function StepHeader({ number, title, hint }) {
  return (
    <div className="panel-head step-head">
      <div className="step-heading">
        <span className="step-number">{number}</span>
        <h3>{title}</h3>
      </div>
      <span className="muted-sm">{hint}</span>
    </div>
  );
}

function StyledSelect({ value, options, onChange, disabled = false, label }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((option) => option.value === value)));
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    setActiveIndex(Math.max(0, options.findIndex((option) => option.value === value)));
  }, [value, options]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const chooseOption = (option) => {
    onChange(option.value);
    setOpen(false);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        return (next + options.length) % options.length;
      });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      chooseOption(options[activeIndex]);
    }
  };

  return (
    <div className="select-field" ref={rootRef}>
      <button
        type="button"
        className="select pipeline-select"
        onClick={() => !disabled && setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span>{selected.label}</span>
        <svg
          className={`select-chevron${open ? ' open' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="select-popover" role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`select-option${index === activeIndex ? ' active' : ''}${option.value === value ? ' selected' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => chooseOption(option)}
            >
              <span>{option.label}</span>
              {option.value === value && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewProcess({
  file,
  video,
  onFile,
  scale,
  setScale,
  fps,
  setFps,
  processing,
  uploading,
  hasPipelineSteps,
  exportProfiles,
  selectedProfileIds,
  setProfileIds,
  adaptationMode,
  setAdaptationMode,
  adaptationModes,
  exportJobsCount,
  onStart,
}) {
  return (
    <div>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Обработка</span>
          <h2 className="welcome-title">Новая обработка</h2>

        </div>
      </div>

      <div className="panel">
        <StepHeader
          number="1"
          title="Видео"
          hint="Загрузите видео которое хотите обработать"
        />
        <Dropzone
          title={file?.name || 'Перетащите видео сюда'}
          sub={file
            ? uploading ? 'Загрузка видео…' : 'Нажмите, чтобы заменить файл'
            : 'или нажмите, чтобы выбрать файл'}
          onFile={onFile}
          disabled={processing}
        />
        {file && (
          <div className="file-meta">
            {uploading && !video && (
              <div className="file-meta-item">
                <span>Метаданные</span>
                <strong>Загрузка…</strong>
              </div>
            )}
            <div className="file-meta-item">
              <span>Размер</span>
              <strong>{formatBytes(file.size)}</strong>
            </div>
            {video?.width && video?.height && (
              <div className="file-meta-item">
                <span>Разрешение</span>
                <strong>{video.width} × {video.height}</strong>
              </div>
            )}
            {video?.fps && (
              <div className="file-meta-item">
                <span>Частота кадров</span>
                <strong>{Number(video.fps).toFixed(1)} FPS</strong>
              </div>
            )}
            {video?.duration_seconds && (
              <div className="file-meta-item">
                <span>Длительность</span>
                <strong>{formatVideoDuration(video.duration_seconds)}</strong>
              </div>
            )}
            {video?.codec && (
              <div className="file-meta-item">
                <span>Кодек</span>
                <strong>{video.codec}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <StepHeader
          number="2"
          title="Пайплайн"
          hint="Включите нужные модули"
        />

        <div className="opt-grid">
          <div className="opt">
            <div className="opt-head"><b>Апскейл</b></div>
            <p>Множитель разрешения из существующего API</p>
            <StyledSelect
              label="Множитель разрешения"
              value={scale}
              options={SCALE_OPTIONS}
              onChange={setScale}
              disabled={processing}
            />
          </div>

          <div className="opt">
            <div className="opt-head"><b>Интерполяция</b></div>
            <p>Целевая частота кадров</p>
            <StyledSelect
              label="Целевая частота кадров"
              value={fps}
              options={FPS_OPTIONS}
              onChange={setFps}
              disabled={processing}
            />
          </div>
        </div>

        {!hasPipelineSteps && (
          <div className="notice pipeline-notice">Выберите хотя бы один рабочий этап обработки.</div>
        )}
      </div>

      <div className="panel">
        <StepHeader
          number="3"
          title="Экспорт"
          hint="Выберите необходимые форматы для экспорта"
        />

        <p className="format-help">
          Выберите необходимые форматы экспорта
        </p>
        <div className="profile-options">
          {exportProfiles.map((profile) => (
            <label
              key={profile.id}
              className={`profile-option${selectedProfileIds.includes(profile.id) ? ' selected' : ''}`}
            >
              <input
                type="checkbox"
                name="export-profile"
                value={profile.id}
                checked={selectedProfileIds.includes(profile.id)}
                onChange={(event) => {
                  setProfileIds((current) => event.target.checked
                    ? [...current, profile.id]
                    : current.filter((id) => id !== profile.id));
                }}
                disabled={processing}
              />
              <b>{profile.platform}</b>
              <span>{profile.contentType}</span>
              <span>{profile.dimensions}, {profile.aspectRatio}</span>
            </label>
          ))}
        </div>

        <p className="format-help mode-help">Выберите способ обрезки видео</p>
        <div className="mode-options">
          {adaptationModes.map((mode) => (
            <label
              key={mode.value}
              className={`mode-option${adaptationMode === mode.value ? ' selected' : ''}`}
            >
              <input
                type="radio"
                name="adaptation-mode"
                value={mode.value}
                checked={adaptationMode === mode.value}
                onChange={() => setAdaptationMode(mode.value)}
                disabled={processing}
              />
              <b>{mode.label}</b>
              <span>{mode.description}</span>
            </label>
          ))}
        </div>
        {adaptationMode === 'crop' && (
          <div className="notice warning" style={{ marginTop: 14 }}>
            При центральном кадрировании часть изображения может быть обрезана.
          </div>
        )}

        {exportJobsCount > 0 && (
          <div className="status-detail">
            Экспортов в текущей сессии: {exportJobsCount}, каждая задача обрабатывается отдельно.
          </div>
        )}

      </div>

      <div className="page-actions">
        <button
          className="btn btn-primary"
          onClick={onStart}
          disabled={!file || !video || uploading || !hasPipelineSteps || processing}
        >
          {uploading ? 'Загрузка…' : processing ? 'Обработка…' : 'Запустить обработку'}
        </button>
      </div>
    </div>
  );
}
