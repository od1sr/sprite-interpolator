import Dropzone from '../components/Dropzone';

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
  const selectedProfiles = exportProfiles.filter((profile) => selectedProfileIds.includes(profile.id));

  const getEstimate = () => {
    const upLabel = scale === 1 ? 'без апскейла' : `апскейл ${scale}×`;
    const fpsLabel = fps === 0 ? 'исходный FPS' : `${fps} FPS`;
    const exportLabel = selectedProfiles.length
      ? `, экспорт: ${selectedProfiles.length}`
      : ', без экспорта';
    return `В запрос уйдёт: ${upLabel}, ${fpsLabel}${exportLabel}`;
  };

  const setProfileOrientation = (aspectRatio) => {
    setProfileIds(exportProfiles
      .filter((profile) => profile.aspectRatio === aspectRatio)
      .map((profile) => profile.id));
  };

  const isOrientationSelected = (aspectRatio) => {
    const matchingProfiles = exportProfiles.filter((profile) => profile.aspectRatio === aspectRatio);
    return selectedProfiles.length === matchingProfiles.length
      && matchingProfiles.every((profile) => selectedProfileIds.includes(profile.id));
  };

  return (
    <div>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Обработка</span>
          <h2 className="welcome-title">Новая обработка</h2>
          <p className="welcome-sub">Загрузите видео, соберите пайплайн и настройте экспорт — всё запускается одной задачей.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>1. Видео</h3>
          <span className="muted-sm">MP4, MOV, WebM, до 2 ГБ</span>
        </div>
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
            {video?.content_type && (
              <div className="file-meta-item">
                <span>Формат</span>
                <strong>{video.content_type}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>2. Пайплайн</h3>
          <span className="muted-sm">Включите нужные модули</span>
        </div>

        <div className="opt-grid">
          <div className="opt">
            <div className="opt-head"><b>Апскейл</b></div>
            <p>Множитель разрешения из существующего API</p>
            <select
              className="select"
              value={scale}
              onChange={(event) => setScale(Number(event.target.value))}
              disabled={processing}
            >
              <option value={1}>Не применять</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </div>

          <div className="opt">
            <div className="opt-head"><b>Интерполяция</b></div>
            <p>Целевая частота кадров</p>
            <select
              className="select"
              value={fps}
              onChange={(event) => setFps(Number(event.target.value))}
              disabled={processing}
            >
              <option value={0}>Не применять</option>
              <option value={60}>60 FPS</option>
              <option value={120}>120 FPS</option>
            </select>
          </div>
        </div>

        <div className="panel-foot">
          <div className="estimate">{getEstimate()}</div>
          <button
            className="btn btn-primary"
            onClick={onStart}
            disabled={!file || !video || uploading || !hasPipelineSteps || processing}
          >
            {uploading ? 'Загрузка…' : processing ? 'Обработка…' : 'Запустить обработку'}
          </button>
        </div>
        {!hasPipelineSteps && <div className="notice">Выберите хотя бы один рабочий этап обработки.</div>}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>3. Экспорт</h3>
          <span className="muted-sm">Необязательно, запускается вместе с обработкой</span>
        </div>

        <div className="format-presets">
          <span>Быстрый выбор ориентации</span>
          <button
            type="button"
            className={isOrientationSelected('16:9') ? 'active' : ''}
            onClick={() => setProfileOrientation('16:9')}
            disabled={processing}
          >
            Альбомная, 16:9
          </button>
          <button
            type="button"
            className={isOrientationSelected('9:16') ? 'active' : ''}
            onClick={() => setProfileOrientation('9:16')}
            disabled={processing}
          >
            Книжная, 9:16
          </button>
        </div>
        <p className="format-help">
          Ориентация задаётся профилем экспорта. Способ вписывания изображения выберите ниже.
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

        <div className="mode-options" style={{ marginTop: 16 }}>
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

        <div className="panel-foot">
          <div className="estimate">
            {selectedProfiles.length
              ? selectedProfiles.map((profile) => `${profile.title}, ${profile.dimensions}, ${profile.codec}`).join(', ')
              : 'Профили экспорта не выбраны'}
          </div>
        </div>
        {exportJobsCount > 0 && (
          <div className="status-detail">
            Экспортов в текущей сессии: {exportJobsCount}, каждая задача обрабатывается отдельно.
          </div>
        )}
      </div>
    </div>
  );
}
