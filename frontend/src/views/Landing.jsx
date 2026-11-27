import React, { useEffect, useRef, useState } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import originalVideoUrl from '../../original.MP4?url';
import resultVideoUrl from '../../result.mp4?url';
import backOneVideoUrl from '../../result_back_1.mp4?url';
import backTwoVideoUrl from '../../result_back_2.mp4?url';

const FEATURES = [
  {
    num: '01',
    title: 'Интерполяция до 16x',
    text: 'Плавные 60 и 120 fps из исходных 24. Движение остаётся чистым, без дрожания и артефактов.',
    tag: '240+ fps',
    icon: (
      <>
        <rect x="3" y="5" width="7" height="14" rx="2" />
        <rect x="14" y="5" width="7" height="14" rx="2" />
        <path d="M11 12h2" strokeDasharray="1 2" />
      </>
    ),
  },
  {
    num: '02',
    title: 'Апскейл до 8к',
    text: 'Нейросетевое увеличение до 4K и 8K с восстановлением мелких деталей и текстур.',
    tag: '4K / 8K',
    icon: (
      <>
        <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9" />
        <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15" />
        <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9" />
        <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" />
      </>
    ),
  },
  {
    num: '03',
    title: 'Автоматическая цветокоррекция',
    text: 'Пресеты, умная выравнивающая LUT и резкость — чтобы весь ролик выглядел единообразно.',
    tag: 'LUT + SHARP',
    icon: (
      <>
        <path d="M4 6h16" />
        <path d="M4 12h16" />
        <path d="M4 18h16" />
        <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
        <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
        <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
      </>
    ),
  },
];

const HOW_STEPS = [
  { num: '01', title: 'Загрузите видео', text: 'Перетащите файл в браузер. Поддерживаются MP4, MOV и MKV до 4 ГБ.' },
  { num: '02', title: 'Соберите пайплайн', text: 'Интерполяция → апскейл → цвет. Включайте только нужные проходы.' },
  { num: '03', title: 'Заберите результат', text: 'Обработка идёт на GPU-ноде. Готовый файл и экспорты — в проектах.' },
];

const PERSONAL_PLANS = [
  {
    name: 'Free',
    price: '0 ₽',
    desc: 'Пробный доступ при регистрации',
    free: true,
    items: ['300 кредитов', 'Апскейл до 1080p', 'Интерполяция до 60 fps', 'Стандартная очередь'],
  },
  {
    name: 'Start',
    price: '290 ₽',
    desc: 'Разовая покупка пакета',
    items: ['1 350 кредитов', 'Апскейл до 4K', 'Интерполяция до 120 fps', 'Приоритетная очередь'],
  },
  {
    name: 'Creator',
    price: '590 ₽',
    desc: 'Разовая покупка пакета',
    featured: true,
    items: ['2 750 кредитов', 'Апскейл до 4K', 'Интерполяция до 120 fps', 'Цветокоррекция', 'Приоритетная очередь'],
  },
  {
    name: 'Pro',
    price: '1 490 ₽',
    desc: 'Разовая покупка пакета',
    items: ['7 000 кредитов', 'Апскейл до 8K', 'Интерполяция до 120 fps', 'Цветокоррекция', 'Максимальный приоритет'],
  },
];

const BUSINESS_PLANS = [
  {
    name: 'Business Start',
    price: '14 900 ₽',
    suffix: '/мес',
    desc: 'Общий баланс организации',
    items: ['20 000 кредитов в месяц', 'До 5 пользователей', 'Апскейл до 4K', 'Приоритетная очередь'],
  },
  {
    name: 'Business Pro',
    price: '29 900 ₽',
    suffix: '/мес',
    desc: 'Общий баланс организации',
    featured: true,
    items: ['40 000 кредитов в месяц', 'До 15 пользователей', 'Апскейл до 8K', 'Цветокоррекция', 'Выделенные GPU-ноды'],
  },
  {
    name: 'Enterprise',
    price: 'от 49 900 ₽',
    suffix: '/мес',
    desc: 'Индивидуальные условия и объём',
    items: ['От 70 000 кредитов в месяц', 'Неограниченное число пользователей', 'Все модули обработки', 'API и вебхуки', 'Персональный менеджер'],
  },
];

