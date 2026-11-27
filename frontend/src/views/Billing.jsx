import React, { useState } from 'react';

const PLANS = [
  { id: 'free',     name: 'Free',            price: '0 ₽',        tokens: 300,   rule: 'Пробный доступ при регистрации', group: 'personal' },
  { id: 'start',    name: 'Start',           price: '290 ₽',      tokens: 1350,  rule: 'Разовая покупка пакета', group: 'personal' },
  { id: 'creator',  name: 'Creator',         price: '590 ₽',      tokens: 2750,  rule: 'Разовая покупка пакета', group: 'personal' },
  { id: 'pro',      name: 'Pro',             price: '1 490 ₽',    tokens: 7000,  rule: 'Разовая покупка пакета', group: 'personal' },
  { id: 'business_start', name: 'Business Start', price: '14 900 ₽', tokens: 20000, rule: 'Общий баланс организации', group: 'business' },
  { id: 'business_pro',   name: 'Business Pro',   price: '29 900 ₽', tokens: 40000, rule: 'Общий баланс организации', group: 'business' },
  { id: 'enterprise',     name: 'Enterprise',     price: 'от 49 900 ₽', tokens: 70000, rule: 'Индивидуальные условия и объём', group: 'business' },
];

const formatNumber = (value) => new Intl.NumberFormat('ru-RU').format(value || 0);

export default function Billing({ user, onPlanChange }) {
  const [busyPlan, setBusyPlan] = useState(null);
  const [error, setError] = useState('');

  const currentPlanId = user?.plan || 'free';
  const currentPlan = PLANS.find((plan) => plan.id === currentPlanId) || PLANS[0];
  const balance = user?.token_balance ?? 0;

  const handleBuy = async (plan) => {
    setBusyPlan(plan.id);
    setError('');
    try {
      await onPlanChange(plan.id);
    } catch (requestError) {
      setError(requestError?.message || 'Не удалось начислить токены. Попробуйте ещё раз.');
    } finally {
      setBusyPlan(null);
    }
  };

  const renderPlanCard = (plan) => {
    const isRegistrationOnly = plan.id === 'free';
    return (
      <div className="plan-opt" key={plan.id}>
        <b>{plan.name}</b>
        <span>{plan.price}</span>
        <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>
          +{formatNumber(plan.tokens)} токенов
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{plan.rule}</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => handleBuy(plan)}
          disabled={isRegistrationOnly || busyPlan !== null}
        >
          {isRegistrationOnly
            ? 'Выдан при регистрации'
            : busyPlan === plan.id
              ? 'Начисляем…'
              : currentPlanId === plan.id ? 'Купить ещё' : 'Купить'}
        </button>
      </div>
    );
  };

  return (
    <div>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Подписка</span>
          <h2 className="welcome-title">Тарифы и токены</h2>
          <p className="welcome-sub">
            Выберите пакет — токены сразу попадут на баланс вашего аккаунта.
          </p>
        </div>
      </div>

      {error && <div className="error-banner" role="alert">⚠️ {error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h3>Текущий тариф</h3>
          <span className="pill pill-accent">{currentPlan.name}</span>
        </div>
        <div className="current-plan">
          <div>
            <div className="plan-name">{currentPlan.name}</div>
            <div className="plan-price">
              {currentPlan.price} <span>/ пакет</span>
            </div>
          </div>
          <div className="plan-usage">
            <div className="muted-sm">
              Доступно <b>{formatNumber(balance)}</b> токенов
            </div>
            <div className="bar">
              <i style={{ width: '100%' }}></i>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Для частных пользователей</h3>
          <span className="muted-sm">Разовые пакеты токенов</span>
        </div>
        <div className="plan-options">
          {PLANS.filter((plan) => plan.group === 'personal').map(renderPlanCard)}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>Для компаний и команд</h3>
          <span className="muted-sm">Общий баланс организации</span>
        </div>
        <div className="plan-options">
          {PLANS.filter((plan) => plan.group === 'business').map(renderPlanCard)}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>История платежей</h3></div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Тариф</th>
                <th>Сумма</th>
                <th>Токены</th>
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
