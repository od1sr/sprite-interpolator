// src/api/client.ts
import type { Video, Job, Result } from '../types/api';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// --- Вспомогательные функции для МОКОВ ---
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let pollCount = 0;

// --- Вспомогательная функция для обработки РЕАЛЬНЫХ ошибок ---
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = 'Ошибка запроса';
    try {
      const data = await response.json();
      // В api.md написано, что ошибка приходит в формате { error: { message } }
      if (data?.error?.message) errorMessage = data.error.message;
    } catch (e) {}
    throw new Error(errorMessage);
  }
  if (response.status === 204) return {} as T;
  return response.json();
}

export async function uploadVideo(file: File): Promise<Video> {
  if (USE_MOCKS) {
    console.log('Используем мок для загрузки:', BASE_URL);
    await delay(1000);
    return {
      id: "fake-video-123",
      filename: file.name,
      content_type: "video/mp4",
      size_bytes: file.size,
      duration_seconds: 32.5,
      width: 1920,
      height: 1080,
      fps: 30,
      codec: "h264",
      created_at: new Date().toISOString()
    };
  }

  // РЕАЛЬНЫЙ ЗАПРОС
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}/videos`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<Video>(response);
}

export async function createJob(video_id: string, steps: any[]): Promise<Job> {
  if (USE_MOCKS) {
    await delay(1000);
    const now = new Date().toISOString();
    return {
      id: "fake-job-456",
      video_id,
      status: "queued",
      steps: steps.map((s) => ({ ...s, status: 'queued', progress: 0, created_at: now, updated_at: now })),
      progress: 0,
      current_step: null,
      message: "Задача добавлена в очередь",
      result_id: null,
      error: null,
      created_at: now,
      updated_at: now,
      started_at: null,
      finished_at: null
    };
  }

  // РЕАЛЬНЫЙ ЗАПРОС
  const response = await fetch(`${BASE_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id, steps }),
  });
  return handleResponse<Job>(response);
}

export async function getJobStatus(job_id: string): Promise<Job> {
  if (USE_MOCKS) {
    await delay(1000);
    pollCount++;
    const progress = Math.min(pollCount * 25, 100);
    const status: 'processing' | 'completed' = progress === 100 ? 'completed' : 'processing';
    const now = new Date().toISOString();
    return {
      id: job_id,
      video_id: "fake-video-123",
      status: status,
      steps: [{ type: 'upscale', status: status, parameters: { scale: 2 }, progress: progress, created_at: now, updated_at: now }],
      progress: progress,
      current_step: 0,
      message: status === 'completed' ? "Готово" : "Обработка...",
      result_id: status === 'completed' ? "fake-result-789" : null,
      error: null,
      created_at: now,
      updated_at: now,
      started_at: now,
      finished_at: status === 'completed' ? now : null
    };
  }

  // РЕАЛЬНЫЙ ЗАПРОС
  const response = await fetch(`${BASE_URL}/jobs/${job_id}`);
  return handleResponse<Job>(response);
}

export async function getJobResult(job_id: string): Promise<Result> {
  if (USE_MOCKS) {
    await delay(500);
    return {
      id: "fake-result-789",
      job_id: job_id,
      filename: "source_enhanced.mp4",
      content_type: "video/mp4",
      size_bytes: 73400320,
      duration_seconds: 32.5,
      width: 3840,
      height: 2160,
      fps: 60,
      download_url: "/api/v1/jobs/fake-job-456/result/download",
      created_at: new Date().toISOString()
    };
  }

  // РЕАЛЬНЫЙ ЗАПРОС
  const response = await fetch(`${BASE_URL}/jobs/${job_id}/result`);
  return handleResponse<Result>(response);
}