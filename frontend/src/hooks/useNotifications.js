import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_PREFIX = 'zarya.notifications';
export const NOTIFICATION_VISIBLE_MS = 8000;
const EXIT_MS = 400;
const MAX_NOTIFICATIONS = 30;
const MAX_TOASTS = 4;

function storageKey(userId) {
  return userId ? `${STORAGE_PREFIX}.${userId}` : null;
}

function loadNotifications(userId) {
  const key = storageKey(userId);
  if (!key) return [];
  try {
    const raw = window.localStorage.getItem(key);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items)
      ? items.slice(0, MAX_NOTIFICATIONS).map((item) => ({ ...item, read: Boolean(item.read) }))
      : [];
  } catch {
    return [];
  }
}

export function useNotifications(userId) {
  const [state, setState] = useState(() => ({ userId, items: loadNotifications(userId) }));
  const notifications = state.items;
  const [toastIds, setToastIds] = useState([]);
  const [leavingIds, setLeavingIds] = useState(() => new Set());
  const timers = useRef(new Map());

  const updateNotifications = useCallback((updater) => {
    setState((current) => (
      current.userId === userId
        ? { ...current, items: updater(current.items) }
        : current
    ));
  }, [userId]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((items) => items.forEach((timer) => window.clearTimeout(timer)));
    timers.current.clear();
  }, []);

  // A different account gets its own list; visible toasts never leak between users.
  useEffect(() => {
    clearTimers();
    setToastIds([]);
    setLeavingIds(new Set());
    setState({ userId, items: loadNotifications(userId) });
  }, [userId, clearTimers]);

  useEffect(() => {
    const key = storageKey(userId);
    if (!key || state.userId !== userId) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state.items));
    } catch {
      // Notifications still work for this session if storage is unavailable.
    }
  }, [state, userId]);

  useEffect(() => clearTimers, [clearTimers]);

  const storeTimer = useCallback((id, timer) => {
    const current = timers.current.get(id) || [];
    timers.current.set(id, [...current, timer]);
  }, []);

  const clearIdTimers = useCallback((id) => {
    (timers.current.get(id) || []).forEach((timer) => window.clearTimeout(timer));
    timers.current.delete(id);
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
    clearIdTimers(id);
    updateNotifications((items) => items.filter((item) => item.id !== id));
    finishToast(id);
  }, [clearIdTimers, finishToast, updateNotifications]);

  const markAllRead = useCallback(() => {
    updateNotifications((items) => items.map((item) => (
      item.read ? item : { ...item, read: true }
    )));
  }, [updateNotifications]);

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
    updateNotifications((items) => [item, ...items].slice(0, MAX_NOTIFICATIONS));
    setToastIds((current) => [id, ...current].slice(0, MAX_TOASTS));

    storeTimer(id, window.setTimeout(() => {
      setLeavingIds((current) => new Set(current).add(id));
      // The CSS animation normally calls finishToast; this covers reduced
      // motion and toasts already pushed out of the visible stack.
      storeTimer(id, window.setTimeout(() => finishToast(id), EXIT_MS));
    }, NOTIFICATION_VISIBLE_MS));

    return id;
  }, [finishToast, storeTimer, updateNotifications]);

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
