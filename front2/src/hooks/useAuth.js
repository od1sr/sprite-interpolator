import { useState, useEffect } from 'react';

const STORAGE_KEY = 'zarya_user';

const PLANS = {
  // Личные
  free:            { id: 'free',            name: 'Free',            price: '0 ₽',       credits: 300,    usedCredits: 0 },
  start:           { id: 'start',           name: 'Start',           price: '290 ₽',     credits: 1350,   usedCredits: 0 },
  creator:         { id: 'creator',         name: 'Creator',         price: '590 ₽',     credits: 2750,   usedCredits: 0 },
  pro:             { id: 'pro',             name: 'Pro',             price: '1 490 ₽',   credits: 7000,   usedCredits: 0 },
  // Корпоративные
  business_start:  { id: 'business_start',  name: 'Business Start',  price: '14 900 ₽',  credits: 20000,  usedCredits: 0 },
  business_pro:    { id: 'business_pro',    name: 'Business Pro',    price: '29 900 ₽',  credits: 40000,  usedCredits: 0 },
  enterprise:      { id: 'enterprise',      name: 'Enterprise',      price: 'от 49 900 ₽', credits: 70000, usedCredits: 0 },
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
      plan: 'free',
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