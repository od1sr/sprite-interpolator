import { useCallback, useEffect, useState } from 'react';
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  purchasePlan,
  registerUser,
} from '../api/client';

const LEGACY_STORAGE_KEY = 'zarya_user';

const PLANS = {
  free:    { id: 'free',  name: 'Free',  price: '0 ₽',     tokens: 300 },
  start:   { id: 'start', name: 'Start', price: '290 ₽',   tokens: 1350 },
  creator: { id: 'creator', name: 'Creator', price: '590 ₽', tokens: 2750 },
  pro:     { id: 'pro',   name: 'Pro',   price: '1 490 ₽', tokens: 7000 },
  business_start: { id: 'business_start', name: 'Business Start', price: '14 900 ₽', tokens: 20000 },
  business_pro:   { id: 'business_pro',   name: 'Business Pro',   price: '29 900 ₽', tokens: 40000 },
  enterprise:     { id: 'enterprise',     name: 'Enterprise',     price: 'от 49 900 ₽', tokens: 70000 },
};

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    localStorage.removeItem(LEGACY_STORAGE_KEY);

    getCurrentUser()
      .then((current) => { if (active) setUser(current); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setIsLoading(false); });

    const handleUnauthorized = () => setUser(null);
    window.addEventListener('zarya:unauthorized', handleUnauthorized);
    return () => {
      active = false;
      window.removeEventListener('zarya:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const current = await loginUser({ username, password });
    setUser(current);
    return current;
  }, []);

  const register = useCallback(async (username, password, displayName) => {
    const current = await registerUser({
      username,
      password,
      display_name: displayName || null,
    });
    setUser(current);
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
    }
  }, []);

  const buyPlan = useCallback(async (plan) => {
    const current = await purchasePlan({ plan });
    setUser(current);
    return current;
  }, []);

  const refreshUser = useCallback(async () => {
    const current = await getCurrentUser();
    setUser(current);
    return current;
  }, []);

  const updateProfile = useCallback((patch) => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const getPlan = useCallback(() => {
    const plan = user?.plan || 'free';
    return { ...(PLANS[plan] || PLANS.free), token_balance: user?.token_balance ?? 0 };
  }, [user]);

  return { user, isLoading, login, register, logout, buyPlan, refreshUser, getPlan, updateProfile };
}
