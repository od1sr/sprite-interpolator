import { useRef, useState } from 'react';

export default function Dropzone({
  title = 'Перетащите видео сюда',
  sub = 'или нажмите, чтобы выбрать файл',
  onFile,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const chooseFile = () => {
    if (!disabled) inputRef.current?.click();
  };

  const acceptFile = (file) => {
    if (!disabled && file) onFile?.(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    acceptFile(e.dataTransfer.files[0]);
  };

  return (
    <div
      className={`dropzone${drag ? ' drag' : ''}${disabled ? ' is-disabled' : ''}`}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={chooseFile}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          chooseFile();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          acceptFile(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
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