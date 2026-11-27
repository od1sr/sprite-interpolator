import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../api/client';

const LEGACY_STORAGE_KEY = 'zarya_user';
const PLAN_STORAGE_PREFIX = 'zarya_plan:';

const PLANS = {
  free:    { id: 'free',  name: 'Free',  price: '0 ₽',     credits: 300,   usedCredits: 0 },
  start:   { id: 'start', name: 'Start', price: '290 ₽',   credits: 1350,  usedCredits: 0 },
  creator: { id: 'creator', name: 'Creator', price: '590 ₽', credits: 2750, usedCredits: 0 },
  pro:     { id: 'pro',   name: 'Pro',   price: '1 490 ₽', credits: 7000,  usedCredits: 0 },
  business_start: { id: 'business_start', name: 'Business Start', price: '14 900 ₽', credits: 20000, usedCredits: 0 },
  business_pro:   { id: 'business_pro',   name: 'Business Pro',   price: '29 900 ₽', credits: 40000, usedCredits: 0 },
  enterprise:     { id: 'enterprise',     name: 'Enterprise',     price: 'от 49 900 ₽', credits: 70000, usedCredits: 0 },
};

function planKey(userId) {
  return `${PLAN_STORAGE_PREFIX}${userId || 'anonymous'}`;
}

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

  const updateProfile = useCallback((patch) => {
    setUser((current) => {
      if (!current) return current;
      if (patch.plan) localStorage.setItem(planKey(current.id), patch.plan);
      return { ...current, ...patch };
    });
  }, []);

  const getPlan = useCallback(() => {
    if (!user) return PLANS.free;
    const planId = user.plan || localStorage.getItem(planKey(user.id)) || 'free';
    return PLANS[planId] || PLANS.free;
  }, [user]);

  return { user, isLoading, login, register, logout, getPlan, updateProfile };
}
