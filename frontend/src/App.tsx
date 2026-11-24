import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createJob,
  createVideoExport,
  getJobResult,
  getJobStatus,
  getVideoExport,
  resolveApiUrl,
  uploadVideo,
} from './api/client';
import type { AdaptationMode, ExportJob, Job, Result, Video } from './types/api';
import { useAuth } from './hooks/useAuth';
import Sidebar from './components/Sidebar';
import Auth from './views/Auth';
import Billing from './views/Billing';
import Dashboard from './views/Dashboard';
import Landing from './views/Landing';
import Admin from './views/Admin';
import NewProcess from './views/NewProcess';
import Projects from './views/Projects';
import Settings from './views/Settings';
import './App.css';

type View = 'landing' | 'auth' | 'dashboard' | 'new' | 'adapt' | 'projects' | 'settings' | 'billing' | 'admin';

interface ExportProfile {
  id: string;
  platform: string;
  contentType: string;
  title: string;
  dimensions: string;
  aspectRatio: string;
  codec: string;
}

type ExportTask = ExportJob;

interface StepProgressView {
  type: string;
  status: string;
  progress: number;
}

interface TaskView {
  id: string;
  name: string;
  kind: string;
  status: string;
  progress: number;
  steps?: StepProgressView[];
  message?: string;
  downloadUrl?: string;
  createdAt: string;
}

const EXPORT_PROFILES: ExportProfile[] = [
  {
    id: 'youtube_standard_v1',
    platform: 'YouTube',
    contentType: 'Обычное видео',
    title: 'YouTube — обычное видео',
    dimensions: '1920 × 1080',
    aspectRatio: '16:9',
    codec: 'MP4, H.264, AAC',
  },
  {
    id: 'tiktok_vertical_v1',
    platform: 'TikTok',
    contentType: 'Вертикальное видео',
    title: 'TikTok — вертикальное',
    dimensions: '1080 × 1920',
    aspectRatio: '9:16',
    codec: 'MP4, H.264, AAC',
  },
];

const ADAPTATION_MODES: { value: AdaptationMode; label: string; description: string }[] = [
  { value: 'crop', label: 'Crop', description: 'Заполнить кадр, обрезав края' },
  { value: 'pad', label: 'Pad', description: 'Вписать видео с полями' },
  { value: 'blur', label: 'Blur background', description: 'Заполнить фон размытой копией' },
];

const VIEW_TITLES: Record<View, string> = {
  landing: 'Zarya',
  auth: 'Вход',
  dashboard: 'Обзор',
  new: 'Новая обработка',
  adapt: 'Адаптация под платформу',
  projects: 'Проекты',
  settings: 'Настройки аккаунта',
  billing: 'Тариф и оплата',
  admin: 'Админ-панель',
};

const STATUS_LABELS: Record<string, string> = {
  queued: 'В очереди',
  analyzing: 'Анализ видео',
  preparing: 'Подготовка',
  processing: 'В обработке',
  validating: 'Проверка результата',
  completed: 'Готово',
  ready: 'Готово',
  failed: 'Ошибка',
  cancelling: 'Отмена',
  cancelled: 'Отменено',
};

const STEP_LABELS: Record<string, string> = {
  upscale: 'Апскейл',
  interpolate: 'Интерполяция',
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} КБ`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
}

function FileDropzone({
  file,
  onFile,
  disabled,
}: {
  file: File | null;
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const chooseFile = () => {
    if (!disabled) inputRef.current?.click();
  };

  const acceptFile = (candidate?: File) => {
    if (!disabled && candidate) onFile(candidate);
  };

  return (
    <div
      className={`dropzone${dragging ? ' drag' : ''}${disabled ? ' is-disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={chooseFile}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          chooseFile();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        acceptFile(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          acceptFile(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
      <div className="dz-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
        </svg>
      </div>
      <div className="dz-title">{file ? file.name : 'Перетащите видео сюда'}</div>
      <div className="dz-sub">
        {file
          ? 'Нажмите, чтобы заменить файл'
          : 'или нажмите, чтобы выбрать, MP4, MOV, WebM, до 2 ГБ'}
      </div>
    </div>
  );
}

