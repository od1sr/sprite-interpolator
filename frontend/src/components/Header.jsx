import React from 'react'

export default function Header() {
  return (
    <header style={{
      background: 'var(--white)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
          I <span style={{ color: 'var(--blue)' }}>♥</span> VIDEO
        </div>
        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          ВСЕ ИНСТРУМЕНТЫ ДЛЯ ВИДЕО 
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        AI Upscale &amp; FPS Boost
      </div>
    </header>
  )
}