import React from 'react';

export default function Dashboard({ user, projects, currentPlan, onPlanChange }) {
  const firstName = user?.name?.split(' ')[0] || 'Пользователь';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  // Личные тарифы (для частных пользователей)
  const personalPlans = [
    { id: 'free',     name: 'Free',    price: '0 ₽',      credits: '300',    rule: 'Пробный доступ при регистрации' },
    { id: 'start',    name: 'Start',   price: '290 ₽',    credits: '1 350',  rule: 'Разовая покупка пакета' },
    { id: 'creator',  name: 'Creator', price: '590 ₽',    credits: '2 750',  rule: 'Разовая покупка пакета' },
    { id: 'pro',      name: 'Pro',     price: '1 490 ₽',  credits: '7 000',  rule: 'Разовая покупка пакета' },
  ];

  // Корпоративные тарифы (для компаний и команд)
  const businessPlans = [
    { id: 'business_start', name: 'Business Start', price: '14 900 ₽',    credits: '20 000',   rule: 'Общий баланс организации' },
    { id: 'business_pro',   name: 'Business Pro',   price: '29 900 ₽',    credits: '40 000',   rule: 'Общий баланс организации' },
    { id: 'enterprise',     name: 'Enterprise',     price: 'от 49 900 ₽', credits: 'от 70 000', rule: 'Индивидуальные условия и объём' },
  ];

  const usedCredits = currentPlan?.usedCredits ?? currentPlan?.used ?? 0;
  const totalCredits = currentPlan?.credits ?? currentPlan?.quota ?? 1350;
  const remainingCredits = Math.max(0, totalCredits - usedCredits);
  const usagePercent = totalCredits ? Math.min(100, (usedCredits / totalCredits) * 100) : 0;

  const renderPlanCard = (plan) => (
    <div className="plan-opt" key={plan.id}>
      <b>{plan.name}</b>
      <span>{plan.price}</span>
      <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
        {plan.credits} кредитов
      </span>
      <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{plan.rule}</span>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onPlanChange && onPlanChange(plan.id)}
      >
        {currentPlan?.id === plan.id ? 'Текущий' : 'Выбрать'}
      </button>
    </div>
  );

  return (
    <div id="view-dashboard">

      {/* Приветствие */}
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Личный кабинет</span>
          <h2 className="welcome-title">{greeting}, {firstName}</h2>
          <p className="welcome-sub">Вот что происходит в вашем рабочем пространстве сегодня.</p>
        </div>
      </div>

      {/* Статистика */}
      <div className="stats">
        <div className="stat">
          <div className="stat-label">Всего проектов</div>
          <div className="stat-val">128</div>
          <div className="stat-sub up">+12 за неделю</div>
        </div>
        <div className="stat">
          <div className="stat-label">В обработке</div>
          <div className="stat-val">{projects.filter(p => p.status === 'run').length}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Минут обработано</div>
          <div className="stat-val">1 482</div>
        </div>
        <div className="stat">
          <div className="stat-label">Остаток кредитов</div>
          <div className="stat-val">{remainingCredits.toLocaleString('ru-RU')}</div>
          <div className="stat-sub">из {totalCredits.toLocaleString('ru-RU')}</div>
        </div>
      </div>

      {/* Текущий тариф */}
      <div className="panel">
        <div className="panel-head">
          <h3>Текущий тариф</h3>
          <span className="pill pill-accent">{currentPlan?.name || 'Start'}</span>
        </div>
        <div className="current-plan">
          <div>
            <div className="plan-name">{currentPlan?.name || 'Start'}</div>
            <div className="plan-price">
              {currentPlan?.price || '290 ₽'} <span>/ пакет</span>
            </div>
          </div>
          <div className="plan-usage">
            <div className="muted-sm">
              {usedCredits.toLocaleString('ru-RU')} из {totalCredits.toLocaleString('ru-RU')} кредитов использовано
            </div>
            <div className="bar">
              <i style={{ width: `${usagePercent}%` }}></i>
            </div>
          </div>
        </div>
      </div>

      {/* Личные тарифы */}
      <div className="panel">
        <div className="panel-head">
          <h3>Для частных пользователей</h3>
          <span className="muted-sm">Разовые пакеты кредитов</span>
        </div>
        <div className="plan-options">
          {personalPlans.map(renderPlanCard)}
        </div>
      </div>

      {/* Корпоративные тарифы */}
      <div className="panel">
        <div className="panel-head">
          <h3>Для компаний и команд</h3>
          <span className="muted-sm">Ежемесячный общий баланс</span>
        </div>
        <div className="plan-options">
          {businessPlans.map(renderPlanCard)}
        </div>
      </div>

    </div>
  );
}