function SourcePanel({
  file,
  video,
  onFile,
  disabled,
}: {
  file: File | null;
  video: Video | null;
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>1. Исходное видео</h3>
        <span className="muted-sm">MP4, MOV, WebM</span>
      </div>
      {!file ? (
        <FileDropzone file={file} onFile={onFile} disabled={disabled} />
      ) : (
        <>
          <div className="source-preview">
            {previewUrl && <video src={previewUrl} controls />}
            <div className="source-details">
              <div className="source-detail">
                <span>Файл</span>
                <strong title={file.name}>{file.name}</strong>
              </div>
              <div className="source-detail">
                <span>Размер</span>
                <strong>{formatBytes(file.size)}</strong>
              </div>
              {video && (
                <>
                  <div className="source-detail">
                    <span>Разрешение</span>
                    <strong>
                      {video.width && video.height ? `${video.width} × ${video.height}` : '—'}
                    </strong>
                  </div>
                  <div className="source-detail">
                    <span>Частота кадров</span>
                    <strong>{video.fps ? `${video.fps} FPS` : '—'}</strong>
                  </div>
                  <div className="source-detail">
                    <span>Длительность</span>
                    <strong>
                      {video.duration_seconds
                        ? `${Math.floor(video.duration_seconds / 60)}:${Math.floor(video.duration_seconds % 60)
                            .toString()
                            .padStart(2, '0')}`
                        : '—'}
                    </strong>
                  </div>
                </>
              )}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <FileDropzone file={file} onFile={onFile} disabled={disabled} />
          </div>
        </>
      )}
    </section>
  );
}

