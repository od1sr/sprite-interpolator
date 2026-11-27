import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApiError,
  cancelJob,
  createJob,
  createVideoExport,
  estimateJob,
  getJobResult,
  getJobStatus,
  getVideoExport,
  listProjects,
  resolveApiUrl,
  uploadVideo,
} from './api/client';
import type {
  AdaptationMode,
  CreateJobStep,
  ExportJob,
  Job,
  JobEstimate,
  Project,
  User,
  Video,
} from './types/api';
import { useAuth } from './hooks/useAuth';
import { formatDuration, getStepTiming } from './utils/processingTime';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import Auth from './views/Auth';
import Dashboard from './views/Dashboard';
import Landing from './views/Landing';
import NewProcess from './views/NewProcess';
import Projects from './views/Projects';
import Settings from './views/Settings';
import './App.css';

type View = 'landing' | 'auth' | 'dashboard' | 'new' | 'projects' | 'settings';
type Theme = 'light' | 'dark';

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
  credits: number;
  refunded: boolean;
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
};

function taskFilter(status: string): string {
  if (status === 'ready' || status === 'completed') return 'done';
  if (status === 'failed') return 'err';
  if (status === 'cancelled' || status === 'cancelling') return 'cancel';
  if (status === 'queued') return 'queue';
  return 'run';
}

const STEP_LABELS: Record<string, string> = {
  upscale: 'Апскейл',
  interpolate: 'Интерполяция',
  color_correct: 'Коррекция цвета',
};

function TokenCost({
  credits,
  refunded,
  compact = false,
}: {
  credits: number;
  refunded: boolean;
  compact?: boolean;
}) {
  const amount = new Intl.NumberFormat('ru-RU').format(credits || 0);
  const wasRefunded = refunded && credits > 0;
  return (
    <div
      className={`proj-cost${compact ? ' proj-cost--compact' : ''}${wasRefunded ? ' proj-cost--refund' : ''}`}
      title={wasRefunded ? 'Списание отменено, токены возвращены' : 'Токены, списанные за задачу'}
    >
      <span className="proj-cost-value">{wasRefunded ? amount : `−${amount}`}</span>
      <span className="proj-cost-label">{wasRefunded ? 'возврат' : 'токены'}</span>
    </div>
  );
}

