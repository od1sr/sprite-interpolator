// src/components/VideoPreview.jsx
import { useEffect, useRef, useState } from 'react';

export default function VideoPreview({ file, aspectRatio = '16/9' }) {
  const videoRef = useRef(null); // Убрали <HTMLVideoElement>
  const [resolution, setResolution] = useState(null); // Убрали <string>

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => {
      setResolution(`${v.videoWidth} × ${v.videoHeight} px`);
    };
    v.addEventListener('loadedmetadata', onLoaded);
    v.src = url;
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded);
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!file) {
    return (
      <div className="preview-container">
        <div className="preview-placeholder">Загрузите видео для предпросмотра</div>
      </div>
    );
  }

  return (
    <div className="preview-container">
      <div className="preview-header">
        <span className="file-name" title={file.name}>{file.name}</span>
        {resolution && <span className="resolution">{resolution}</span>}
      </div>
      
      <div 
        style={{ 
          width: '100%', 
          maxWidth: aspectRatio === '9/16' ? '300px' : '100%', 
          aspectRatio: aspectRatio, 
          margin: '0 auto', 
          background: '#000',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'max-width 0.3s ease'
        }}
      >
        <video
          ref={videoRef}
          controls
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    </div>
  );
}