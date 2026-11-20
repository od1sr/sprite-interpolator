import React from 'react';

export default function Admin() {
  const users = [
    { name: 'Анна Ковалёва', email: 'anna@studio.ru', plan: 'Про', projects: 128, status: 'Активен', statusClass: 'pill-ok' },
    { name: 'Дмитрий Мельник', email: 'dm@frame.io', plan: 'Студия', projects: 512, status: 'Активен', statusClass: 'pill-ok' },
    { name: 'Ирина Соколова', email: 'ira@video.ru', plan: 'Старт', projects: 4, status: 'Неактивен', statusClass: '' },
    { name: 'Максим Петров', email: 'max@reel.co', plan: 'Про', projects: 87, status: 'Заблокирован', statusClass: 'pill-err' },
  ];

  const logs = [
    { time: '14:32', text: 'Задача <b>#8812</b> завершена за 4 мин 12 с' },
    { time: '14:18', text: 'Новый пользователь <b>elena@cut.studio</b>' },
    { time: '13:54', text: 'Нода <b>gpu-07</b> подключена к пулу' },
    { time: '13:21', text: 'Ошибка кодека в задаче <b>#8804</b>' },
  ];

  return (
    <div>
      <div className="stats">
        <div className="stat"><div className="stat-label">Пользователей</div><div className="stat-val">2 481</div><div className="stat-sub up">+38 за сутки</div></div>
        <div className="stat"><div className="stat-label">Активных задач</div><div className="stat-val">47</div><div className="stat-sub">в очереди: 12</div></div>
        <div className="stat"><div className="stat-label">Загрузка GPU</div><div className="stat-val">73%</div><div className="stat-sub">8 нод из 10</div></div>
        <div className="stat"><div className="stat-label">Ошибки за сутки</div><div className="stat-val">6</div><div className="stat-sub">0,4% от задач</div></div>
      </div>

      <div className="admin-grid">
        <div className="panel">
          <div className="panel-head">
            <h3>Пользователи</h3>
            <button className="btn btn-ghost btn-sm">Управление</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Пользователь</th><th>Тариф</th><th>Проектов</th><th>Статус</th></tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i}>
                    <td>
                      <div className="cell-user">
                        <div className="avatar sm">{u.name.split(' ').map(w=>w[0]).join('')}</div>
                        <div><b>{u.name}</b><span>{u.email}</span></div>
                      </div>
                    </td>
                    <td><span className="pill">{u.plan}</span></td>
                    <td>{u.projects}</td>
                    <td><span className={`pill ${u.statusClass}`}>{u.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div className="panel">
            <div className="panel-head"><h3>Ресурсы кластера</h3></div>
            <div className="metric">
              <div className="metric-top"><span>GPU</span><b>73%</b></div>
              <div className="bar"><i style={{width: '73%'}}></i></div>
            </div>
            <div className="metric">
              <div className="metric-top"><span>CPU</span><b>41%</b></div>
              <div className="bar"><i style={{width: '41%', background: '#7B9CFF'}}></i></div>
            </div>
            <div className="metric">
              <div className="metric-top"><span>Память</span><b>58%</b></div>
              <div className="bar"><i style={{width: '58%', background: '#B48CFF'}}></i></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>События</h3><span className="muted-sm">сегодня</span></div>
            {logs.map((log, i) => (
              <div className="log" key={i}>
                <div className="log-time">{log.time}</div>
                <div className="log-text" dangerouslySetInnerHTML={{__html: log.text}}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}