function buildJobSteps(
  scale: number,
  fps: number,
  colorPreset: string,
  smartColor: boolean,
  sharpness: number,
): CreateJobStep[] {
  const steps: CreateJobStep[] = [];
  // Interpolate first at the source resolution, then upscale and correct color.
  if (fps > 0) steps.push({ type: 'interpolate', parameters: { target_fps: Number(fps) } });
  if (scale > 1) steps.push({ type: 'upscale', parameters: { scale: Number(scale) } });
  // Color correction is always the last step of the pipeline.
  if (smartColor || colorPreset || sharpness > 0) {
    const colorParameters: Record<string, number | string> = smartColor
      ? { mode: 'smart' }
      : colorPreset
        ? { mode: 'preset', preset: colorPreset }
        : { mode: 'preset' };
    if (sharpness > 0) colorParameters.sharpness = Number(sharpness);
    steps.push({ type: 'color_correct', parameters: colorParameters });
  }
  return steps;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function SubtaskRow({ task }: { task: TaskView }) {
  const isReady = task.status === 'ready' || task.status === 'completed';
  const isFailed = task.status === 'failed';
  const progress = Math.max(0, Math.min(100, task.progress));

  return (
    <div className={`proj-subtask proj-status-${taskFilter(task.status)}`}>
      <div className="proj-subtask-main">
        <div className="proj-name">
          <span className="truncate" title={task.name}>{task.name}</span>
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
      <TokenCost credits={task.credits} refunded={task.refunded} compact />
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
  const progress = Math.max(0, Math.min(100, task.progress));
  const showSteps = Boolean(task.steps && task.steps.length > 0);

  return (
    <>
    <div className={`proj proj-status-${taskFilter(task.status)}`}>
      <div className="thumb" aria-hidden="true" />
      <div className="proj-main">
        <div className="proj-name">
          <span className="truncate" title={task.name}>{task.name}</span>
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
              ? formatDuration(step.elapsedSeconds)
              : step.status === 'processing' && step.remainingSeconds != null
                ? `~${formatDuration(step.remainingSeconds)}`
                : null;
            return (
              <div key={`${task.id}-${step.type}-${index}`} className="proj-step">
                <div className="proj-step-head">
                  <span>{STEP_LABELS[step.type] || step.type}</span>
                  <span className="pct">{Math.round(stepProgress)}%</span>
                </div>
                <div className="proj-step-bar">
                  <div className={`bar${stepDone ? ' done' : step.status === 'processing' ? ' active' : ''}`}>
                    <i style={{ width: `${stepProgress}%` }} />
                  </div>
                  {timeLabel && <span className="step-time">{timeLabel}</span>}
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
      <TokenCost credits={task.credits} refunded={task.refunded} />
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
  const { user, isLoading, login, register, logout, buyPlan, refreshUser, getPlan, updateProfile } = useAuth();
  const currentUserId = user ? (user as User).id : null;
  const tokenBalance = user ? (user as User).token_balance : 0;
  const [view, setView] = useState<View>('landing');
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return window.localStorage.getItem('zarya.theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [projectFilter, setProjectFilter] = useState('all');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [file, setFile] = useState<File | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scale, setScale] = useState<number>(2);
  const [fps, setFps] = useState<number>(0);
  const [colorPreset, setColorPreset] = useState('');
  const [smartColor, setSmartColor] = useState(false);
  const [sharpness, setSharpness] = useState(0);
  const [profileIds, setProfileIds] = useState<string[]>([EXPORT_PROFILES[0].id]);
  const [adaptationMode, setAdaptationMode] = useState<AdaptationMode>('crop');
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<JobEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const uploadSequence = useRef(0);

  const resetWorkspace = () => {
    uploadSequence.current += 1;
    setFile(null);
    setVideo(null);
    setJob(null);
    setProjects([]);
    setError(null);
    setEstimate(null);
    setEstimateError(null);
    setProcessing(false);
    setUploading(false);
    setScale(2);
    setFps(0);
    setColorPreset('');
    setSmartColor(false);
    setSharpness(0);
  };

  const toggleTheme = () => {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('zarya.theme', theme);
    } catch {
      // Storage can be disabled; the theme still applies for this session.
    }
  }, [theme]);

  useEffect(() => {
    const handleUnauthorized = () => {
      resetWorkspace();
      setView('auth');
    };
    window.addEventListener('zarya:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('zarya:unauthorized', handleUnauthorized);
  }, []);

  const selectedProfiles = EXPORT_PROFILES.filter((profile) => profileIds.includes(profile.id));
  const hasPipelineSteps = scale > 1 || fps > 0 || smartColor || Boolean(colorPreset) || sharpness > 0;
  const steps = useMemo(
    () => buildJobSteps(scale, fps, colorPreset, smartColor, sharpness),
    [scale, fps, colorPreset, smartColor, sharpness],
  );

  // The server is the source of truth for pricing. Refresh whenever the
  // configuration or the balance changes, so the button reflects real funds.
  useEffect(() => {
    if (!video?.id || !hasPipelineSteps) {
      setEstimate(null);
      setEstimateLoading(false);
      setEstimateError(null);
      return undefined;
    }

    let active = true;
    setEstimateLoading(true);
    setEstimateError(null);
    const timer = window.setTimeout(() => {
      estimateJob(video.id, steps, profileIds)
        .then((result) => { if (active) setEstimate(result); })
        .catch((requestError: unknown) => {
          if (active) {
            setEstimate(null);
            setEstimateError(getErrorMessage(requestError, 'Не удалось рассчитать стоимость'));
          }
        })
        .finally(() => { if (active) setEstimateLoading(false); });
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [video?.id, hasPipelineSteps, steps, profileIds, tokenBalance]);

  const handleFile = (selectedFile: File) => {
    const token = ++uploadSequence.current;
    setFile(selectedFile);
    setVideo(null);
    setJob(null);
    setColorPreset('');
    setSmartColor(false);
    setSharpness(0);
    setProcessing(false);
    setUploading(true);
    setError(null);
    setEstimate(null);
    setEstimateError(null);

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
          credits_cost: createdJob.credits_cost,
          credits_refunded: createdJob.credits_refunded,
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

      // The balance changed on the server; keep the topbar and estimate in sync.
      await refreshUser().catch(() => undefined);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Ошибка при запуске обработки'));
      if (requestError instanceof ApiError && requestError.code === 'INSUFFICIENT_TOKENS') {
        await refreshUser().catch(() => undefined);
      }
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

  // The worker refunds failed jobs and cancellations after processing starts.
  useEffect(() => {
    if (!jobStatus || !['failed', 'cancelled'].includes(jobStatus)) return;
    void refreshUser().catch(() => undefined);
  }, [jobStatus, refreshUser]);

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

  // Load the workspace as soon as the session is known, so the dashboard
  // counters are correct on the first render after login or page reload.
  useEffect(() => {
    if (!currentUserId) return;
    let active = true;
    listProjects()
      .then((page) => {
        if (active) setProjects((current) => mergeProjects(current, page.items));
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError, 'Не удалось загрузить проекты'));
      });
    return () => { active = false; };
  }, [currentUserId]);

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
      credits: exportJob.credits_cost,
      refunded: exportJob.credits_refunded,
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
      credits: project.credits_cost,
      refunded: project.credits_refunded,
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
          : task.status === 'cancelled' || task.status === 'cancelling'
            ? 'cancel'
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
      await refreshUser().catch(() => undefined);
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

  // Billing now lives on the dashboard; jump to it from the cost panel.
  const goToBilling = () => {
    setView('dashboard');
    window.setTimeout(() => {
      document.getElementById('billing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const openProjects = (filter: string) => {
    setProjectFilter(filter);
    setView('projects');
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
        colorPreset={colorPreset}
        setColorPreset={setColorPreset}
        smartColor={smartColor}
        setSmartColor={setSmartColor}
        sharpness={sharpness}
        setSharpness={setSharpness}
        processing={processing}
        uploading={uploading}
        hasPipelineSteps={hasPipelineSteps}
        exportProfiles={EXPORT_PROFILES}
        selectedProfileIds={profileIds}
        setProfileIds={setProfileIds}
        adaptationMode={adaptationMode}
        setAdaptationMode={setAdaptationMode}
        adaptationModes={ADAPTATION_MODES}
        estimate={estimate}
        estimateLoading={estimateLoading}
        estimateError={estimateError}
        tokenBalance={tokenBalance}
        onTopUp={goToBilling}
        onStart={handleSubmit}
      />
    </>
  );

  const renderDashboard = () => (
    <Dashboard
      user={user}
      projects={projectsForUi}
      onNewProcess={() => setView('new')}
      onPlanChange={buyPlan}
      onOpenProjects={openProjects}
    />
  );

  const renderProjects = () => (
    <div className="projects-page">
      <Projects filter={projectFilter} onFilterChange={setProjectFilter} />
      <section className="panel projects-panel">
        {renderTaskList(
          projectFilter === 'all'
            ? tasks
            : tasks.filter((task) => taskFilter(task.status) === projectFilter),
        )}
      </section>
    </div>
  );

  const renderView = () => {
    switch (view) {
      case 'new':
        return renderProcessView();
      case 'projects':
        return renderProjects();
      case 'settings':
        return <Settings user={user} onUpdateProfile={updateProfile} />;
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
          onLogin={async (loginName: string, password: string) => {
            await login(loginName, password);
            resetWorkspace();
            setView('dashboard');
          }}
          onRegister={async (loginName: string, password: string, displayName: string) => {
            await register(loginName, password, displayName);
            resetWorkspace();
            setView('dashboard');
          }}
          onBack={() => setView('landing')}
        />
      );
    }

    return <Landing
      onAuthClick={(mode: 'login' | 'register') => {
        setAuthMode(mode);
        setView('auth');
      }}
      theme={theme}
      onToggleTheme={toggleTheme}
    />;
  }

  const handleLogout = async () => {
    resetWorkspace();
    await logout();
    setView('landing');
  };

  return (
    <div id="appShell">
      <Sidebar
        currentView={view}
        setView={(nextView: View) => setView(nextView)}
        user={user}
        getPlan={getPlan}
      />
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-id">
            <h1>{VIEW_TITLES[view]}</h1>
          </div>
          <div className="topbar-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <div className="token-balance" title="Доступные токены">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l7 4v12l-7 4-7-4V6z" />
                <path d="M12 6l3.5 2v8L12 18l-3.5-2V8z" />
                <path d="M12 6v12M8.5 8L12 10l3.5-2M8.5 16L12 14l3.5 2" />
              </svg>
              <b>{new Intl.NumberFormat('ru-RU').format(tokenBalance)}</b>
              <span>токенов</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
                <path d="M10 16l-4-4 4-4" />
                <path d="M6 12h10" />
              </svg>
              Выйти
            </button>
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
