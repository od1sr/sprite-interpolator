import React, { useCallback, useEffect, useState } from 'react';
import { listPayments } from '../api/client';

const PLANS = [
  {
    id: 'free', name: 'Free', price: '0 ₽', priceSpec: '0 ₽', tokens: 300, group: 'personal',
    rule: 'Пробный доступ при регистрации',
    credits: '300 кредитов',
    features: ['Апскейл до 1080p', 'Интерполяция до 60 fps', 'Стандартная очередь'],
  },
  {
    id: 'start', name: 'Start', price: '290 ₽', priceSpec: '290 ₽', tokens: 1350, group: 'personal',
    rule: 'Разовая покупка пакета',
    credits: '1 350 кредитов',
    features: ['Апскейл до 4K', 'Интерполяция до 120 fps', 'Приоритетная очередь'],
  },
  {
    id: 'creator', name: 'Creator', price: '590 ₽', priceSpec: '590 ₽', tokens: 2750, group: 'personal',
    rule: 'Разовая покупка пакета',
    credits: '2 750 кредитов',
    features: ['Апскейл до 4K', 'Интерполяция до 120 fps', 'Цветокоррекция', 'Приоритетная очередь'],
  },
  {
    id: 'pro', name: 'Pro', price: '1 490 ₽', priceSpec: '1 490 ₽', tokens: 7000, group: 'personal',
    rule: 'Разовая покупка пакета',
    credits: '7 000 кредитов',
    features: ['Апскейл до 8K', 'Интерполяция до 120 fps', 'Цветокоррекция', 'Максимальный приоритет'],
  },
  {
    id: 'business_start', name: 'Business Start', price: '14 900 ₽', priceSpec: '14 900 ₽ /мес', tokens: 20000, group: 'business',
    rule: 'Общий баланс организации',
    credits: '20 000 кредитов в месяц',
    features: ['До 5 пользователей', 'Апскейл до 4K', 'Приоритетная очередь'],
  },
  {
    id: 'business_pro', name: 'Business Pro', price: '29 900 ₽', priceSpec: '29 900 ₽ /мес', tokens: 40000, group: 'business',
    rule: 'Общий баланс организации',
    credits: '40 000 кредитов в месяц',
    features: ['До 15 пользователей', 'Апскейл до 8K', 'Цветокоррекция', 'Выделенные GPU-ноды'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'от 49 900 ₽', priceSpec: 'от 49 900 ₽ /мес', tokens: 70000, group: 'business',
    rule: 'Индивидуальные условия и объём',
    credits: 'От 70 000 кредитов в месяц',
    features: ['Неограниченное число пользователей', 'Все модули обработки', 'API и вебхуки', 'Персональный менеджер'],
  },
];

const formatNumber = (value) => new Intl.NumberFormat('ru-RU').format(value || 0);
const formatDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
};
const planName = (id) => PLANS.find((plan) => plan.id === id)?.name || id;
const STATUS_LABELS = { paid: 'Оплачено', free: 'Бесплатно' };

export default function Billing({ user, onPlanChange }) {
  const [busyPlan, setBusyPlan] = useState(null);
  const [error, setError] = useState('');
  const [payments, setPayments] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const currentPlanId = user?.plan || 'free';
  const currentPlan = PLANS.find((plan) => plan.id === currentPlanId) || PLANS[0];
  const balance = user?.token_balance ?? 0;

  const loadPayments = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      setPayments(await listPayments());
    } catch (requestError) {
      setHistoryError(requestError?.message || 'Не удалось загрузить историю платежей.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleBuy = async (plan) => {
    setBusyPlan(plan.id);
    setError('');
    try {
      await onPlanChange(plan.id);
      await loadPayments();
    } catch (requestError) {
      setError(requestError?.message || 'Не удалось начислить токены. Попробуйте ещё раз.');
    } finally {
      setBusyPlan(null);
    }
  };

  const renderPlanCard = (plan) => {
    const isRegistrationOnly = plan.id === 'free';
    return (
      <article className="plan-opt" key={plan.id} tabIndex={0} aria-label={`${plan.name}, ${plan.rule}`}>
        <span className="plan-spec-mark" aria-hidden="true">i</span>
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
        <div className="plan-spec" role="tooltip">
          <div className="plan-spec-head">
            <b>{plan.name}</b>
            <span>{plan.rule}</span>
          </div>
          <div className="plan-spec-price">{plan.priceSpec}</div>
          <div className="plan-spec-credits">{plan.credits}</div>
          <ul className="plan-spec-list">
            {plan.features.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </article>
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
          <span className="muted-sm">Ежемесячный общий баланс организации, от 2 пользователей.</span>
        </div>
        <div className="plan-options">
          {PLANS.filter((plan) => plan.group === 'business').map(renderPlanCard)}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>История платежей</h3></div>
        {historyLoading ? (
          <div className="empty">Загружаем историю платежей…</div>
        ) : historyError ? (
          <div className="error-banner" role="alert">⚠️ {historyError}</div>
        ) : payments.length ? (
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
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.created_at)}</td>
                    <td>{planName(payment.plan)}</td>
                    <td>{payment.plan === 'enterprise' ? 'от ' : ''}{formatNumber(payment.amount_rub)} ₽</td>
                    <td>{formatNumber(payment.tokens)}</td>
                    <td>
                      <span className={payment.status === 'paid' ? 'pill pill-ok' : 'pill'}>
                        {STATUS_LABELS[payment.status] || payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            Платежей пока нет. После регистрации здесь появится бесплатное начисление токенов.
          </div>
        )}
      </div>
    </div>
  );
}
