import React from 'react';

export default function Billing({ currentPlan, onPlanChange }) {
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
    <div>

      {/* Приветствие */}
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Подписка</span>
          <h2 className="welcome-title">Тарифы и кредиты</h2>
          <p className="welcome-sub">
            Управляйте подпиской, покупайте пакеты кредитов и просматривайте историю платежей.
          </p>
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

      {/* История платежей */}
      <div className="panel">
        <div className="panel-head"><h3>История платежей</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тариф</th>
                <th>Сумма</th>
                <th>Кредиты</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>15.11.2025</td>
                <td>Creator</td>
                <td>590 ₽</td>
                <td>2 750</td>
                <td><span className="pill pill-ok">Оплачено</span></td>
              </tr>
              <tr>
                <td>01.10.2025</td>
                <td>Start</td>
                <td>290 ₽</td>
                <td>1 350</td>
                <td><span className="pill pill-ok">Оплачено</span></td>
              </tr>
              <tr>
                <td>15.09.2025</td>
                <td>Free</td>
                <td>0 ₽</td>
                <td>300</td>
                <td><span className="pill">Бесплатно</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}