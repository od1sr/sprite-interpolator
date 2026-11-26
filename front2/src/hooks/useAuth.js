import { useState, useEffect } from 'react';

const STORAGE_KEY = 'zarya_user';

const PLANS = {
  start:  { name: 'Старт',  priceLabel: '0 ₽',     quota: 5,    used: 2 },
  pro:    { name: 'Про',    priceLabel: '990 ₽',   quota: 100,  used: 36 },
  studio: { name: 'Студия', priceLabel: '2 990 ₽', quota: null, used: 78 }
};

const ADMIN_EMAILS = ['vikazagnetina0@gmail.com', 'vikazagnetina0@gmail.com'];

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setUser(JSON.parse(saved));
    } catch (e) {
      console.error('Ошибка чтения localStorage:', e);
    }
    setIsLoading(false);
  }, []);

  const isAdmin = (userData) => {
    if (!userData) return false;
    if (ADMIN_EMAILS.includes(userData.email)) return true;
    return userData.role === 'admin';
  };

  const login = (email, password) => {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const name = existing?.name || email.split('@')[0];
    const newUser = { 
      name, 
      email, 
      plan: existing?.plan || 'pro',
      role: ADMIN_EMAILS.includes(email) ? 'admin' : 'user'  
    };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    return { success: true, user: newUser };
  };

  const register = (name, email, password) => {
    const newUser = { 
      name, 
      email, 
      plan: 'start',
      role: ADMIN_EMAILS.includes(email) ? 'admin' : 'user'  
    };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    return { success: true, user: newUser };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const updateProfile = (data) => {
    const updated = { ...user, ...data };
    setUser(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const changePlan = (planKey) => {
    if (!PLANS[planKey]) return;
    const updated = { ...user, plan: planKey };
    setUser(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const getPlan = () => PLANS[user?.plan] || PLANS.pro;

  return {
    user,
    isLoading,
    login,
    register,
    logout,
    updateProfile,
    changePlan,
    getPlan,
    isAdmin: isAdmin(user) 
  };
}