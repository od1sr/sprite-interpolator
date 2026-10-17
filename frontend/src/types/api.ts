// src/types/api.ts


export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelling' | 'cancelled';


export type StepType = 'upscale' | 'interpolate' | 'restore';


export interface Video {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  width: number;
  height: number;
  fps: number;
  codec: string;
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
  parameters: Record<string, any>;
  progress?: number;
  error?: JobError | null;
  created_at: string;
  updated_at: string;
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
  updated_at: string;
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
