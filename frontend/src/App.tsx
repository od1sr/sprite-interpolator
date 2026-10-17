// src/App.tsx
import { useState, useEffect } from 'react';
import { uploadVideo, createJob, getJobStatus, getJobResult } from './api/client';
import type { Video, Job, Result } from './types/api';

function App() {
  const [video, setVideo] = useState<Video | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Обработка загрузки файла с ВАЛИДАЦИЕЙ
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null); // Сбрасываем старые ошибки

    // ВАЛИДАЦИЯ 1: Проверка размера (например, лимит 100 МБ)
    const MAX_SIZE = 100 * 1024 * 1024; // 100 MB в байтах
    if (file.size > MAX_SIZE) {
      setError('Файл слишком большой. Максимальный размер: 100 МБ.');
      event.target.value = ''; // Очищаем инпут
      return;
    }

    // ВАЛИДАЦИЯ 2: Проверка типа файла (MIME)
    if (!file.type.startsWith('video/')) {
      setError('Пожалуйста, выберите видеофайл (mp4, mov, webm и т.д.).');
      event.target.value = ''; // Очищаем инпут
      return;
    }

    setLoading(true);
    try {
      const uploadedVideo = await uploadVideo(file);
      setVideo(uploadedVideo);
    } catch (err: any) {
      // Здесь мы ловим ошибки от сервера (например, если бэкенд ответил 415)
      // Наш ApiError из client.ts содержит поле code
      if (err.code === 'VIDEO_TOO_LARGE') {
        setError('Сервер отклонил файл: превышен лимит размера.');
      } else if (err.code === 'UNSUPPORTED_MEDIA_TYPE') {
        setError('Сервер не поддерживает этот формат видео.');
      } else {
        setError(err.message || 'Ошибка при загрузке');
      }

    } finally {
      setLoading(false);
    }
  };

  // 2. Запуск задачи (Job)
  const handleStartJob = async () => {
    if (!video) return;
    setLoading(true);
    setError(null);
    try {
      const newJob = await createJob(video.id, [
        { type: 'upscale', parameters: { scale: 2 } }
      ]);
      setJob(newJob);
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании задачи');
    } finally {
      setLoading(false);
    }
  };

  // 3. Эффект для опроса статуса (Polling)
  useEffect(() => {
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const updatedJob = await getJobStatus(job.id);
        setJob(updatedJob);
        
        // Если задача упала с ошибкой, показываем её
        if (updatedJob.status === 'failed' && updatedJob.error) {
          setError(`Ошибка обработки: ${updatedJob.error.message}`);
        }
      } catch (err) {
        console.error("Ошибка поллинга", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [job]);

  // 4. Запрос результата
  useEffect(() => {
    if (job?.status === 'completed' && !result) {
      getJobResult(job.id).then(setResult).catch(console.error);
    }
  }, [job?.status, result, job?.id]);

  
  const handleReset = () => {
    setVideo(null);
    setJob(null);
    setResult(null);
    setError(null);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Видео Сервис (Локалка)</h1>

      {/* Блок ошибки */}
      {error && (
        <div style={{ padding: '10px', background: '#ffdddd', border: '1px solid red', color: 'darkred', marginBottom: '20px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ЭТАП 1: Загрузка */}
      {!video && !job && (
        <div>
          <h2>1. Загрузите видео</h2>
          <p style={{ fontSize: '14px', color: 'gray' }}>Поддерживаются видеофайлы до 100 МБ</p>
          <input type="file" accept="video/*" onChange={handleFileUpload} disabled={loading} />
          {loading && <p>Загрузка...</p>}
        </div>
      )}

      {/* ЭТАП 2: Создание задачи */}
      {video && !job && (
        <div>
          <h2>2. Файл загружен</h2>
          <p>Имя: {video.filename} | Размер: {(video.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
          <button onClick={handleStartJob} disabled={loading} style={{ padding: '10px 20px', cursor: 'pointer' }}>
            {loading ? 'Создание...' : 'Запустить Upscale (x2)'}
          </button>
        </div>
      )}

      {/* ЭТАП 3: Ожидание (Polling) */}
      {job && job.status !== 'completed' && job.status !== 'failed' && (
        <div>
          <h2>3. Обработка видео</h2>
          <p>Статус: <b>{job.status}</b></p>
          <p>Прогресс: {job.progress}%</p>
          <div style={{ width: '100%', background: '#eee', height: '20px', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ width: `${job.progress}%`, background: 'blue', height: '100%', transition: 'width 0.5s' }}></div>
          </div>
        </div>
      )}

      {/* ЭТАП 4: Результат */}
      {job?.status === 'completed' && result && (
        <div>
          <h2>4. Готово!</h2>
          <p>Разрешение: {result.width}x{result.height} | FPS: {result.fps}</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <a href={result.download_url} download style={{ display: 'inline-block', padding: '10px 20px', background: 'green', color: 'white', textDecoration: 'none', borderRadius: '5px' }}>
              Скачать видео
            </a>
            <button onClick={handleReset} style={{ padding: '10px 20px', background: '#ccc', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              Загрузить другое
            </button>
          </div>
        </div>
      )}

      {/* ЭТАП 5: Ошибка задачи */}
      {job?.status === 'failed' && (
         <div>
           <h2>Обработка не удалась</h2>
           <p>Вы можете попробовать снова.</p>
           <button onClick={handleReset} style={{ padding: '10px 20px', background: '#ccc', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
              Вернуться к загрузке
            </button>
         </div>
      )}
    </div>
  );
}

export default App;