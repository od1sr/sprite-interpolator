import React from 'react';

export default function Landing({ onAuthClick }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div id="view-landing">

      {/* ═══════════ NAV ═══════════ */}
      <header className="nav">
        <div className="nav-inner">
          <a className="brand" onClick={() => scrollTo('view-landing')}>
            <span className="brand-mark"></span>
            <span>Zarya</span>
          </a>
          <nav className="nav-links">
            <a onClick={() => scrollTo('features')}>Возможности</a>
            <a onClick={() => scrollTo('how')}>Как это работает</a>
            <a onClick={() => scrollTo('pricing')}>Тарифы</a>
          </nav>
          <div className="nav-actions">
            <button className="btn btn-ghost" onClick={() => onAuthClick('login')}>Войти</button>
            <button className="btn btn-primary" onClick={() => onAuthClick('register')}>Создать аккаунт</button>
          </div>
        </div>
      </header>
      <main>

        {/* ─────────── LANDING ─────────── */}
        <section id="view-landing">

          <div className="hero">
            <div className="wrap">
              <span className="pill pill-accent">
                <span className="dot"></span> Интерполяция до 120 fps
              </span>
              <h1>Видео, доведённое<br />до идеала</h1>
              <p className="lede">
                Апскейл, интерполяция и склейка — в одном рабочем
                пространстве. Загрузите файл и получите результат за минуты.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary btn-lg" onClick={() => onAuthClick('register')}>
                  Начать бесплатно
                </button>
                <button className="btn btn-ghost btn-lg" onClick={() => scrollTo('features')}>
                  Смотреть возможности
                </button>
              </div>
              <div className="hero-meta">
                <div><b>4K / 8K</b><span>апскейл</span></div>
                <div><b>120 fps</b><span>интерполяция</span></div>
                <div><b>до 10×</b><span>быстрее в очереди</span></div>
              </div>
            </div>
          </div>

          {/* Features */}
          <section className="section" id="features">
            <div className="wrap">
              <div className="sec-head">
                <span className="eyebrow">Возможности</span>
                <h2>Три инструмента. Один пайплайн.</h2>
                <p className="sub">
                  Каждый модуль работает независимо или в связке — собирайте цепочки обработки под задачу.
                </p>
              </div>
              <div className="grid-4">

                <div className="card">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9"/>
                      <path d="M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15"/>
                      <path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9"/>
                      <path d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>
                    </svg>
                  </div>
                  <h3>Апскейл</h3>
                  <p>Нейросетевой апскейл до 4K и 8K с восстановлением мелких деталей и текстур.</p>
                  <span className="tag">4K, 8K</span>
                </div>

                <div className="card">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="5" width="7" height="14" rx="2"/>
                      <rect x="14" y="5" width="7" height="14" rx="2"/>
                      <path d="M11 12h2" strokeDasharray="1 2"/>
                    </svg>
                  </div>
                  <h3>Интерполяция</h3>
                  <p>Плавные 60 и 120 fps из исходных 24. Без дрожания и артефактов на движении.</p>
                  <span className="tag">до 120 fps</span>
                </div>

                <div className="card">
                  <div className="card-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h5.5a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3H21"/>
                      <path d="M3 18h5.5a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3H21"/>
                    </svg>
                  </div>
                  <h3>Склейка</h3>
                  <p>Объединяйте клипы в единый таймлайн с авто-нормализацией кадровой сетки.</p>
                  <span className="tag">N клипов</span>
                </div>

              </div>
            </div>
          </section>

          {/* How it works */}
          <section className="section" id="how">
            <div className="wrap">
              <div className="sec-head">
                <span className="eyebrow">Процесс</span>
                <h2>Три шага до результата</h2>
                <p className="sub">
                  Без установки софта, без настройки окружения и без ожидания в очереди на своём ноутбуке.
                </p>
              </div>
              <div className="steps">
                <div className="step">
                  <span className="step-num">01</span>
                  <h4>Загрузите видео</h4>
                  <p>Перетащите файл в браузер. Поддерживаются MP4, MOV и MKV до 4 ГБ.</p>
                </div>
                <div className="step">
                  <span className="step-num">02</span>
                  <h4>Соберите пайплайн</h4>
                  <p>Включите нужные модули: апскейл, интерполяцию и склейку.</p>
                </div>
                <div className="step">
                  <span className="step-num">03</span>
                  <h4>Заберите файл</h4>
                  <p>Обработка идёт на GPU-кластере. Готовый результат — в личном кабинете.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section className="section" id="pricing">
            <div className="wrap">
              <div className="sec-head">
                <span className="eyebrow">Тарифы</span>
                <h2>Прозрачно и без сюрпризов</h2>
                <p className="sub">
                  Начните бесплатно. Оплата — за минуты обработки, без скрытых списаний.
                </p>
              </div>
              <div className="pricing">

                <div className="price-card">
                  <div className="price-name">Старт</div>
                  <div className="price-val">0 ₽<span>/мес</span></div>
                  <div className="price-desc">Для знакомства с сервисом</div>
                  <ul className="price-list">
                    <li>5 обработок в месяц</li>
                    <li>Апскейл до 1080p</li>
                    <li>Интерполяция до 60 fps</li>
                    <li>Стандартная очередь</li>
                  </ul>
                  <button className="btn btn-ghost btn-block" onClick={() => onAuthClick('register')}>
                    Выбрать
                  </button>
                </div>

                <div className="price-card featured">
                  <div className="price-name">Про</div>
                  <div className="price-val">990 ₽<span>/мес</span></div>
                  <div className="price-desc">Для регулярной работы</div>
                  <ul className="price-list">
                    <li>100 обработок в месяц</li>
                    <li>Апскейл до 4K</li>
                    <li>Интерполяция до 120 fps</li>
                    <li>Приоритетная очередь</li>
                  </ul>
                  <button className="btn btn-primary btn-block" onClick={() => onAuthClick('register')}>
                    Выбрать
                  </button>
                </div>

                <div className="price-card">
                  <div className="price-name">Студия</div>
                  <div className="price-val">2 990 ₽<span>/мес</span></div>
                  <div className="price-desc">Для команд и продакшена</div>
                  <ul className="price-list">
                    <li>Без ограничений по количеству</li>
                    <li>Апскейл до 8K</li>
                    <li>Пакетная склейка</li>
                    <li>Выделенные GPU-ноды</li>
                    <li>API и вебхуки</li>
                  </ul>
                  <button className="btn btn-ghost btn-block" onClick={() => onAuthClick('register')}>
                    Выбрать
                  </button>
                </div>

              </div>
            </div>
          </section>

          <footer className="footer">
            <div className="wrap footer-inner">
              <div>
                <div className="brand" style={{ marginBottom: 12 }}>
                  <span className="brand-mark"></span><span>Zarya</span>
                </div>
                <div className="copy">© 2025 Zarya Studio. Все права защищены.</div>
              </div>
              <div className="footer-links">
                <a onClick={() => scrollTo('features')}>Возможности</a>
                <a onClick={() => scrollTo('pricing')}>Тарифы</a>
                <a href="#">Документация</a>
                <a href="#">Поддержка</a>
              </div>
            </div>
          </footer>

        </section>

      </main>
    </div>
  );
}