import React, { useState } from 'react';

export default function Settings({ user, onUpdateProfile }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [notifyDone, setNotifyDone] = useState(true);

  const handleSave = (e) => {
    e.preventDefault();
    onUpdateProfile({ name, email });
    alert('Профиль успешно обновлен!');
  };

  return (
    <div>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Аккаунт</span>
          <h2 className="welcome-title">Настройки аккаунта</h2>
          <p className="welcome-sub">Управляйте профилем, безопасностью и уведомлениями.</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="settings-grid">
          <div className="panel">
            <div className="panel-head"><h3>Профиль</h3></div>
            <label className="field">
              <span>Имя</span>
              <input type="text" className="select" style={{height: '44px'}} value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" className="select" style={{height: '44px'}} value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <button type="submit" className="btn btn-primary">Сохранить</button>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Пароль</h3></div>
            <label className="field"><span>Текущий пароль</span><input type="password" className="select" style={{height: '44px'}} placeholder="••••••••" /></label>
            <label className="field"><span>Новый пароль</span><input type="password" className="select" style={{height: '44px'}} placeholder="Минимум 6 символов" /></label>
            <label className="field"><span>Подтверждение</span><input type="password" className="select" style={{height: '44px'}} placeholder="Повторите пароль" /></label>
            <button type="button" className="btn btn-ghost">Изменить пароль</button>
          </div>
        </div>
      </form>

      <div className="panel">
        <div className="panel-head"><h3>Уведомления</h3></div>
        <div className="set-row">
          <div className="set-info"><b>Email-уведомления</b><span>Важные события аккаунта и оплаты</span></div>
          <label className="switch"><input type="checkbox" defaultChecked /><span></span></label>
        </div>
        <div className="set-row">
          <div className="set-info"><b>Завершение обработки</b><span>Сообщать, когда проект готов</span></div>
          <label className="switch">
            <input type="checkbox" checked={notifyDone} onChange={e => setNotifyDone(e.target.checked)} /><span></span>
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Опасная зона</h3></div>
        <div className="set-row">
          <div className="set-info"><b>Удалить аккаунт</b><span>Все проекты и данные будут безвозвратно удалены</span></div>
          <button className="btn btn-ghost btn-sm" style={{color: 'var(--err)', borderColor: 'rgba(214,69,69,.3)'}}>Удалить</button>
        </div>
      </div>
    </div>
  );
}