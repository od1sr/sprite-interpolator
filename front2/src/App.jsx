import React, { useState } from 'react'
import Header from './components/Header'
import UploadZone from './components/UploadZone'
import VideoPreview from './components/VideoPreview'
import ParametersPanel from './components/ParametersPanel'
import JobList from './components/JobList'
import { useJobs } from './hooks/useJobs'
import './App.css'

export default function App() {
  const [file, setFile] = useState(null)
  const [resolution, setResolution] = useState(null)
  const [scale, setScale] = useState(2)
  const [fps, setFps] = useState(60)
  const [processing, setProcessing] = useState(false)
  const { jobs, addJob } = useJobs()

  const handleFile = (f) => {
    setFile(f)
    setResolution({ w: 1920, h: 1080 })
  }

  const handleSubmit = () => {
    if (!file) return
    setProcessing(true)
    addJob({ file, scale, fps })
    setTimeout(() => setProcessing(false), 600)
  }

  return (
    <div className="app">
      <Header />
      <div className="main-layout">
        <div className="left-panel">
          {!file && <UploadZone onFile={handleFile} />}
          <VideoPreview file={file} />
          <JobList jobs={jobs} />
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
            originalResolution={resolution}
          />
        </div>
      </div>
    </div>
  )
}