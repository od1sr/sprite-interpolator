import React, { useState } from 'react';

export default function Dropzone({ title = "Перетащите видео сюда", sub = "или нажмите, чтобы выбрать файл", onFile }) {
  const [drag, setDrag] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (onFile) onFile(file ? file.name : null);
  };

  return (
    <div 
      className={`dropzone ${drag ? 'drag' : ''}`}
      onClick={() => onFile && onFile('demo_video.mp4')}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <div className="dz-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/>
        </svg>
      </div>
      <div className="dz-title">{title}</div>
      <div className="dz-sub">{sub}</div>
    </div>
  );
}