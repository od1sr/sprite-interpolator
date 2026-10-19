import React, { useRef, useState } from 'react'

export default function UploadZone({ onFile }) {
  const inputRef = useRef(null)
  const [dragover, setDragover] = useState(false)

  const handleFile = (file) => {
    if (file && file.type.startsWith('video/')) {
      onFile(file)
    }
  }

  return (
    <div
      className={`upload-zone ${dragover ? 'dragover' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragover(true) }}
      onDragLeave={() => setDragover(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragover(false)
        handleFile(e.dataTransfer.files[0])
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <div className="upload-zone-icon">🎬</div>
      <div className="upload-zone-title">Перетащите видео сюда</div>
      <div className="upload-zone-subtitle">
        или нажмите, чтобы выбрать файл · MP4, MOV, AVI, MKV
      </div>
    </div>
  )
}