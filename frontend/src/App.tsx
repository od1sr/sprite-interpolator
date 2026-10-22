import { useState, useEffect } from 'react';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import VideoPreview from './components/VideoPreview';
import ParametersPanel from './components/ParametersPanel';
import JobList from './components/JobList';
import { uploadVideo, createJob, getJobStatus } from './api/client';
import type { Video, Job } from './types/api';
import './App.css';

export default function App() {
  // --- СОСТОЯНИЯ (State) ---
  const [file, setFile] = useState<File | null>(null); // Сам файл для превью
  const [video, setVideo] = useState<Video | null>(null); // Ответ от сервера при загрузке
  const [job, setJob] = useState<Job | null>(null); // Текущая задача
  
  // Параметры из панели дизайнеров
  const [scale, setScale] = useState<number>(2);
  const [fps, setFps] = useState<number>(60);
  
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // --- ЛОГИКА ---

  // 1. Выбор файла
  const handleFile = (f: File) => {
    setFile(f);
    setError(null);
    setJob(null); // Сбрасываем старую задачу
    setVideo(null);
  };

  // 2. Отправка на сервер
  const handleSubmit = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);

    try {
      // Шаг А: Загружаем файл
      const uploadedVideo = await uploadVideo(file);
      setVideo(uploadedVideo);

      // Шаг Б: Формируем шаги (steps) на основе выбора пользователя
      const steps = [];
      if (scale > 1) {
        steps.push({ type: 'upscale', parameters: { scale: Number(scale) } });
      }
      if (fps > 0) {
        steps.push({ type: 'interpolate', parameters: { target_fps: Number(fps) } });
      }

      // Если пользователь ничего не выбрал, отправляем хотя бы один шаг (бэкенд не любит пустые)
      if (steps.length === 0) {
        steps.push({ type: 'upscale', parameters: { scale: 2 } });
      }

      // Шаг В: Создаем задачу (Job)
      const newJob = await createJob(uploadedVideo.id, steps);
      setJob(newJob);

    } catch (err: any) {
      setError(err.message || 'Ошибка при отправке на сервер');
      setProcessing(false); // Выключаем спиннер только при ошибке
    }
  };

  // 3. Поллинг (опрос статуса)
  useEffect(() => {
    // Если задачи нет, или она уже завершена/упала — не опрашиваем
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) {
      if (job?.status === 'completed' || job?.status === 'failed') {
        setProcessing(false);
      }
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updatedJob = await getJobStatus(job.id);
        setJob(updatedJob);
      } catch (err) {
        console.error("Ошибка поллинга", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [job]);

  return (
    <div className="app">
      <Header />
      
      {error && <div style={{ color: 'red', textAlign: 'center', padding: '10px' }}>⚠️ {error}</div>}

      <div className="main-layout">
        <div className="left-panel">
          {!file && <UploadZone onFile={handleFile} />}
          
          <VideoPreview file={file} />
          
          {/* Передаем в JobList реальный объект job */}
          <JobList job={job} />
        </div>
        
        <div className="right-panel">
          <ParametersPanel
            file={file}
            scale={scale}
            setScale={setScale}
            fps={fps}
            setFps={setFps}
            processing={processing}
            onSubmit={handleSubmit}
            // Фейковое разрешение, чтобы панель красиво рисовала "1920x1080 -> 3840x2160"
            // В реальности мы можем получить его из video, но для UI этого хватит
            originalResolution={{ w: video?.width || 1920, h: video?.height || 1080 }}
          />
        </div>
      </div>
    </div>
  );
}