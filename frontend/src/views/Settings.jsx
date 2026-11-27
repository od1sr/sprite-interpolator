import React, { useEffect, useState } from 'react';

export default function Settings({ user, onUpdateProfile }) {
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [notifyDone, setNotifyDone] = useState(true);

  useEffect(() => {
    setDisplayName(user?.display_name || '');
  }, [user?.id, user?.display_name]);

  const handleSave = (event) => {
    event.preventDefault();
    onUpdateProfile({ display_name: displayName.trim() || null });
    alert('Имя сохранено в этом браузере');
  };

  return (
    <div>
      <div className="welcome">
        <div>
          <span className="welcome-eyebrow">Аккаунт</span>
          <h2 className="welcome-title">Настройки аккаунта</h2>
          <p className="welcome-sub">Логин и рабочее пространство привязаны к вашему аккаунту.</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div className="settings-grid">
          <div className="panel">
            <div className="panel-head"><h3>Профиль</h3></div>
            <label className="field">
              <span>Логин</span>
              <input className="select" style={{height: '44px'}} value={user?.username || ''} readOnly />
            </label>
            <label className="field">
              <span>Отображаемое имя</span>
              <input
                type="text"
                className="select"
                style={{height: '44px'}}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Как к вам обращаться"
                maxLength={120}
              />
            </label>
            <button type="submit" className="btn btn-primary">Сохранить</button>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Безопасность</h3></div>
            <div className="set-row">
              <div className="set-info">
                <b>Вход по логину и паролю</b>
                <span>Пароль хранится на сервере в хешированном виде</span>
              </div>
            </div>
            <div className="set-row">
              <div className="set-info">
                <b>Личное рабочее пространство</b>
                <span>Другие пользователи не видят ваши проекты и файлы</span>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="panel">
        <div className="panel-head"><h3>Уведомления</h3></div>
        <div className="set-row">
          <div className="set-info"><b>Завершение обработки</b><span>Сообщать, когда проект готов</span></div>
          <label className="switch">
            <input type="checkbox" checked={notifyDone} onChange={e => setNotifyDone(e.target.checked)} /><span></span>
          </label>
        </div>
      </div>
    </div>
  );
}