function TaskRow({ task }: { task: TaskView }) {
  const isReady = task.status === 'ready' || task.status === 'completed';
  const isFailed = task.status === 'failed';
  const tone = isReady ? 'pill-ok' : isFailed ? 'pill-err' : task.status === 'queued' ? '' : 'pill-run';
  const progress = Math.max(0, Math.min(100, task.progress));
  const showSteps = Boolean(task.steps && task.steps.length > 1);

  return (
    <div className="proj">
      <div className="thumb" aria-hidden="true" />
      <div className="proj-main">
        <div className="proj-name">
          <span title={task.name}>{task.name}</span>
          <span className={`pill ${tone}`}>{STATUS_LABELS[task.status] || task.status}</span>
        </div>
        <div className="proj-meta">
          {task.kind}, {task.message || `Задача ${task.id.slice(0, 8)}`}
          {!isReady && !isFailed && task.status !== 'queued' && ` · ${Math.round(progress)}%`}
        </div>
        {task.status === 'ready' && !task.downloadUrl && (
          <div className="task-result-message">
            Экспорт завершён. Ссылка на скачивание пока недоступна.
          </div>
        )}
      </div>
      {showSteps && task.steps ? (
        <div className="proj-steps">
          {task.steps.map((step, index) => {
            const stepDone = step.status === 'completed' || isReady;
            const stepProgress = stepDone
              ? 100
              : Math.max(0, Math.min(100, step.progress));
            return (
              <div key={`${task.id}-${step.type}-${index}`} className="proj-step">
                <div className="proj-step-head">
                  <span>{STEP_LABELS[step.type] || step.type}</span>
                  <span>{stepDone ? 'Готово' : STATUS_LABELS[step.status] || step.status}</span>
                </div>
                <div className="proj-step-bar">
                  <div className={`bar${stepDone ? ' done' : ''}`}>
                    <i style={{ width: `${stepProgress}%` }} />
                  </div>
                  <span className="pct">{Math.round(stepProgress)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="proj-bar">
          <div className={`bar${isReady ? ' done' : ''}`}>
            <i style={{ width: `${isReady ? 100 : progress}%` }} />
          </div>
          <span className="pct">{Math.round(isReady ? 100 : progress)}%</span>
        </div>
      )}
      {task.downloadUrl && (
        <a className="btn btn-ghost btn-sm" href={task.downloadUrl} download>
          Скачать
        </a>
      )}
    </div>
  );
}

export default function App() {
  const { user, isLoading, login, register, logout, getPlan, updateProfile } = useAuth();
  const [view, setView] = useState<View>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [file, setFile] = useState<File | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [exportJobs, setExportJobs] = useState<ExportTask[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [scale, setScale] = useState<number>(2);
  const [fps, setFps] = useState<number>(60);
  const [profileIds, setProfileIds] = useState<string[]>([EXPORT_PROFILES[0].id]);
  const [adaptationMode, setAdaptationMode] = useState<AdaptationMode>('crop');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProfiles = EXPORT_PROFILES.filter((profile) => profileIds.includes(profile.id));
  const hasPipelineSteps = scale > 1 || fps > 0;

  const handleFile = (selectedFile: File) => {
    setFile(selectedFile);
    setVideo(null);
    setJob(null);
    setExportJobs([]);
    setResult(null);
    setProcessing(false);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!file || !hasPipelineSteps) return;
    setProcessing(true);
    setError(null);

    try {
      const sourceVideo = video ?? await uploadVideo(file);
      setVideo(sourceVideo);

      const steps: Array<{ type: 'upscale' | 'interpolate'; parameters: Record<string, number> }> = [];
      // Interpolate first at the source resolution, then upscale the result.
      if (fps > 0) steps.push({ type: 'interpolate', parameters: { target_fps: Number(fps) } });
      if (scale > 1) steps.push({ type: 'upscale', parameters: { scale: Number(scale) } });

      setJob(await createJob(sourceVideo.id, steps));
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Ошибка при отправке задачи'));
      setProcessing(false);
    }
  };

  const handleExportSubmit = async () => {
    if (!file) return;
    if (!selectedProfiles.length) {
      setError('Выберите хотя бы один профиль экспорта');
      return;
    }
    setProcessing(true);
    setError(null);

    try {
      const sourceVideo = video ?? await uploadVideo(file);
      setVideo(sourceVideo);
      const outcomes = await Promise.allSettled(selectedProfiles.map(async (profile): Promise<ExportTask> => {
        return createVideoExport(sourceVideo.id, profile.id, adaptationMode);
      }));
      const created = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value] : []);
      const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
      setExportJobs((current) => [...current, ...created]);

      const hasActiveExports = created.some((task) =>
        !['ready', 'failed', 'cancelled'].includes(task.status));
      setProcessing(hasActiveExports);
      if (failures.length) {
        const firstFailure = failures[0];
        setError(
          `${failures.length} профиль(я) не удалось запустить. ${getErrorMessage(
            firstFailure.status === 'rejected' ? firstFailure.reason : undefined,
            'Проверьте выбранные профили и повторите попытку.',
          )}`,
        );
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Не удалось запустить экспорт'));
      setProcessing(false);
    }
  };

  const pendingExportIds = exportJobs
    .filter((task) => !['ready', 'failed', 'cancelled'].includes(task.status))
    .map((task) => task.id)
    .join('|');

  const jobId = job?.id;
  const jobStatus = job?.status;
  useEffect(() => {
    if (!jobId) return;
    if (jobStatus && ['completed', 'failed', 'cancelled'].includes(jobStatus)) {
      setProcessing(false);
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const updated = await getJobStatus(jobId);
        setJob(updated);
        if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
          setProcessing(false);
        }
      } catch (pollError) {
        setError(getErrorMessage(pollError, 'Не удалось обновить состояние обработки'));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [jobId, jobStatus]);

  useEffect(() => {
    const pendingIds = pendingExportIds ? pendingExportIds.split('|') : [];
    if (!pendingIds.length) return;

    const interval = window.setInterval(async () => {
      const updates = new Map<string, ExportJob>();
      await Promise.all(pendingIds.map(async (id) => {
        try {
          updates.set(id, await getVideoExport(id));
        } catch (pollError) {
          setError(getErrorMessage(pollError, 'Не удалось обновить состояние экспорта'));
        }
      }));
      setExportJobs((current) => current.map((task) => {
        const updated = updates.get(task.id);
        return updated || task;
      }));
    }, 2000);
    return () => window.clearInterval(interval);
  }, [pendingExportIds]);

  useEffect(() => {
    const exportsAreDone = exportJobs.length > 0
      && exportJobs.every((task) => ['ready', 'failed', 'cancelled'].includes(task.status));
    const jobIsDone = !job || ['completed', 'failed', 'cancelled'].includes(job.status);
    if (exportsAreDone && jobIsDone) setProcessing(false);
  }, [exportJobs, job]);

  useEffect(() => {
    if (job?.status !== 'completed' || result) return;
    getJobResult(job.id)
      .then(setResult)
      .catch((requestError: unknown) => {
        setError(getErrorMessage(requestError, 'Не удалось получить результат обработки'));
      });
  }, [job?.id, job?.status, result]);

  const tasks = useMemo<TaskView[]>(() => {
    const items: TaskView[] = [];
    if (job) {
      const stepViews: StepProgressView[] = (job.steps ?? []).map((step) => ({
        type: step.type,
        status: step.status,
        progress: step.status === 'completed' ? 100 : step.progress ?? 0,
      }));
      items.push({
        id: job.id,
        name: file?.name || `Обработка ${job.id.slice(0, 8)}`,
        kind: stepViews.length
          ? stepViews.map((step) => STEP_LABELS[step.type] || step.type).join(' + ')
          : 'Апскейл и интерполяция',
        status: job.status,
        progress: job.progress ?? 0,
        steps: stepViews,
        message: job.error?.message || job.message,
        downloadUrl: result ? resolveApiUrl(result.download_url) : undefined,
        createdAt: job.created_at,
      });
    }
    exportJobs.forEach((exportJob) => {
      const exportProfile = EXPORT_PROFILES.find((profile) => profile.id === exportJob.profile_id);
      items.push({
        id: exportJob.id,
        name: file?.name || `Экспорт ${exportJob.id.slice(0, 8)}`,
        kind: exportProfile?.title || exportJob.profile_id,
        status: exportJob.status,
        progress: exportJob.progress,
        message: exportJob.user_message || exportJob.error_code || undefined,
        downloadUrl: exportJob.status === 'ready'
          ? resolveApiUrl(`exports/${exportJob.id}/download`)
          : undefined,
        createdAt: exportJob.created_at,
      });
    });
    return items.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  }, [exportJobs, file?.name, job, result]);

  const projectsForUi = useMemo(() => {
    return tasks.map((task, index) => ({
      id: task.id,
      name: task.name,
      status: task.status === 'ready' || task.status === 'completed'
        ? 'done'
        : task.status === 'failed'
          ? 'err'
          : task.status === 'queued'
            ? 'queue'
            : 'run',
      progress: task.progress,
      meta: `${task.kind}${task.message ? `, ${task.message}` : ''}`,
      hue: 205 + index * 24,
      downloadUrl: task.downloadUrl,
    }));
  }, [tasks]);

  const handleQuickFile = (selectedFile: File) => {
    handleFile(selectedFile);
    setView('new');
  };

  const renderTaskList = (items: TaskView[]) => (
    items.length ? (
      <div className="proj-list">{items.map((task) => <TaskRow key={task.id} task={task} />)}</div>
    ) : (
      <div className="empty">Задач пока нет. Создайте обработку, чтобы она появилась здесь.</div>
    )
  );

  const renderWorkflowStatus = () => {
    const visibleTasks = tasks;
    return visibleTasks.length ? (
      <section className="panel">
        <div className="panel-head"><h3>Статус обработки</h3></div>
        {renderTaskList(visibleTasks)}
      </section>
    ) : null;
  };

  const setProfileOrientation = (aspectRatio: string) => {
    setProfileIds(EXPORT_PROFILES
      .filter((profile) => profile.aspectRatio === aspectRatio)
      .map((profile) => profile.id));
  };

  const isOrientationSelected = (aspectRatio: string) => {
    const matchingProfiles = EXPORT_PROFILES.filter((profile) => profile.aspectRatio === aspectRatio);
    return selectedProfiles.length === matchingProfiles.length
      && matchingProfiles.every((profile) => profileIds.includes(profile.id));
  };

  const renderProcessView = () => (
    <>
      <NewProcess
        file={file}
        video={video}
        onFile={handleFile}
        scale={scale}
        setScale={setScale}
        fps={fps}
        setFps={setFps}
        processing={processing}
        hasPipelineSteps={hasPipelineSteps}
        onStart={handleSubmit}
        onOpenAdaptation={() => setView('adapt')}
      />
      {renderWorkflowStatus()}
    </>
  );

  const renderAdaptView = () => (
    <>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Экспорт</span>
          <h2 className="welcome-title">Адаптация под платформу</h2>
          <p className="welcome-sub">Создайте отдельный экспорт для каждого выбранного профиля платформы.</p>
        </div>
      </div>

      <SourcePanel file={file} video={video} onFile={handleFile} disabled={processing} />

      <section className="panel">
        <div className="panel-head">
          <h3>2. Профиль экспорта</h3>
          <span className="muted-sm">Выберите одну или несколько платформ</span>
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
          {EXPORT_PROFILES.map((profile) => (
            <label
              key={profile.id}
              className={`profile-option${profileIds.includes(profile.id) ? ' selected' : ''}`}
            >
              <input
                type="checkbox"
                name="export-profile"
                value={profile.id}
                checked={profileIds.includes(profile.id)}
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
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>3. Способ адаптации</h3>
          <span className="muted-sm">Исходная частота кадров сохраняется</span>
        </div>
        <div className="mode-options">
          {ADAPTATION_MODES.map((mode) => (
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
              : 'Выберите профиль экспорта'}
          </div>
          <button
            className="btn btn-primary"
            onClick={handleExportSubmit}
            disabled={!file || processing}
          >
            {processing ? 'Экспорт…' : `Запустить экспорт${selectedProfiles.length > 1 ? `, ${selectedProfiles.length}` : ''}`}
          </button>
        </div>
        {exportJobs.length > 0 && (
          <div className="status-detail">
            Экспортов в текущей сессии: {exportJobs.length}, каждая задача обрабатывается отдельно.
          </div>
        )}
      </section>
      {renderWorkflowStatus()}
    </>
  );

  const renderDashboard = () => (
    <>
      <Dashboard
        user={user}
        projects={projectsForUi}
        onAddProject={handleQuickFile}
        onNewProcess={() => setView('new')}
      />
      {tasks.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h3>Текущие задачи</h3></div>
          {renderTaskList(tasks.slice(0, 4))}
        </section>
      )}
    </>
  );

  const renderProjects = () => (
    <>
      <Projects projects={projectsForUi} />
      {tasks.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h3>Текущие задачи</h3></div>
          {renderTaskList(tasks)}
        </section>
      )}
    </>
  );

  const renderView = () => {
    switch (view) {
      case 'new':
        return renderProcessView();
      case 'adapt':
        return renderAdaptView();
      case 'projects':
        return renderProjects();
      case 'settings':
        return <Settings user={user} onUpdateProfile={updateProfile} />;
      case 'billing':
        return <Billing currentPlan={getPlan()} onPlanChange={(plan: string) => updateProfile({ plan })} />;
      case 'admin':
        return <Admin />;
      default:
        return renderDashboard();
    }
  };

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}>Загрузка...</div>;

  if (!user) {
    if (view === 'auth') {
      return (
        <Auth
          mode={authMode}
          setMode={setAuthMode}
          onLogin={(email: string, name: string) => {
            login(email, name);
            setView('dashboard');
          }}
          onRegister={(name: string, email: string) => {
            register(name, email);
            setView('dashboard');
          }}
          onBack={() => setView('landing')}
        />
      );
    }

    return <Landing onAuthClick={(mode: 'login' | 'register') => {
      setAuthMode(mode);
      setView('auth');
    }} />;
  }

  return (
    <div id="appShell">
      <Sidebar
        currentView={view}
        setView={(nextView: View) => setView(nextView)}
        user={user}
        getPlan={getPlan}
        onLogout={() => {
          logout();
          setView('landing');
        }}
      />
      <div className="app-main">
        <header className="topbar">
          <h1>{VIEW_TITLES[view]}</h1>
          <div className="topbar-actions">
            <a className="btn btn-ghost btn-sm" href={resolveApiUrl('/docs')} target="_blank" rel="noreferrer">
              Документация API
            </a>
          </div>
        </header>
        <main className="content">
          {error && <div className="error-banner" role="alert">⚠️ {error}</div>}
          {renderView()}
        </main>
      </div>
    </div>
  );
}
