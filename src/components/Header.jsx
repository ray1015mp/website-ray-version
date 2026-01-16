// src/components/Header.jsx (The final, truly logical version)

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import "../styles/App.css"; // 確保導入了樣式檔案

const Header = ({ activePage, onNavigate, onLogout, hasCompletedTest }) => {
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
    <header className="app-header">
      <div 
        className="header-title" 
        onClick={() => onNavigate('/introduction')}
        style={{ cursor: 'pointer' }}
      >
        TheraLingua AI
      </div>
      <nav className="header-nav">
        
        {/* 1. Introduction 按鈕: 始終顯示 */}
        <button 
          className={getButtonClass("Introduction")} 
          onClick={() => onNavigate('/introduction')}
        >
          {t('header.introduction')}
        </button>

        

        {/* --- ✨ 核心修正: 這是唯一需要條件判斷的地方 ✨ --- */}
        {hasCompletedTest ? (
          // --- 如果【已完成】測試，顯示常規的 Practice 和 Records 按鈕 ---
          <>
            <button 
              className={getButtonClass("Practice")} 
              onClick={() => onNavigate('/practice')}
            >
              {t('header.practice')}
            </button>
            <button 
              className={getButtonClass("Records")} 
              onClick={() => onNavigate('/records')}
            >
              {t('header.records')}
            </button>


            {/* ====================================================== */}
            {/* == ✨ 新增的按鈕 ✨ == */}
            {/* ====================================================== */}
            <button 
              className={getButtonClass("leaderboard")} 
              onClick={() => onNavigate('/leaderboard')}
            >
              {t('header.leaderboard')}
            </button>
            <button 
              className={getButtonClass("friends")} 
              onClick={() => onNavigate('/friends')}
            >
              {t('header.friends')}
            </button>
            <button 
              className={getButtonClass("find-tutor")} 
              onClick={() => onNavigate('/find-tutor')}
            >
              {t('header.findTutor')}
            </button>
            {/* ====================================================== */}

            <button 
              className={getButtonClass("TrainingPlanModal")} 
              onClick={() => onNavigate('/TrainingPlanModal')}
            >
              {t('header.TrainingPlanModal')}
            </button>

            <button 
              className={getButtonClass("contextual")} 
              onClick={() => onNavigate('/contextual')}
            >
              {t('header.contextual')}
            </button>


          </>
        ) : (
          // --- 如果【未完成】測試，只顯示一個指向測試頁的按鈕 ---
          <button 
            className={getButtonClass("InitialTest")} // 當 activePage 是 'InitialTest' 時，它會自動高亮
            onClick={() => onNavigate('/initial-test')}
          >
            {t('header.initialTest')}
          </button>
        )}

        {/* 3. Profile 按鈕: 始終顯示 */}
        <button 
          className={getButtonClass("Profile")} 
          onClick={() => onNavigate('/profile')}
        >
          {t('header.profile')}
        </button>
        
        {/* 4. Logout 按鈕: 始終顯示 */}
        <button className="logout" onClick={onLogout}>
          {t('header.logout')}
        </button>

        {/* 5. Return to Admin 按鈕: 只在測試模式顯示 */}
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

export default Header;