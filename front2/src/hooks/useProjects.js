import { useState, useEffect } from 'react';

const SAMPLE_NAMES = ['new_footage.mp4', 'clip_export.mov', 'scene_take_02.mp4', 'b_roll_master.mkv'];

export function useProjects() {
  const [projects, setProjects] = useState([
    { id: 1, name: 'night_city_4k.mp4', status: 'done', progress: 100, meta: 'Апскейл 4K · Интерполяция 60 fps · 12,4 мин', hue: 215 },
    { id: 2, name: 'interview_raw.mov', status: 'run', progress: 62, meta: 'Удаление объектов · 00:12–00:28 · 4K', hue: 240 },
    { id: 3, name: 'drone_sequence.mkv', status: 'queue', progress: 0, meta: 'Склейка · 5 клипов · 1080p → 4K', hue: 198 },
  ]);

  const addProject = (fileName) => {
    const newProject = {
      id: Date.now(),
      name: fileName || SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)],
      status: 'run',
      progress: 0,
      meta: 'Апскейл 4K · Интерполяция 120 fps',
      hue: Math.round(190 + Math.random() * 90)
    };
    setProjects(prev => [newProject, ...prev]);
    return newProject.id;
  };

  // Анимация прогресса
  useEffect(() => {
    const interval = setInterval(() => {
      setProjects(prev => prev.map(p => {
        if (p.status === 'run') {
          const newProgress = Math.min(100, p.progress + Math.random() * 9 + 4);
          return {
            ...p,
            progress: newProgress,
            status: newProgress >= 100 ? 'done' : 'run'
          };
        }
        return p;
      }));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const filterProjects = (filter) => {
    if (filter === 'all') return projects;
    return projects.filter(p => p.status === filter);
  };

  return { projects, addProject, filterProjects };
}