import React, { useEffect, useRef, useState } from 'react';
import { NOTIFICATION_VISIBLE_MS } from '../hooks/useNotifications';

const KIND_LABELS = {
  success: 'Готово',
  danger: 'Внимание',
  info: 'Сообщение',
};

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function KindIcon({ kind }) {
  if (kind === 'success') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7" />
      </svg>
    );
  }
  if (kind === 'danger') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 7v7M12 17.5v.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 11v6M12 7.5v.5" />
    </svg>
  );
}

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function NotificationCard({ item, onDismiss }) {
  return (
    <div className={`notification-card notification-card--${item.kind}${item.read ? '' : ' is-unread'}`}>
      <span className="notification-card-icon"><KindIcon kind={item.kind} /></span>
      <div className="notification-card-body">
        <b>{item.title}</b>
        <span>{item.message}</span>
      </div>
      <div className="notification-card-side">
        <time>{formatTime(item.created_at)}</time>
        {onDismiss && (
          <button
            type="button"
            className="notification-close"
            aria-label="Удалить уведомление"
            title="Удалить уведомление"
            onClick={() => onDismiss(item.id)}
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function ToastCard({ item, leaving, onFinish, onDismiss }) {
  return (
    <div
      className={`notification-card notification-card--${item.kind} notification-toast${leaving ? ' is-leaving' : ''}`}
      onAnimationEnd={(event) => {
        if (leaving && event.animationName === 'toast-out') onFinish(item.id);
      }}
    >
      <div className="notification-toast-head">
        <span className="notification-kind">
          <KindIcon kind={item.kind} />
          {KIND_LABELS[item.kind] || KIND_LABELS.info}
        </span>
        <time>{formatTime(item.created_at)}</time>
        <button
          type="button"
          className="notification-close"
          aria-label="Закрыть уведомление"
          title="Закрыть уведомление"
          onClick={() => onDismiss(item.id)}
        >
          <CloseIcon />
        </button>
      </div>
      <div className="notification-card-body">
        <b>{item.title}</b>
        <span>{item.message}</span>
      </div>
      <div className="notification-progress" aria-hidden="true">
        <i style={{ animationDuration: `${NOTIFICATION_VISIBLE_MS}ms` }} />
      </div>
    </div>
  );
}

export function NotificationBell({ notifications, onDismiss, onReadAll }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const unreadCount = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleClick = () => {
    if (!open) onReadAll();
    setOpen((current) => !current);
  };

  return (
    <div className="notification-bell" ref={wrapperRef}>
      <button
        type="button"
        className="icon-btn notification-bell-btn"
        aria-label={unreadCount ? `Непрочитанные уведомления: ${unreadCount}` : 'Уведомления'}
        aria-expanded={open}
        onClick={handleClick}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-popover" role="dialog" aria-label="Уведомления">
          <div className="notification-popover-head">
            <b>Уведомления</b>
            <span>{notifications.length ? `${notifications.length} в списке` : 'пусто'}</span>
          </div>
          <div className="notification-popover-list">
            {notifications.length ? notifications.map((item) => (
              <NotificationCard key={item.id} item={item} onDismiss={onDismiss} />
            )) : <p className="notification-empty">Уведомлений пока нет</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function ToastStack({ notifications, toastIds, leavingIds, onFinish, onDismiss }) {
  if (!toastIds.length) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {toastIds.map((id) => {
        const item = notifications.find((notification) => notification.id === id);
        if (!item) return null;
        return (
          <ToastCard
            key={id}
            item={item}
            leaving={leavingIds.has(id)}
            onFinish={onFinish}
            onDismiss={onDismiss}
          />
        );
      })}
    </div>
  );
}
