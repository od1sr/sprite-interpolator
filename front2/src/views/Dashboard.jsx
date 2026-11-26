import React from 'react';

export default function Dashboard({ user, projects, currentPlan, onPlanChange }) {
  const firstName = user?.name?.split(' ')[0] || 'Пользователь';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  const plans = [
    { id: 'start', name: 'Старт', price: '0 ₽', desc: '/ мес' },
    { id: 'pro', name: 'Про', price: '990 ₽', desc: '/ мес' },
    { id: 'studio', name: 'Студия', price: '2 990 ₽', desc: '/ мес' },
  ];

  const usagePercent = currentPlan?.quota 
    ? Math.min(100, (currentPlan.used / currentPlan.quota) * 100) 
    : 28;

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
          <div className="stat-label">Остаток квоты</div>
          <div className="stat-val">64%</div>
        </div>
      </div>

      {/* Текущий тариф */}
      <div className="panel">
        <div className="panel-head">
          <h3>Текущий тариф</h3>
          <span className="pill pill-accent">{currentPlan?.name || 'Про'}</span>
        </div>
        <div className="current-plan">
          <div>
            <div className="plan-name">{currentPlan?.name || 'Про'}</div>
            <div className="plan-price">
              {currentPlan?.priceLabel || '990 ₽'} <span>/мес</span>
            </div>
          </div>
          <div className="plan-usage">
            <div className="muted-sm">
              {currentPlan?.quota
                ? `${currentPlan.used} из ${currentPlan.quota} обработок в этом месяце`
                : `${currentPlan?.used || 0} обработок · без ограничений`}
            </div>
            <div className="bar">
              <i style={{ width: `${usagePercent}%` }}></i>
            </div>
          </div>
        </div>
      </div>

      {/* Выбор тарифа */}
      <div className="panel">
        <div className="panel-head"><h3>Сменить тариф</h3></div>
        <div className="plan-options">
          {plans.map(plan => (
            <div className="plan-opt" key={plan.id}>
              <b>{plan.name}</b>
              <span>{plan.price} {plan.desc}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => onPlanChange && onPlanChange(plan.id)}
              >
                {currentPlan?.name === plan.name ? 'Текущий' : 'Выбрать'}
              </button>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}