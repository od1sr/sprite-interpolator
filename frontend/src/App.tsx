import { useEffect, useMemo, useRef, useState } from 'react';
import {
  cancelJob,
  createJob,
  createVideoExport,
  getJobResult,
  getJobStatus,
  getVideoExport,
  listProjects,
  resolveApiUrl,
  uploadVideo,
} from './api/client';
import type {
  AdaptationMode,
  ExportJob,
  Job,
  Project,
  Video,
} from './types/api';
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

function mergeExports(base: ExportJob[], updates: ExportJob[]): ExportJob[] {
  const byId = new Map(base.map((task) => [task.id, task]));
  for (const task of updates) byId.set(task.id, task);
  return [...byId.values()];
}

function mergeProjects(current: Project[], incoming: Project[]): Project[] {
  const byId = new Map(current.map((project) => [project.id, project]));
  return incoming.map((project) => {
    const existing = byId.get(project.id);
    return {
      ...existing,
      ...project,
      exports: mergeExports(existing?.exports ?? [], project.exports),
      download_url: project.download_url || existing?.download_url || null,
    };
  });
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
    platform: 'TikTok / ВКонтакте',
    contentType: 'Вертикальное видео',
    title: 'TikTok / ВКонтакте — вертикальное',
    dimensions: '1080 × 1920',
    aspectRatio: '9:16',
    codec: 'MP4, H.264, AAC',
  },
  {
    id: 'instagram_square_v1',
    platform: 'Instagram',
    contentType: 'Квадратное видео',
    title: 'Instagram — квадрат',
    dimensions: '1080 × 1080',
    aspectRatio: '1:1',
    codec: 'MP4, H.264, AAC',
  },
  {
    id: 'instagram_feed_v1',
    platform: 'Instagram',
    contentType: 'Вертикаль для ленты',
    title: 'Instagram — лента 4:5',
    dimensions: '1080 × 1350',
    aspectRatio: '4:5',
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

function taskFilter(status: string): string {
  if (status === 'ready' || status === 'completed') return 'done';
  if (status === 'failed') return 'err';
  if (status === 'queued') return 'queue';
  return 'run';
}

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

function TaskRow({
  task,
  onCancel,
}: {
  task: TaskView;
  onCancel?: (jobId: string) => void;
}) {
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
      {['queued', 'processing', 'cancelling'].includes(task.status) && onCancel && (
        <button
          className="btn btn-ghost btn-sm task-cancel"
          onClick={() => onCancel(task.id)}
          disabled={task.status === 'cancelling'}
        >
          {task.status === 'cancelling' ? 'Отмена…' : 'Отменить'}
        </button>
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
  const [projectFilter, setProjectFilter] = useState('all');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [file, setFile] = useState<File | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scale, setScale] = useState<number>(2);
  const [fps, setFps] = useState<number>(0);
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

      const createdJob = await createJob(sourceVideo.id, steps);
      setJob(createdJob);
      setProjects((current) => [
        {
          id: createdJob.id,
          video_id: createdJob.video_id,
          video_filename: sourceVideo.filename,
          status: createdJob.status,
          steps: createdJob.steps,
          progress: createdJob.progress ?? 0,
          current_step: createdJob.current_step,
          message: createdJob.message ?? null,
          result_id: createdJob.result_id,
          error: createdJob.error,
          created_at: createdJob.created_at,
          started_at: createdJob.started_at,
          finished_at: createdJob.finished_at,
          exports: [],
          download_url: null,
        },
        ...current,
      ]);
      setView('projects');

      if (selectedProfiles.length) {
        const outcomes = await Promise.allSettled(selectedProfiles.map(async (profile): Promise<ExportJob> => {
          return createVideoExport(sourceVideo.id, profile.id, adaptationMode, createdJob.id);
        }));
        const created = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value] : []);
        const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
        setProjects((current) => current.map((project) => (
          project.id === createdJob.id
            ? { ...project, exports: mergeExports(project.exports, created) }
            : project
        )));
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

  const pendingExportIds = projects
    .flatMap((project) => project.exports)
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
        const updated = await getJobStatus(jobId);
        setJob(updated);
        setProjects((current) => current.map((project) => (
          project.id === updated.id
            ? { ...project, ...updated }
            : project
        )));
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
      setProjects((current) => current.map((project) => ({
        ...project,
        exports: project.exports.map((task) => updates.get(task.id) || task),
      })));
    }, 2000);
    return () => window.clearInterval(interval);
  }, [pendingExportIds]);

  // The form stays locked until the active AI job and its exports finish.
  useEffect(() => {
    if (!job || !['completed', 'failed', 'cancelled'].includes(job.status)) return;
    const activeProject = projects.find((project) => project.id === job.id);
    const exportsAreDone = (activeProject?.exports ?? [])
      .every((task) => ['ready', 'failed', 'cancelled'].includes(task.status));
    if (exportsAreDone) setProcessing(false);
  }, [job, projects]);

  useEffect(() => {
    if (job?.status !== 'completed') return;
    getJobResult(job.id)
      .then((download) => {
        setProjects((current) => current.map((project) => (
          project.id === job.id
            ? { ...project, download_url: download.download_url }
            : project
        )));
      })
      .catch((requestError: unknown) => {
        setError(getErrorMessage(requestError, 'Не удалось получить результат обработки'));
      });
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (view !== 'projects') return;
    listProjects()
      .then((page) => {
        setProjects((current) => mergeProjects(current, page.items));
      })
      .catch((requestError: unknown) => {
        setError(getErrorMessage(requestError, 'Не удалось загрузить проекты'));
      });
  }, [view]);

  const activeProjectsKey = projects
    .filter((project) => (
      ['queued', 'processing', 'cancelling'].includes(project.status)
      || project.exports.some((task) => ['queued', 'processing'].includes(task.status))
    ))
    .map((project) => project.id)
    .join('|');

  useEffect(() => {
    if (!activeProjectsKey) return;

    const interval = window.setInterval(async () => {
      try {
        const page = await listProjects();
        setProjects((current) => mergeProjects(current, page.items));
      } catch (pollError) {
        setError(getErrorMessage(pollError, 'Не удалось обновить проекты'));
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [activeProjectsKey]);

  const resolveExportView = (exportJob: ExportJob, projectName: string): TaskView => {
    const exportProfile = EXPORT_PROFILES.find((profile) => profile.id === exportJob.profile_id);
    return {
      id: exportJob.id,
      name: projectName,
      kind: exportProfile?.title || exportJob.profile_id,
      status: exportJob.status,
      progress: exportJob.progress,
      message: exportJob.user_message || exportJob.error_code || undefined,
      downloadUrl: exportJob.status === 'ready'
        ? resolveApiUrl(`exports/${exportJob.id}/download`)
        : undefined,
      createdAt: exportJob.created_at,
    };
  };

  const tasks = useMemo<TaskView[]>(() => projects.map((project) => {
    const timings = project.id === job?.id
      ? (project.steps ?? []).map((step) => getStepTiming(step, clock))
      : [];
    const stepViews: StepProgressView[] = (project.steps ?? []).map((step, stepIndex) => ({
      type: step.type,
      status: step.status,
      progress: step.status === 'completed' ? 100 : step.progress ?? 0,
      elapsedSeconds: timings[stepIndex]?.elapsedSeconds ?? null,
      remainingSeconds: timings[stepIndex]?.remainingSeconds ?? null,
    }));
    return {
      id: project.id,
      name: project.video_filename,
      kind: stepViews.length
        ? stepViews.map((step) => STEP_LABELS[step.type] || step.type).join(' + ')
        : 'Апскейл и интерполяция',
      status: project.status,
      progress: project.progress ?? 0,
      steps: stepViews,
      subtasks: project.exports.map((exportJob) => resolveExportView(exportJob, project.video_filename)),
      message: project.error?.message || project.message || undefined,
      downloadUrl: project.download_url
        ? resolveApiUrl(project.download_url)
        : undefined,
      createdAt: project.created_at,
    };
  }).sort((first, second) => second.createdAt.localeCompare(first.createdAt)), [
    clock,
    job?.id,
    projects,
  ]);

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

  const handleCancelJob = async (jobId: string) => {
    try {
      const updated = await cancelJob(jobId);
      setJob((current) => (current?.id === jobId ? updated : current));
      setProjects((current) => current.map((project) => (
        project.id === jobId
          ? {
              ...project,
              ...updated,
              exports: project.exports.map((task) => (
                ['queued', 'processing', 'cancelling'].includes(task.status)
                  ? { ...task, status: 'cancelled', user_message: 'Задача отменена' }
                  : task
              )),
            }
          : project
      )));
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Не удалось отменить обработку'));
    }
  };

  const renderTaskList = (items: TaskView[]) => (
    items.length ? (
      <div className="proj-list">
        {items.map((task) => <TaskRow key={task.id} task={task} onCancel={handleCancelJob} />)}
      </div>
    ) : (
      <div className="empty">Задач пока нет. Создайте обработку, чтобы она появилась здесь.</div>
    )
  );

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
        exportJobsCount={selectedProfiles.length}
        onStart={handleSubmit}
      />
    </>
  );

  const renderDashboard = () => (
    <Dashboard
      user={user}
      projects={projectsForUi}
      onNewProcess={() => setView('new')}
    />
  );

  const renderProjects = () => (
    <>
      <Projects filter={projectFilter} onFilterChange={setProjectFilter} />
      <section className="panel">
        <div className="panel-head"><h3>Текущие задачи</h3></div>
        {renderTaskList(
          projectFilter === 'all'
            ? tasks
            : tasks.filter((task) => taskFilter(task.status) === projectFilter),
        )}
      </section>
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
