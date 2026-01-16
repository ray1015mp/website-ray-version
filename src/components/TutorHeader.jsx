// src/components/TutorHeader.jsx
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import "../styles/App.css";

const TutorHeader = ({ activePage, onNavigate, onLogout }) => {
  const { t } = useTranslation();
  const getButtonClass = (pageName) => (activePage === pageName ? "active" : "");
  const [isAdminTestMode, setIsAdminTestMode] = useState(false);

  useEffect(() => {
    // Check if we're in admin test mode
    const adminTestMode = localStorage.getItem('adminTestMode');
    setIsAdminTestMode(adminTestMode === 'true');
  }, []);

  const handleReturnToAdmin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Restore admin role
        await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', user.id);
      }
      localStorage.removeItem('adminTestMode');
      window.location.href = '/admin';
    } catch (err) {
      console.error('Error returning to admin:', err);
    }
  };

  return (
    <header className="app-header tutor-header">
      <div className="header-title">TheraLingua AI - Tutor</div>
      <nav className="header-nav">
        
        {/* Tutor Dashboard (獨有) */}
        <button 
          className={getButtonClass("dashboard")} 
          onClick={() => onNavigate('/tutor/dashboard')}
        >
          {t('header.dashboard', 'Dashboard')}
        </button>

        {/* Introduction (共用) */}
        <button 
          className={getButtonClass("introduction")} 
          onClick={() => onNavigate('/tutor/introduction')}
        >
          {t('header.introduction')}
        </button>

        {/* Profile (共用) */}
        <button 
          className={getButtonClass("profile")} 
          onClick={() => onNavigate('/tutor/profile')}
        >
          {t('header.profile')}
        </button>

        {/* Leaderboard (共用) */}
        <button 
          className={getButtonClass("leaderboard")} 
          onClick={() => onNavigate('/tutor/leaderboard')}
        >
          {t('header.leaderboard')}
        </button>

        {/* Logout */}
        <button className="logout" onClick={onLogout}>
          {t('header.logout')}
        </button>

        {/* Return to Admin 按鈕: 只在測試模式顯示 */}
        {isAdminTestMode && (
          <button 
            className="return-admin-btn" 
            onClick={handleReturnToAdmin}
            style={{
              backgroundColor: '#9b59b6',
              color: 'white',
              marginLeft: '0.5rem'
            }}
          >
            {t('header.returnToAdmin')}
          </button>
        )}

      </nav>
    </header>
  );
};

export default TutorHeader;