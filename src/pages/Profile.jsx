// src/pages/Profile.jsx (Final Secure Version)

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';

import { updateUserProfile, updateUserSettings, getUserData } from '../api/supabaseAPI';
import Loader from '../components/Loader';
import Message from '../components/Message';
import '../styles/Profile.css';

// =================================================================
// ==   自定義 Hooks (Custom Hooks)                               ==
// =================================================================

/**
 * 處理用戶資料更新的 Hook (用戶名和語言)。
 * 不再處理密碼。
 */
const useUpdateUser = () => {
  const queryClient = useQueryClient();
  const session = useSession();
  const userId = session?.user?.id;

  return useMutation({
    mutationFn: async ({ formData, initialData }) => {
      const promises = [];

      // 檢查用戶名是否有變更
      if (formData.username !== initialData.username) {
        promises.push(updateUserProfile(userId, { username: formData.username }));
      }
      // 檢查練習語言是否有變更
      if (formData.practice_language !== initialData.settings.language) {
        promises.push(updateUserSettings(userId, { language: formData.practice_language }));
      }

      if (promises.length === 0) {
        throw new Error("No changes detected.");
      }

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (error) => {
      console.error("Update failed:", error);
    },
  });
};


// =================================================================
// ==   Profile 組件                                              ==
// =================================================================

export default function Profile() {
  const { t } = useTranslation();
  const session = useSession();
  const supabaseClient = useSupabaseClient();
  
  const { data: userData, isLoading: isLoadingUserData } = useQuery({
    queryKey: ['user', session?.user?.id],
    queryFn: () => getUserData(session?.user?.id),
    enabled: !!session?.user?.id,
    staleTime: Infinity,
  });

  const { mutate: updateUser, isPending: isUpdating, isSuccess, isError, error } = useUpdateUser();

  const [formData, setFormData] = useState({
    username: '',
    practice_language: 'en',
  });
  
  // 用於顯示密碼重置郵件發送狀態的 state
  const [resetMessage, setResetMessage] = useState({ text: '', type: 'info' });

  useEffect(() => {
    if (userData) {
      setFormData({
        username: userData.username || '',
        practice_language: userData.settings?.language || 'en',
      });
    }
  }, [userData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({ ...prevData, [name]: value }));
  };

  // 只處理用戶名和語言的更新
  const handleUpdate = (e) => {
    e.preventDefault();
    updateUser({ formData, initialData: userData });
  };

  // 處理發送密碼重置郵件的函數
  const handlePasswordReset = async () => {
    setResetMessage({ text: 'Sending...', type: 'info' });
    const { error } = await supabaseClient.auth.resetPasswordForEmail(session.user.email, {
        // 讓用戶重置密碼後，可以跳轉回你的應用
        redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
        setResetMessage({ text: `Error: ${error.message}`, type: 'error' });
    } else {
        setResetMessage({ text: 'Password reset email sent! Please check your inbox.', type: 'success' });
    }
  };

  const message = useMemo(() => {
    if (isSuccess) {
      return { text: 'Profile updated successfully!', type: 'success' };
    }
    if (isError) {
      if (error.message === "No changes detected.") {
        return { text: error.message, type: 'info' };
      }
      return { text: `Update failed: ${error.message}`, type: 'error' };
    }
    return { text: '', type: '' };
  }, [isSuccess, isError, error]);

  const formatHongKongTime = (utcDateString) => {
    if (!utcDateString) return 'N/A';
    return formatInTimeZone(utcDateString, 'Asia/Hong_Kong', 'yyyy-MM-dd HH:mm:ss');
  };

  if (isLoadingUserData) {
    return <main className="profile-page-container"><h1 className="page-title">{t('profilePage.title')}</h1><Loader /></main>;
  }

  return (
    <main className="profile-page-container">
      <h1 className="page-title">{t('profilePage.title')}</h1>
      {/* 這個 Message 組件用於顯示用戶名/語言的更新狀態 */}
      {message.text && <Message text={message.text} type={message.type} />}
      
      <div id="profile-form" className="profile-form">
        <div className="input-group">
            <label htmlFor="user-id">{t('profilePage.userId')}</label>
            <input type="text" id="user-id" value={userData?.id || ''} disabled />
        </div>
        <div className="input-group">
            <label htmlFor="created-time">{t('profilePage.accountCreated')}</label>
            <input type="text" id="created-time" value={formatHongKongTime(session?.user?.created_at)} disabled />
        </div>
        <div className="input-group">
            <label htmlFor="email">{t('profilePage.emailAddress')}</label>
            <input type="email" id="email" value={session?.user?.email || ''} disabled />
        </div>
        <div className="input-group">
            <label htmlFor="user-name">{t('profilePage.userName')}</label>
            <input type="text" id="user-name" name="username" value={formData.username} onChange={handleInputChange} placeholder="Please set your username" />
        </div>
        <div className="input-group">
          <label htmlFor="practice-language">{t('profilePage.practiceLanguage', 'Practice Language')}</label>
          <select id="practice-language" name="practice_language" className="input-group-select" value={formData.practice_language} onChange={handleInputChange}>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </div>

        {/* 密碼重置部分 */}
        <div className="input-group">
            <label htmlFor="change-password">Password</label>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-light)', margin: 0, marginBottom: '0.75rem' }}>
                For security, password changes are handled via email.
            </p>
            <button 
                type="button" 
                id="change-password-btn" 
                className="secondary-btn"
                onClick={handlePasswordReset}
            >
                Send Password Reset Email
            </button>
            {/* 這個 Message 組件用於顯示密碼重置郵件的發送狀態 */}
            {resetMessage.text && <div style={{marginTop: '1rem'}}><Message text={resetMessage.text} type={resetMessage.type} /></div>}
        </div>

        <div className="form-actions">
          <button type="button" id="update-button" className="update-btn" disabled={isUpdating} onClick={handleUpdate}>
            {isUpdating ? <Loader /> : <span>{t('profilePage.updateButton')}</span>}
          </button>
        </div>
      </div>
    </main>
  );
}
