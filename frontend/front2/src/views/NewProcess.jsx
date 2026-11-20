import Dropzone from '../components/Dropzone';

function formatBytes(bytes) {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} КБ`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
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
  hasPipelineSteps,
  onStart,
  onOpenAdaptation,
}) {
  const getEstimate = () => {
    const upLabel = scale === 1 ? 'без апскейла' : `апскейл ${scale}×`;
    const fpsLabel = fps === 0 ? 'исходный FPS' : `${fps} FPS`;
    return `В запрос уйдёт: ${upLabel} · ${fpsLabel}`;
  };

  return (
    <div>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Обработка</span>
          <h2 className="welcome-title">Новая обработка</h2>
          <p className="welcome-sub">Загрузите видео и настройте пайплайн — обработка запустится через существующую очередь.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>1. Видео</h3>
          <span className="muted-sm">MP4 · MOV · WebM · до 2 ГБ</span>
        </div>
        <Dropzone
          title={file?.name || 'Перетащите видео сюда'}
          sub={file ? 'Нажмите, чтобы заменить файл' : 'или нажмите, чтобы выбрать файл'}
          onFile={onFile}
          disabled={processing}
        />
        {file && (
          <div className="file-summary" style={{ marginTop: 14 }}>
            <strong>{file.name}</strong>
            <span>·</span>
            <span>{formatBytes(file.size)}</span>
            {video?.width && video?.height && (
              <>
                <span>·</span>
                <span>{video.width} × {video.height}</span>
              </>
            )}
            {video?.fps && (
              <>
                <span>·</span>
                <span>{video.fps} FPS</span>
              </>
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
            disabled={!file || !hasPipelineSteps || processing}
          >
            {processing ? 'Обработка…' : 'Запустить обработку'}
          </button>
        </div>
        {!hasPipelineSteps && <div className="notice">Выберите хотя бы один рабочий этап обработки.</div>}
        <button className="btn btn-ghost" onClick={onOpenAdaptation} style={{ marginTop: 12 }}>
          Подготовить экспорт для платформы
        </button>
      </div>
    </div>
  );
}
