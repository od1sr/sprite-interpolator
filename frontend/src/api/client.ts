import type {
  AdaptationMode,
  ExportJob,
  Job,
  ProjectPage,
  Result,
  Video,
} from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Ошибка запроса (${response.status})`;
    const body = await response.text();
    if (body) {
      try {
        const data = JSON.parse(body);
        message = data?.error?.message || body;
      } catch {
        message = body;
      }
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function uploadVideo(file: File): Promise<Video> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}/videos`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<Video>(response);
}

export async function createJob(
  videoId: string,
  steps: Array<{ type: 'upscale' | 'interpolate'; parameters: Record<string, number> }>,
): Promise<Job> {
  const response = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId, steps }),
  });
  return handleResponse<Job>(response);
}

export async function getJobStatus(jobId: string): Promise<Job> {
  const response = await fetch(`${BASE_URL}/jobs/${jobId}`);
  return handleResponse<Job>(response);
}

export async function listProjects(): Promise<ProjectPage> {
  const response = await fetch(`${BASE_URL}/jobs?limit=100`);
  return handleResponse<ProjectPage>(response);
}

export async function getJobResult(jobId: string): Promise<Result> {
  const response = await fetch(`${BASE_URL}/jobs/${jobId}/result`);
  return handleResponse<Result>(response);
}

export async function createVideoExport(
  videoId: string,
  profileId: string,
  adaptationMode: AdaptationMode,
  jobId?: string,
): Promise<ExportJob> {
  const response = await fetch(`${BASE_URL}/videos/${videoId}/exports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile_id: profileId,
      adaptation_mode: adaptationMode,
      job_id: jobId ?? null,
    }),
  });
  return handleResponse<ExportJob>(response);
}

export async function getVideoExport(exportId: string): Promise<ExportJob> {
  const response = await fetch(`${BASE_URL}/exports/${exportId}`);
  return handleResponse<ExportJob>(response);
}

export function resolveApiUrl(path: string): string {
  return new URL(path, `${BASE_URL.replace(/\/+$/, '')}/`).toString();
}
