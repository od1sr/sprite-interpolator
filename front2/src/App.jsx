import React, { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useProjects } from './hooks/useProjects';
import Sidebar from './components/Sidebar';
import Landing from './views/Landing';
import Auth from './views/Auth';
import Dashboard from './views/Dashboard';
import NewProcess from './views/NewProcess';
import Projects from './views/Projects';
import Settings from './views/Settings';
import Admin from './views/Admin';

export default function App() {
  const { 
    user, isLoading, login, register, logout, 
    getPlan, updateProfile, changePlan, isAdmin 
  } = useAuth();
  const { projects, addProject } = useProjects();
  
  const [view, setView] = useState('landing');
  const [authMode, setAuthMode] = useState('login');

  if (isLoading) return <div style={{padding: 40, textAlign: 'center'}}>Загрузка...</div>;

  if (!user) {
    if (view === 'auth') {
      return (
        <Auth 
          mode={authMode} 
          setMode={setAuthMode} 
          onLogin={login} 
          onRegister={register} 
          onBack={() => setView('landing')} 
        />
      );
    }
    return <Landing onAuthClick={(mode) => { setAuthMode(mode); setView('auth'); }} />;
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return (
          <Dashboard 
            user={user} 
            projects={projects} 
            currentPlan={getPlan()} 
            onPlanChange={changePlan} 
          />
        );
      case 'new':
        return <NewProcess onAddProject={addProject} />;
      case 'projects':
        return <Projects projects={projects} />;
      case 'settings':
        return <Settings user={user} onUpdateProfile={updateProfile} />;
      case 'admin':
        if (!isAdmin) {
          return (
            <Dashboard 
              user={user} 
              projects={projects} 
              currentPlan={getPlan()} 
              onPlanChange={changePlan} 
            />
          );
        }
        return <Admin />;
      default:
        return (
          <Dashboard 
            user={user} 
            projects={projects} 
            currentPlan={getPlan()} 
            onPlanChange={changePlan} 
          />
        );
    }
  };

  const viewTitles = {
    dashboard: 'Обзор',
    new: 'Новая обработка',
    projects: 'Проекты',
    settings: 'Настройки аккаунта',
    admin: isAdmin ? 'Админ-панель' : 'Обзор' 
  };

  return (
    <div id="appShell">
      <Sidebar 
        currentView={view} 
        setView={setView} 
        user={user} 
        getPlan={getPlan} 
        onLogout={logout}
        isAdmin={isAdmin}  
      />
      <div className="app-main">
        <header className="topbar">
          <h1>{viewTitles[view] || 'Обзор'}</h1>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm">Документация</button>
          </div>
        </header>
        <div className="content">
          {renderView()}
        </div>
      </div>
    </div>
  );
}