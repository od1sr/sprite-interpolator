// src/types/api.ts


export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelling' | 'cancelled';

export type StepType = 'upscale' | 'interpolate' | 'color_correct';

export interface CreateJobStep {
  type: StepType;
  parameters: Record<string, number | string>;
}


export interface Video {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  codec: string | null;
  created_at: string;
}


export interface JobError {
  code: string;
  message: string;
  retryable: boolean;
  stage?: string;
  details?: Record<string, unknown>;
}


export interface PipelineStep {
  type: StepType;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  parameters: Record<string, number | string>;
  progress?: number;
  error?: JobError | null;
  started_at: string | null;
  finished_at: string | null;
}


export interface Job {
  id: string;
  video_id: string;
  status: JobStatus;
  steps: PipelineStep[];
  progress?: number;
  current_step: number | null;
  message?: string;
  result_id: string | null;
  error: JobError | null;
  created_at: string;
  started_at: string | null;  
  finished_at: string | null;  
}


export interface Result {
  id: string;
  job_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  download_url: string;
  created_at: string;
}

export type PlatformType = 'youtube' | 'tiktok' | 'vk';

export interface PlatformParams {
  platform: PlatformType;
  resolution: string;
}

export type AdaptationMode = 'crop' | 'pad' | 'blur';

export interface ExportJob {
  id: string;
  video_id: string;
  job_id: string | null;
  profile_id: string;
  adaptation_mode: AdaptationMode;
  status: string;
  progress: number;
  output_path: string | null;
  error_code: string | null;
  user_message: string | null;
  created_at: string;
}


export interface Project {
  id: string;
  video_id: string;
  video_filename: string;
  status: JobStatus;
  steps: PipelineStep[];
  progress: number;
  current_step: number | null;
  message: string | null;
  result_id: string | null;
  error: JobError | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  exports: ExportJob[];
  download_url: string | null;
}

export interface ProjectPage {
  items: Project[];
  total: number;
  limit: number;
  offset: number;
}

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  plan: string;
  token_balance: number;
  created_at: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  display_name?: string | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface PurchasePlanRequest {
  plan: string;
}
