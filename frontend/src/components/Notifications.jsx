import React, { useEffect, useRef, useState } from 'react';

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

function NotificationCard({ item, onDismiss, className = '', onAnimationEnd }) {
  return (
    <div
      className={`notification-card notification-card--${item.kind}${className ? ` ${className}` : ''}`}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="notification-card-body">
        <b>{item.title}</b>
        <span>{item.message}</span>
      </div>
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
  );
}

export function NotificationBell({ notifications, onDismiss }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

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

  return (
    <div className="notification-bell" ref={wrapperRef}>
      <button
        type="button"
        className="icon-btn notification-bell-btn"
        aria-label={notifications.length ? `Уведомления: ${notifications.length}` : 'Уведомления'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <BellIcon />
        {notifications.length > 0 && (
          <span className="notification-count">{notifications.length > 99 ? '99+' : notifications.length}</span>
        )}
      </button>

      {open && (
        <div className="notification-popover" role="dialog" aria-label="Уведомления">
          <div className="notification-popover-head">
            <b>Уведомления</b>
            <span>{notifications.length}</span>
          </div>
          <div className="notification-popover-list">
            {notifications.length ? notifications.map((item) => (
              <NotificationCard key={item.id} item={item} onDismiss={onDismiss} className="is-compact" />
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
          <NotificationCard
            key={id}
            item={item}
            className={`notification-toast${leavingIds.has(id) ? ' is-leaving' : ''}`}
            onDismiss={onDismiss}
            onAnimationEnd={(event) => {
              if (leavingIds.has(id) && event.animationName === 'toast-out') onFinish(id);
            }}
          />
        );
      })}
    </div>
  );
}
