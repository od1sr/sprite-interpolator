import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'zarya.notifications';
export const NOTIFICATION_VISIBLE_MS = 8000;
const EXIT_MS = 400;
const MAX_NOTIFICATIONS = 30;
const MAX_TOASTS = 4;

function loadNotifications() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items)
      ? items.slice(0, MAX_NOTIFICATIONS).map((item) => ({ ...item, read: Boolean(item.read) }))
      : [];
  } catch {
    return [];
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState(loadNotifications);
  const [toastIds, setToastIds] = useState([]);
  const [leavingIds, setLeavingIds] = useState(() => new Set());
  const timers = useRef(new Map());

  const storeTimer = useCallback((id, timer) => {
    const current = timers.current.get(id) || [];
    timers.current.set(id, [...current, timer]);
  }, []);

  const clearTimers = useCallback((id) => {
    (timers.current.get(id) || []).forEach((timer) => window.clearTimeout(timer));
    timers.current.delete(id);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // Notifications still work for this session if storage is unavailable.
    }
  }, [notifications]);

  useEffect(() => () => {
    timers.current.forEach((items) => items.forEach((timer) => window.clearTimeout(timer)));
    timers.current.clear();
  }, []);

  const finishToast = useCallback((id) => {
    setToastIds((current) => current.filter((item) => item !== id));
    setLeavingIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const dismiss = useCallback((id) => {
    clearTimers(id);
    setNotifications((current) => current.filter((item) => item.id !== id));
    finishToast(id);
  }, [clearTimers, finishToast]);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((item) => (
      item.read ? item : { ...item, read: true }
    )));
  }, []);

  const notify = useCallback(({ title, message, kind = 'info' }) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const item = {
      id,
      title,
      message,
      kind,
      read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications((current) => [item, ...current].slice(0, MAX_NOTIFICATIONS));
    setToastIds((current) => [id, ...current].slice(0, MAX_TOASTS));

    storeTimer(id, window.setTimeout(() => {
      setLeavingIds((current) => new Set(current).add(id));
      // The CSS animation normally calls finishToast; this covers reduced
      // motion and toasts already pushed out of the visible stack.
      storeTimer(id, window.setTimeout(() => finishToast(id), EXIT_MS));
    }, NOTIFICATION_VISIBLE_MS));

    return id;
  }, [finishToast, storeTimer]);

  return {
    notifications,
    toastIds,
    leavingIds,
    notify,
    dismiss,
    markAllRead,
    finishToast,
  };
}
