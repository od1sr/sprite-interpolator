import { useState, useCallback } from 'react'

// Черновая имитация бэкенда — заменяется на реальные fetch-вызовы
export function useJobs() {
  const [jobs, setJobs] = useState([])

  const addJob = useCallback((payload) => {
    const id = crypto.randomUUID()
    const job = {
      id,
      fileName: payload.file.name,
      scale: payload.scale,
      fps: payload.fps,
      status: 'pending',
      downloadUrl: null,
      createdAt: Date.now(),
    }
    setJobs((prev) => [job, ...prev])

    // Имитация обработки
    setTimeout(() => {
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, status: 'processing' } : j))
      )
    }, 500)

    setTimeout(() => {
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? { ...j, status: 'done', downloadUrl: '#' }
            : j
        )
      )
    }, 4000)

    return id
  }, [])

  return { jobs, addJob }
}