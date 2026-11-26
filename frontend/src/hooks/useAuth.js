import { useState, useEffect } from 'react';

const STORAGE_KEY = 'zarya_user';
const PLANS = {
  free:    { id: 'free',  name: 'Free',  price: '0 ₽',     credits: 300,   usedCredits: 0 },
  start:   { id: 'start', name: 'Start', price: '290 ₽',   credits: 1350,  usedCredits: 0 },
  creator: { id: 'creator', name: 'Creator', price: '590 ₽', credits: 2750, usedCredits: 0 },
  pro:     { id: 'pro',   name: 'Pro',   price: '1 490 ₽', credits: 7000,  usedCredits: 0 },
  business_start: { id: 'business_start', name: 'Business Start', price: '14 900 ₽', credits: 20000, usedCredits: 0 },
  business_pro:   { id: 'business_pro',   name: 'Business Pro',   price: '29 900 ₽', credits: 40000, usedCredits: 0 },
  enterprise:     { id: 'enterprise',     name: 'Enterprise',     price: 'от 49 900 ₽', credits: 70000, usedCredits: 0 },
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
    const newUser = { name, email, plan: 'free' };
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