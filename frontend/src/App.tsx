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
import { formatDuration, getStepTiming } from './utils/processingTime';
import Sidebar from './components/Sidebar';
import Auth from './views/Auth';
import Billing from './views/Billing';
import Dashboard from './views/Dashboard';
import Landing from './views/Landing';
import NewProcess from './views/NewProcess';
import Projects from './views/Projects';
import Settings from './views/Settings';
import './App.css';

type View = 'landing' | 'auth' | 'dashboard' | 'new' | 'projects' | 'settings' | 'billing';

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
  elapsedSeconds: number | null;
  remainingSeconds: number | null;
}

interface TaskView {
  id: string;
  name: string;
  kind: string;
  status: string;
  progress: number;
  steps?: StepProgressView[];
  subtasks?: TaskView[];
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
  projects: 'Проекты',
  settings: 'Настройки аккаунта',
  billing: 'Тариф и оплата',
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

function SubtaskRow({ task }: { task: TaskView }) {
  const isReady = task.status === 'ready' || task.status === 'completed';
  const isFailed = task.status === 'failed';
  const tone = isReady ? 'pill-ok' : isFailed ? 'pill-err' : task.status === 'queued' ? '' : 'pill-run';
  const progress = Math.max(0, Math.min(100, task.progress));

  return (
    <div className="proj-subtask">
      <div className="proj-subtask-main">
        <div className="proj-name">
          <span title={task.name}>{task.name}</span>
          <span className={`pill ${tone}`}>{STATUS_LABELS[task.status] || task.status}</span>
        </div>
        <div className="proj-meta">
          {task.kind}{task.message ? `, ${task.message}` : ''}
          {!isReady && !isFailed && task.status !== 'queued' && ` · ${Math.round(progress)}%`}
        </div>
      </div>
      <div className="proj-bar">
        <div className={`bar${isReady ? ' done' : task.status === 'processing' ? ' active' : ''}`}>
          <i style={{ width: `${isReady ? 100 : progress}%` }} />
        </div>
        <span className="pct">{Math.round(isReady ? 100 : progress)}%</span>
      </div>
      {task.downloadUrl && (
        <a className="btn btn-ghost btn-sm" href={task.downloadUrl} download>
          Скачать
        </a>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: TaskView }) {
  const isReady = task.status === 'ready' || task.status === 'completed';
  const isFailed = task.status === 'failed';
  const tone = isReady ? 'pill-ok' : isFailed ? 'pill-err' : task.status === 'queued' ? '' : 'pill-run';
  const progress = Math.max(0, Math.min(100, task.progress));
  const showSteps = Boolean(task.steps && task.steps.length > 1);

  return (
    <>
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
            const timeLabel = stepDone && step.elapsedSeconds != null
              ? ` · ${formatDuration(step.elapsedSeconds)}`
              : null;
            const statusLabel = step.status === 'processing' && step.remainingSeconds != null
              ? `осталось ${formatDuration(step.remainingSeconds)}`
              : `${stepDone ? 'Готово' : STATUS_LABELS[step.status] || step.status}${timeLabel ?? ''}`;
            return (
              <div key={`${task.id}-${step.type}-${index}`} className="proj-step">
                <div className="proj-step-head">
                  <span>{STEP_LABELS[step.type] || step.type}</span>
                  <span>{statusLabel}</span>
                </div>
                <div className="proj-step-bar">
                  <div className={`bar${stepDone ? ' done' : step.status === 'processing' ? ' active' : ''}`}>
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
          <div className={`bar${isReady ? ' done' : task.status === 'processing' ? ' active' : ''}`}>
            <i style={{ width: `${isReady ? 100 : progress}%` }} />
          </div>
          <span className="pct">{Math.round(isReady ? 100 : progress)}%</span>
        </div>
      )}
    </div>
    {task.subtasks && task.subtasks.length > 0 && (
      <div className="proj-subtasks">
        <div className="proj-subtasks-head">Экспорт</div>
        {task.subtasks.map((subtask) => <SubtaskRow key={subtask.id} task={subtask} />)}
      </div>
    )}
    </>
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const uploadSequence = useRef(0);

  const selectedProfiles = EXPORT_PROFILES.filter((profile) => profileIds.includes(profile.id));
  const hasPipelineSteps = scale > 1 || fps > 0;

  const handleFile = (selectedFile: File) => {
    const token = ++uploadSequence.current;
    setFile(selectedFile);
    setVideo(null);
    setJob(null);
    setExportJobs([]);
    setResult(null);
    setProcessing(false);
    setUploading(true);
    setError(null);

    // Upload immediately so the file metadata is available before the user
    // configures the pipeline. Ignore responses for replaced files.
    void uploadVideo(selectedFile)
      .then((uploaded) => {
        if (token === uploadSequence.current) {
          setVideo(uploaded);
          setUploading(false);
        }
      })
      .catch((requestError: unknown) => {
        if (token === uploadSequence.current) {
          setUploading(false);
          setError(getErrorMessage(requestError, 'Не удалось загрузить видео'));
        }
      });
  };

  const handleSubmit = async () => {
    if (!file || !video || !hasPipelineSteps) return;
    setProcessing(true);
    setError(null);

    try {
      const sourceVideo = video;

      const steps: Array<{ type: 'upscale' | 'interpolate'; parameters: Record<string, number> }> = [];
      // Interpolate first at the source resolution, then upscale the result.
      if (fps > 0) steps.push({ type: 'interpolate', parameters: { target_fps: Number(fps) } });
      if (scale > 1) steps.push({ type: 'upscale', parameters: { scale: Number(scale) } });

      setJob(await createJob(sourceVideo.id, steps));

      if (selectedProfiles.length) {
        const outcomes = await Promise.allSettled(selectedProfiles.map(async (profile): Promise<ExportTask> => {
          return createVideoExport(sourceVideo.id, profile.id, adaptationMode);
        }));
        const created = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value] : []);
        const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
        setExportJobs((current) => [...current, ...created]);
        if (failures.length) {
          const firstFailure = failures[0];
          setError(
            `${failures.length} профиль(я) экспорта не удалось запустить. ${getErrorMessage(
              firstFailure.status === 'rejected' ? firstFailure.reason : undefined,
              'Проверьте выбранные профили и повторите попытку.',
            )}`,
          );
        }
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Ошибка при запуске обработки'));
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
    if (jobStatus && ['completed', 'failed', 'cancelled'].includes(jobStatus)) return;

    const interval = window.setInterval(async () => {
      try {
        setJob(await getJobStatus(jobId));
      } catch (pollError) {
        setError(getErrorMessage(pollError, 'Не удалось обновить состояние обработки'));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [jobId, jobStatus]);

  // Keep step ETAs moving even between API responses.
  useEffect(() => {
    if (!jobId || (jobStatus && ['completed', 'failed', 'cancelled'].includes(jobStatus))) return;
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
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

  // The form stays locked until both the AI job and all export jobs finish.
  useEffect(() => {
    const exportsAreDone = exportJobs.every((task) => ['ready', 'failed', 'cancelled'].includes(task.status));
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

  const jobStepTimings = useMemo(
    () => (job?.steps ?? []).map((step) => getStepTiming(step, clock)),
    [job?.steps, clock],
  );

  const tasks = useMemo<TaskView[]>(() => {
    const items: TaskView[] = [];
    const exportTaskViews: TaskView[] = exportJobs.map((exportJob) => {
      const exportProfile = EXPORT_PROFILES.find((profile) => profile.id === exportJob.profile_id);
      return {
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
      };
    });
    if (job) {
      const stepViews: StepProgressView[] = (job.steps ?? []).map((step, index) => ({
        type: step.type,
        status: step.status,
        progress: step.status === 'completed' ? 100 : step.progress ?? 0,
        elapsedSeconds: jobStepTimings[index]?.elapsedSeconds ?? null,
        remainingSeconds: jobStepTimings[index]?.remainingSeconds ?? null,
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
        subtasks: exportTaskViews,
        message: job.error?.message || job.message,
        downloadUrl: result ? resolveApiUrl(result.download_url) : undefined,
        createdAt: job.created_at,
      });
    } else {
      items.push(...exportTaskViews);
    }
    return items.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  }, [exportJobs, file?.name, job, jobStepTimings, result]);

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
        uploading={uploading}
        hasPipelineSteps={hasPipelineSteps}
        exportProfiles={EXPORT_PROFILES}
        selectedProfileIds={profileIds}
        setProfileIds={setProfileIds}
        adaptationMode={adaptationMode}
        setAdaptationMode={setAdaptationMode}
        adaptationModes={ADAPTATION_MODES}
        exportJobsCount={exportJobs.length}
        onStart={handleSubmit}
      />
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
      case 'projects':
        return renderProjects();
      case 'settings':
        return <Settings user={user} onUpdateProfile={updateProfile} />;
      case 'billing':
        return <Billing currentPlan={getPlan()} onPlanChange={(plan: string) => updateProfile({ plan })} />;
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
