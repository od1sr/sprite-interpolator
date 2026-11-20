import React from 'react';

export default function Landing({ onAuthClick }) {
  return (
    <div id="view-landing">
      <header className="nav">
        <div className="nav-inner">
          <a className="brand"><span className="brand-mark"></span><span>Zarya</span></a>
          <nav className="nav-links">
            <a href="#features">Возможности</a>
            <a href="#how">Как это работает</a>
            <a href="#pricing">Тарифы</a>
          </nav>
          <div className="nav-actions">
            <button className="btn btn-ghost" onClick={() => onAuthClick('login')}>Войти</button>
            <button className="btn btn-primary" onClick={() => onAuthClick('register')}>Создать аккаунт</button>
          </div>
        </div>
      </header>
      <main>
        <div className="hero">
          <div className="wrap">
            <span className="pill pill-accent"><span className="dot"></span> Интерполяция до 120 fps</span>
            <h1>Видео, доведённое<br/>до идеала</h1>
            <p className="lede">Апскейл, интерполяция, склейка и удаление объектов — в одном рабочем пространстве.</p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={() => onAuthClick('register')}>Начать бесплатно</button>
            </div>
          </div>
        </div>
        {/* Здесь можно добавить секции Features, How, Pricing из исходного HTML, обернув их в div с className="section" */}
      </main>
    </div>
  );
}