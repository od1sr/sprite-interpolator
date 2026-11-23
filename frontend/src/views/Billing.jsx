import React from 'react';

export default function Billing({ currentPlan, onPlanChange }) {
  const plans = [
    { id: 'start', name: 'Старт', price: '0 ₽', desc: '/ мес' },
    { id: 'pro', name: 'Про', price: '990 ₽', desc: '/ мес' },
    { id: 'studio', name: 'Студия', price: '2 990 ₽', desc: '/ мес' },
  ];

  const usagePercent = currentPlan.quota ? Math.min(100, (currentPlan.used / currentPlan.quota) * 100) : 28;

  return (
    <div>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Подписка</span>
          <h2 className="welcome-title">Тариф и оплата</h2>
          <p className="welcome-sub">Управляйте подпиской и просматривайте историю платежей.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Текущий тариф</h3>
          <span className="pill pill-accent">{currentPlan.name}</span>
        </div>
        <div className="current-plan">
          <div>
            <div className="plan-name">{currentPlan.name}</div>
            <div className="plan-price">{currentPlan.priceLabel} <span>/мес</span></div>
          </div>
          <div className="plan-usage">
            <div className="muted-sm">
              {currentPlan.quota 
                ? `${currentPlan.used} из ${currentPlan.quota} обработок в этом месяце` 
                : `${currentPlan.used} обработок, без ограничений`}
            </div>
            <div className="bar"><i style={{width: `${usagePercent}%`}}></i></div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Сменить тариф</h3></div>
        <div className="plan-options">
          {plans.map(plan => (
            <div className="plan-opt" key={plan.id}>
              <b>{plan.name}</b><span>{plan.price} {plan.desc}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => onPlanChange(plan.id)}>
                {currentPlan.name === plan.name ? 'Текущий' : 'Выбрать'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>История платежей</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Дата</th><th>Тариф</th><th>Сумма</th><th>Статус</th></tr>
            </thead>
            <tbody>
              <tr><td>01.11.2025</td><td>Про</td><td>990 ₽</td><td><span className="pill pill-ok">Оплачено</span></td></tr>
              <tr><td>01.10.2025</td><td>Про</td><td>990 ₽</td><td><span className="pill pill-ok">Оплачено</span></td></tr>
              <tr><td>01.09.2025</td><td>Старт</td><td>0 ₽</td><td><span className="pill">Бесплатно</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}