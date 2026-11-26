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
                      <path d="M4 6h16"/>
                      <path d="M4 12h16"/>
                      <path d="M4 18h16"/>
                      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none"/>
                      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none"/>
                      <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none"/>
                    </svg>
                  </div>
                  <h3>Цветокоррекция</h3>
                  <p>Выравнивайте цвет, контраст и яркость, чтобы весь ролик выглядел единообразно.</p>
                  <span className="tag">LUT, HSV</span>
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
                  <p>Включите нужные модули: апскейл, интерполяцию и цветокоррекцию.</p>
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
                  Оплата в кредитах — платите только за то, что используете.
                  Бесплатные 300 кредитов при регистрации.
                </p>
              </div>

              {/* Личные тарифы */}
              <div style={{ marginBottom: 48 }}>
                <h3 style={{ fontFamily: 'var(--marker)', fontWeight: 400, letterSpacing: 0, fontSize: 'clamp(22px, 2.8vw, 30px)', lineHeight: 1.18, marginBottom: 24 }}>
                  Для частных пользователей
                </h3>
                <p className="sub" style={{ marginTop: 0, marginBottom: 28, maxWidth: 520 }}>
                  Разовые пакеты кредитов. Без подписки и автоматических списаний.
                </p>

                <div className="pricing">
                  <div className="price-card">
                    <div className="price-name">Free</div>
                    <div className="price-val">0 ₽</div>
                    <div className="price-desc">Пробный доступ при регистрации</div>
                    <ul className="price-list">
                      <li>300 кредитов</li>
                      <li>Апскейл до 1080p</li>
                      <li>Интерполяция до 60 fps</li>
                      <li>Стандартная очередь</li>
                    </ul>
                    <button className="btn btn-ghost btn-block" onClick={() => onAuthClick('register')}>
                      Попробовать
                    </button>
                  </div>

                  <div className="price-card">
                    <div className="price-name">Start</div>
                    <div className="price-val">290 ₽</div>
                    <div className="price-desc">Разовая покупка пакета</div>
                    <ul className="price-list">
                      <li>1 350 кредитов</li>
                      <li>Апскейл до 4K</li>
                      <li>Интерполяция до 120 fps</li>
                      <li>Приоритетная очередь</li>
                    </ul>
                    <button className="btn btn-ghost btn-block" onClick={() => onAuthClick('register')}>
                      Выбрать
                    </button>
                  </div>

                  <div className="price-card featured">
                    <div className="price-name">Creator</div>
                    <div className="price-val">590 ₽</div>
                    <div className="price-desc">Разовая покупка пакета</div>
                    <ul className="price-list">
                      <li>2 750 кредитов</li>
                      <li>Апскейл до 4K</li>
                      <li>Интерполяция до 120 fps</li>
                      <li>Цветокоррекция</li>
                      <li>Приоритетная очередь</li>
                    </ul>
                    <button className="btn btn-primary btn-block" onClick={() => onAuthClick('register')}>
                      Выбрать
                    </button>
                  </div>

                  <div className="price-card">
                    <div className="price-name">Pro</div>
                    <div className="price-val">1 490 ₽</div>
                    <div className="price-desc">Разовая покупка пакета</div>
                    <ul className="price-list">
                      <li>7 000 кредитов</li>
                      <li>Апскейл до 8K</li>
                      <li>Интерполяция до 120 fps</li>
                      <li>Цветокоррекция</li>
                      <li>Максимальный приоритет</li>
                    </ul>
                    <button className="btn btn-ghost btn-block" onClick={() => onAuthClick('register')}>
                      Выбрать
                    </button>
                  </div>
                </div>
              </div>

              {/* Корпоративные тарифы */}
              <div>
                <h3 style={{ fontFamily: 'var(--marker)', fontWeight: 400, letterSpacing: 0, fontSize: 'clamp(22px, 2.8vw, 30px)', lineHeight: 1.18, marginBottom: 24 }}>
                  Для компаний и команд
                </h3>
                <p className="sub" style={{ marginTop: 0, marginBottom: 28, maxWidth: 520 }}>
                  Ежемесячный общий баланс организации. Для команд от 2 человек.
                </p>

                <div className="pricing">
                  <div className="price-card">
                    <div className="price-name">Business Start</div>
                    <div className="price-val">14 900 ₽<span>/мес</span></div>
                    <div className="price-desc">Общий баланс организации</div>
                    <ul className="price-list">
                      <li>20 000 кредитов в месяц</li>
                      <li>До 5 пользователей</li>
                      <li>Апскейл до 4K</li>
                      <li>Приоритетная очередь</li>
                    </ul>
                    <button className="btn btn-ghost btn-block" onClick={() => onAuthClick('register')}>
                      Выбрать
                    </button>
                  </div>

                  <div className="price-card featured">
                    <div className="price-name">Business Pro</div>
                    <div className="price-val">29 900 ₽<span>/мес</span></div>
                    <div className="price-desc">Общий баланс организации</div>
                    <ul className="price-list">
                      <li>40 000 кредитов в месяц</li>
                      <li>До 15 пользователей</li>
                      <li>Апскейл до 8K</li>
                      <li>Цветокоррекция</li>
                      <li>Выделенные GPU-ноды</li>
                    </ul>
                    <button className="btn btn-primary btn-block" onClick={() => onAuthClick('register')}>
                      Выбрать
                    </button>
                  </div>

                  <div className="price-card">
                    <div className="price-name">Enterprise</div>
                    <div className="price-val">от 49 900 ₽<span>/мес</span></div>
                    <div className="price-desc">Индивидуальные условия и объём</div>
                    <ul className="price-list">
                      <li>От 70 000 кредитов в месяц</li>
                      <li>Неограниченное число пользователей</li>
                      <li>Все модули обработки</li>
                      <li>API и вебхуки</li>
                      <li>Персональный менеджер</li>
                    </ul>
                    <button className="btn btn-ghost btn-block" onClick={() => onAuthClick('register')}>
                      Выбрать
                    </button>
                  </div>
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