function LedgerGroup({ title, description, plans, onAuthClick }) {
  return (
    <div className="ledger-group">
      <div className="ledger-head">
        <h3>{title}</h3>
        <p className="sub">{description}</p>
      </div>
      <div className="ledger">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`ledger-row${plan.featured ? ' featured' : ''}${plan.free ? ' free' : ''}`}
            data-reveal
          >
            <div>
              <div className="ledger-name">{plan.name}</div>
              <div className="ledger-desc">{plan.desc}</div>
            </div>
            <div className="ledger-price">
              {plan.price}{plan.suffix ? <span> {plan.suffix}</span> : null}
            </div>
            <ul className="ledger-list">
              {plan.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <div className="ledger-action">
              <button
                className={`btn ${plan.featured ? 'btn-primary' : 'btn-ghost'} btn-sm`}
                onClick={() => onAuthClick('register')}
              >
                Выбрать
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing({ onAuthClick, theme, onToggleTheme }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const beforeRef = useRef(null);
  const afterRef = useRef(null);
  const backOneRef = useRef(null);
  const backTwoRef = useRef(null);
  const [split, setSplit] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const videos = [beforeRef.current, afterRef.current, backTwoRef.current, backOneRef.current].filter(Boolean);
    if (!videos.length) return;
    Promise.allSettled(videos.map((video) => video.play())).then((results) => {
      setPlaying(results.every((result) => result.status === 'fulfilled'));
    });
  }, []);

  const syncAfter = () => {
    const before = beforeRef.current;
    const after = afterRef.current;
    if (!before || !after) return;
    if (Math.abs(before.currentTime - after.currentTime) > 0.25) {
      after.currentTime = before.currentTime;
    }
  };

  const moveDivider = (clientX) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.min(100, Math.max(0, next)));
  };

  const handlePointerDown = (event) => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.setPointerCapture(event.pointerId);
    setDragging(true);
    moveDivider(event.clientX);
  };

  const handlePointerMove = (event) => {
    if (dragging) moveDivider(event.clientX);
  };

  const stopDragging = (event) => {
    if (!dragging) return;
    setDragging(false);
    const stage = stageRef.current;
    if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSplit((value) => Math.max(0, value - 2));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSplit((value) => Math.min(100, value + 2));
    }
  };

  const allVideos = () => [beforeRef.current, afterRef.current, backTwoRef.current, backOneRef.current].filter(Boolean);

  const togglePlayback = () => {
    const videos = allVideos();
    if (!videos.length) return;
    if (playing) {
      videos.forEach((video) => video.pause());
      setPlaying(false);
      return;
    }
    Promise.allSettled(videos.map((video) => video.play())).then((results) => {
      setPlaying(results.every((result) => result.status === 'fulfilled'));
    });
  };

  const restartPlayback = () => {
    const videos = allVideos();
    if (!videos.length) return;
    videos.forEach((video) => {
      video.currentTime = 0;
    });
    Promise.allSettled(videos.map((video) => video.play())).then((results) => {
      setPlaying(results.every((result) => result.status === 'fulfilled'));
    });
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const targets = Array.from(root.querySelectorAll('[data-reveal]'));
    targets.forEach((el, index) => {
      el.style.transitionDelay = `${Math.min(index % 6, 5) * 45}ms`;
    });
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-visible'));
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div id="view-landing" className="landing" ref={rootRef}>
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" onClick={() => scrollTo('view-landing')}>
            <span className="brand-mark" />
            <span>Zarya</span>
          </a>
          <nav className="nav-links">
            <a onClick={() => scrollTo('features')}>Модули</a>
            <a onClick={() => scrollTo('how')}>Процесс</a>
            <a onClick={() => scrollTo('pricing')}>Тарифы</a>
          </nav>
          <div className="nav-actions">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            <button className="btn btn-ghost" onClick={() => onAuthClick('login')}>Войти</button>
            <button className="btn btn-primary" onClick={() => onAuthClick('register')}>Создать аккаунт</button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <h1><span className="hero-word--big">Больше</span> кадров.<br /><em><span className="hero-word--small">Меньше</span> потерь.</em></h1>
              <p className="lede">
                Интерполяция, апскейл и цвет — в одном конвейере. Загрузите файл,
                соберите цепочку и заберите готовый результат.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary btn-lg" onClick={() => onAuthClick('register')}>
                  Начать бесплатно
                </button>
                <button className="btn btn-ghost btn-lg" onClick={() => scrollTo('features')}>
                  Смотреть модули
                </button>
              </div>
              <div className="hero-meta">
                <div>интерполяция до 16x</div>
                <div>апскейл до 8к</div>
                <div>автоматическая цветокоррекция</div>
              </div>
            </div>

            <aside className="compare" aria-label="Сравнение видео до и после обработки">
              <div className="compare-backdrops" aria-hidden="true">
                <video
                  ref={backTwoRef}
                  className="compare-back compare-back--top"
                  src={backTwoVideoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
                <video
                  ref={backOneRef}
                  className="compare-back compare-back--bottom"
                  src={backOneVideoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>

              <div
                className={`compare-stage${dragging ? ' dragging' : ''}`}
                ref={stageRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDragging}
                onPointerCancel={stopDragging}
              >
                <video
                  ref={beforeRef}
                  className="compare-video"
                  src={originalVideoUrl}
                  poster="/compare-before.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onTimeUpdate={syncAfter}
                />
                <video
                  ref={afterRef}
                  className="compare-video compare-video--after"
                  style={{ clipPath: `inset(0 0 0 ${split}%)` }}
                  src={resultVideoUrl}
                  poster="/compare-after.jpg"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
                <div
                  className="compare-divider"
                  style={{ left: `${split}%` }}
                  role="slider"
                  tabIndex={0}
                  aria-label="Положение разделения видео"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(split)}
                  onKeyDown={handleKeyDown}
                >
                  <span className="compare-handle" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m10 7-4 5 4 5" />
                      <path d="m14 7 4 5-4 5" />
                    </svg>
                  </span>
                </div>

                <div
                  className="compare-controls"
                  onPointerDown={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <button
                    className="compare-ctrl compare-restart"
                    type="button"
                    onClick={restartPlayback}
                    aria-label="Запустить сначала"
                    title="Запустить сначала"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 12a9 9 0 1 0 3-6.7" />
                      <path d="M3 4v5h5" />
                    </svg>
                  </button>
                  <button
                    className="compare-ctrl compare-pause"
                    type="button"
                    onClick={togglePlayback}
                    aria-label={playing ? 'Пауза' : 'Воспроизвести'}
                    title={playing ? 'Пауза' : 'Воспроизвести'}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {playing
                        ? <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>
                        : <path d="M8 5.5v13l11-6.5z" />}
                    </svg>
                  </button>
                </div>
              </div>
            </aside>
          </div>
          <div className="hero-strip" aria-hidden="true" />
        </section>

        <section className="section" id="features">
          <div className="wrap">
            <div className="sec-head sec-head--split" data-index="01" data-reveal>
              <div>
                <span className="eyebrow">/ Модули</span>
                <h2>Три прохода.<br />Один результат.</h2>
              </div>
              <p className="sub">
                Каждый модуль работает самостоятельно или в связке.
                Порядок фиксирован: сначала движение, потом резкость, потом цвет.
              </p>
            </div>
            <div className="reel-list">
              {FEATURES.map((feature) => (
                <article className="reel-row" key={feature.num} data-reveal>
                  <span className="reel-num">{feature.num}</span>
                  <div className="reel-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      {feature.icon}
                    </svg>
                  </div>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </div>
                  <span className="reel-tag">{feature.tag}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="wrap how-grid">
            <div className="sec-head" data-index="02" data-reveal>
              <span className="eyebrow">/ Процесс</span>
              <h2>От файла<br />до экспорта</h2>
              <p className="sub">Без установки софта и настройки окружения. Управление — в браузере, тяжёлые проходы — на GPU.</p>
            </div>
            <ol className="timeline">
              {HOW_STEPS.map((step) => (
                <li className="timeline-item" key={step.num} data-reveal>
                  <span className="timeline-num">STEP {step.num}</span>
                  <h4>{step.title}</h4>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="section" id="pricing">
          <div className="wrap">
            <div className="sec-head" data-index="03" data-reveal>
              <span className="eyebrow">/ Тарифы</span>
              <h2>Кредиты, а не подписка</h2>
              <p className="sub">Платите только за то, что обработали. 300 кредитов — при регистрации.</p>
            </div>
            <LedgerGroup
              title="Для частных пользователей"
              description="Разовые пакеты. Без автоматических списаний."
              plans={PERSONAL_PLANS}
              onAuthClick={onAuthClick}
            />
            <LedgerGroup
              title="Для компаний и команд"
              description="Ежемесячный общий баланс организации, от 2 пользователей."
              plans={BUSINESS_PLANS}
              onAuthClick={onAuthClick}
            />
          </div>
        </section>

        <footer className="footer">
          <div className="wrap footer-inner">
            <div>
              <div className="brand" style={{ marginBottom: 12 }}>
                <span className="brand-mark" /><span>Zarya</span>
              </div>
              <div className="copy">© 2025 Zarya Studio. Все права защищены.</div>
            </div>
            <div className="footer-links">
              <a onClick={() => scrollTo('features')}>Модули</a>
              <a onClick={() => scrollTo('pricing')}>Тарифы</a>
              <a onClick={() => scrollTo('how')}>Процесс</a>
              <a>Поддержка</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
