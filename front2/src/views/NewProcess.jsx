import React, { useState } from 'react';
import Dropzone from '../components/Dropzone';

export default function NewProcess({ onAddProject }) {
  const [upscale, setUpscale] = useState('4k');
  const [fps, setFps] = useState('120');
  const [fileName, setFileName] = useState(null);

  const handleStart = () => {
    if (!fileName) {
      alert('Пожалуйста, сначала загрузите видео');
      return;
    }
    // Имитация создания задачи
    onAddProject(fileName);
    setFileName(null); // Сброс после запуска
  };

  const getEstimate = () => {
    const upLabel = upscale === 'off' ? 'без апскейла' : upscale === '1080' ? '1080p' : upscale === '4k' ? '4K' : '8K';
    const fpLabel = fps === 'off' ? 'исходный fps' : `${fps} fps`;
    return `Оценка: ~4 мин · ${upLabel} · ${fpLabel}`;
  };

  return (
    <div>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Обработка</span>
          <h2 className="welcome-title">Новая обработка</h2>
          <p className="welcome-sub">Загрузите видео и настройте пайплайн — обработка запустится автоматически.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>1. Видео</h3>
          <span className="muted-sm">MP4 · MOV · MKV · до 4 ГБ</span>
        </div>
        <Dropzone 
          title={fileName || "Перетащите видео сюда"} 
          sub={fileName ? "Нажмите, чтобы заменить файл" : "или нажмите, чтобы выбрать файл"}
          onFile={setFileName} 
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>2. Пайплайн</h3>
          <span className="muted-sm">Включите нужные модули</span>
        </div>

        <div className="opt-grid">
          <div className="opt">
            <div className="opt-head"><b>Апскейл</b></div>
            <p>Нейросетевой апскейл до 4K / 8K</p>
            <select className="select" value={upscale} onChange={(e) => setUpscale(e.target.value)}>
              <option value="off">Не применять</option>
              <option value="1080">1080p</option>
              <option value="4k">4K</option>
              <option value="8k">8K</option>
            </select>
          </div>

          <div className="opt">
            <div className="opt-head"><b>Интерполяция</b></div>
            <p>Плавная кадровая частота</p>
            <select className="select" value={fps} onChange={(e) => setFps(e.target.value)}>
              <option value="off">Не применять</option>
              <option value="60">60 fps</option>
              <option value="120">120 fps</option>
            </select>
          </div>

          <div className="opt">
            <div className="opt-head"><b>Удаление объектов</b></div>
            <p>Укажите временной отрезок</p>
            <div className="range-row">
              <input type="text" className="select" placeholder="00:00" defaultValue="00:12" />
              <span>—</span>
              <input type="text" className="select" placeholder="00:00" defaultValue="00:28" />
            </div>
          </div>
        </div>

        <div className="panel-foot">
          <div className="estimate">{getEstimate()}</div>
          <button className="btn btn-primary" onClick={handleStart}>Запустить обработку</button>
        </div>
      </div>
    </div>
  );
}
