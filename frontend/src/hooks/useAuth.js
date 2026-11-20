import { useState, useEffect } from 'react';

const STORAGE_KEY = 'zarya_user';
const PLANS = {
  start: { name: 'Старт', priceLabel: '0 ₽', quota: 5, used: 2 },
  pro: { name: 'Про', priceLabel: '990 ₽', quota: 100, used: 36 },
  studio: { name: 'Студия', priceLabel: '2 990 ₽', quota: null, used: 78 }
};

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch (e) {}
    setIsLoading(false);
  }, []);

  const login = (email, name) => {
    const newUser = { name: name || email.split('@')[0], email, plan: 'pro' };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  };

  const register = (name, email) => {
    const newUser = { name, email, plan: 'pro' };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    return newUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateProfile = (newData) => {
    const updated = { ...user, ...newData };
    setUser(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const getPlan = () => PLANS[user?.plan] || PLANS.pro;

  return { user, isLoading, login, register, logout, updateProfile, getPlan };
}