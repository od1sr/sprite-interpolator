import React, { useEffect, useRef } from 'react';

const FEATURES = [
  {
    num: '01',
    title: 'Интерполяция',
    text: 'Плавные 60 и 120 fps из исходных 24. Движение остаётся чистым, без дрожания и артефактов.',
    tag: 'до 120 fps',
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
    title: 'Апскейл',
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
    title: 'Коррекция цвета',
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

export default function Landing({ onAuthClick }) {
  const rootRef = useRef(null);

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
            <button className="btn btn-ghost" onClick={() => onAuthClick('login')}>Войти</button>
            <button className="btn btn-primary" onClick={() => onAuthClick('register')}>Создать аккаунт</button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <div className="hero-index">
                <span className="pill pill-accent"><span className="dot" /> VIDEO ENGINE / 01</span>
                <span className="hero-timecode">24 → 120 FPS · 4K / 8K</span>
              </div>
              <h1>Больше кадров.<br /><em>Меньше потерь.</em></h1>
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
                <div><b>×16</b><span>макс. интерполяция</span></div>
                <div><b>120 FPS</b><span>целевая частота</span></div>
                <div><b>03</b><span>прохода в цепочке</span></div>
              </div>
            </div>

            <aside className="hero-console" aria-label="Схема обработки">
              <div className="console-bar">
                <span className="console-dot" />
                <span>ACTIVE PIPELINE</span>
                <span>TC 00:00:00:00</span>
              </div>
              <ol className="console-track">
                <li><b>01</b><span>INTERPOLATE</span><i>×2 → ×16</i></li>
                <li><b>02</b><span>UPSCALE</span><i>2× / 4×</i></li>
                <li><b>03</b><span>COLOR CORRECT</span><i>LUT + SHARP</i></li>
              </ol>
              <div className="console-foot">
                <div className="bar active"><i style={{ width: '68%' }} /></div>
                <span className="mono">68%</span>
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
