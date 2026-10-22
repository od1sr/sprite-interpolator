import React, { useEffect, useRef, useState } from 'react'

export default function VideoPreview({ file }) {
  const videoRef = useRef(null)
  const [resolution, setResolution] = useState(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const v = videoRef.current
    if (!v) return

    const onLoaded = () => {
      setResolution(`${v.videoWidth} × ${v.videoHeight} px`)
    }
    v.addEventListener('loadedmetadata', onLoaded)
    v.src = url
    return () => {
      v.removeEventListener('loadedmetadata', onLoaded)
      URL.revokeObjectURL(url)
    }
  }, [file])

  if (!file) {
    return (
      <div className="preview-container">
        <div className="preview-placeholder">
          Загрузите видео для предпросмотра
        </div>
      </div>
    )
  }

  return (
    <div className="preview-container">
      <div className="preview-header">
        <span className="file-name" title={file.name}>{file.name}</span>
        {resolution && <span className="resolution">{resolution}</span>}
      </div>
      <video
        ref={videoRef}
        className="preview-video"
        controls
        style={{ width: '100%' }}
      />
    </div>
  )
}