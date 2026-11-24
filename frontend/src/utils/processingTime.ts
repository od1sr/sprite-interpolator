import type { PipelineStep } from '../types/api';

export interface StepTiming {
  elapsedSeconds: number | null;
  remainingSeconds: number | null;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return '—';
  const total = Math.max(1, Math.round(seconds));
  if (total < 60) return `${total} с`;
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  if (minutes < 60) return rest ? `${minutes} мин ${rest} с` : `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes ? `${hours} ч ${restMinutes} мин` : `${hours} ч`;
}

/** Elapsed time of a pipeline step plus an ETA derived from its frame progress. */
export function getStepTiming(step: PipelineStep, now: number = Date.now()): StepTiming {
  if (!step.started_at) return { elapsedSeconds: null, remainingSeconds: null };
  const started = Date.parse(step.started_at);
  if (!Number.isFinite(started)) return { elapsedSeconds: null, remainingSeconds: null };

  const finished = step.finished_at ? Date.parse(step.finished_at) : NaN;
  const ended = Number.isFinite(finished) ? finished : now;
  const elapsedSeconds = Math.max(0, (ended - started) / 1000);

  const progress = step.status === 'completed'
    ? 100
    : Math.max(0, Math.min(100, step.progress ?? 0));
  const remainingSeconds = step.status === 'processing' && progress > 0 && progress < 100
    ? elapsedSeconds * (100 - progress) / progress
    : null;

  return { elapsedSeconds, remainingSeconds };
}
