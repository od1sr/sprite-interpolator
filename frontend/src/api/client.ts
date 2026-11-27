import type {
  AccountDataDeletion,
  AdaptationMode,
  CreateJobStep,
  ExportJob,
  Job,
  JobEstimate,
  LoginRequest,
  Payment,
  ProjectPage,
  PurchasePlanRequest,
  RegisterRequest,
  Result,
  User,
  Video,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Ошибка запроса (${response.status})`;
    let code: string | undefined;
    const body = await response.text();
    if (body) {
      try {
        const data = JSON.parse(body);
        message = data?.error?.message || body;
        code = data?.error?.code;
      } catch {
        message = body;
      }
    }
    throw new ApiError(response.status, message, code);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
  });
  if (response.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new CustomEvent('zarya:unauthorized'));
  }
  return handleResponse<T>(response);
}

function jsonRequest<T>(path: string, method: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function registerUser(payload: RegisterRequest): Promise<User> {
  return jsonRequest<User>('/auth/register', 'POST', payload);
}

export async function loginUser(payload: LoginRequest): Promise<User> {
  return jsonRequest<User>('/auth/login', 'POST', payload);
}

export function getCurrentUser(): Promise<User> {
  return request<User>('/auth/me');
}

export async function logoutUser(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' });
}

export function deleteAllUserData(): Promise<AccountDataDeletion> {
  return request<AccountDataDeletion>('/account/data', { method: 'DELETE' });
}

export function purchasePlan(payload: PurchasePlanRequest): Promise<User> {
  return jsonRequest<User>('/billing/purchase', 'POST', payload);
}

export function listPayments(): Promise<Payment[]> {
  return request<Payment[]>('/billing/payments');
}

export async function uploadVideo(file: File): Promise<Video> {
  const formData = new FormData();
  formData.append('file', file);
  return request<Video>('/videos', { method: 'POST', body: formData });
}

export async function createJob(
  videoId: string,
  steps: CreateJobStep[],
): Promise<Job> {
  return jsonRequest<Job>('/jobs', 'POST', { video_id: videoId, steps });
}

export async function estimateJob(
  videoId: string,
  steps: CreateJobStep[],
  exportProfileIds: string[],
): Promise<JobEstimate> {
  return jsonRequest<JobEstimate>('/jobs/estimate', 'POST', {
    video_id: videoId,
    steps,
    export_profile_ids: exportProfileIds,
  });
}

export async function getColorPreview(
  videoId: string,
  mode: 'preset' | 'smart',
  preset: string | null,
  sharpness: number,
): Promise<{ before: string; after: string }> {
  return jsonRequest<{ before: string; after: string }>(
    `/videos/${videoId}/color-preview`,
    'POST',
    { mode, preset: mode === 'preset' ? preset : null, sharpness },
  );
}

export function getJobStatus(jobId: string): Promise<Job> {
  return request<Job>(`/jobs/${jobId}`);
}

export function listProjects(): Promise<ProjectPage> {
  return request<ProjectPage>('/jobs?limit=100');
}

export function cancelJob(jobId: string): Promise<Job> {
  return request<Job>(`/jobs/${jobId}/cancel`, { method: 'POST' });
}

export function getJobResult(jobId: string): Promise<Result> {
  return request<Result>(`/jobs/${jobId}/result`);
}

export async function createVideoExport(
  videoId: string,
  profileId: string,
  adaptationMode: AdaptationMode,
  jobId?: string,
): Promise<ExportJob> {
  return jsonRequest<ExportJob>(`/videos/${videoId}/exports`, 'POST', {
    profile_id: profileId,
    adaptation_mode: adaptationMode,
    job_id: jobId ?? null,
  });
}

export function getVideoExport(exportId: string): Promise<ExportJob> {
  return request<ExportJob>(`/exports/${exportId}`);
}

export function resolveApiUrl(path: string): string {
  return new URL(path, `${BASE_URL.replace(/\/+$/, '')}/`).toString();
}
