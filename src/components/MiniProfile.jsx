import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import './MiniProfile.css';

// --- 輔助函數和 Hooks 保持不變 ---
const getPracticeLanguage = async (userId) => {
  if (!userId) return 'en';
  const { data, error } = await supabase
    .from('user_settings')
    .select('language')
    .eq('user_id', userId)
    .single();
  
  if (error) {
    console.error("Error fetching practice language:", error);
    return 'en';
  }
  return data?.language || 'en';
};


const MiniProfile = ({ userData }) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);

  const { data: latestPracticeLanguage } = useQuery({
    queryKey: ['practiceLanguage', userData?.id],
    queryFn: () => getPracticeLanguage(userData?.id),
    enabled: !!userData?.id,
    staleTime: 1000 * 30,
  });

  // ==================== 變更開始 ====================

  // ✨ 步驟 1: 創建一個更通用的 useMemo 來處理所有等級的顯示
  const currentLevelDisplay = useMemo(() => {
    const level = userData?.status?.cur_lvl;
    if (!level) {
      return null; // 如果沒有等級，返回 null
    }

    // 情況 A: 如果是初始測試
    if (level.startsWith('initial_test_')) {
      const progressCount = parseInt(level.split('_')[2], 10) || 1;
      return `Initial Test (${progressCount}/20)`;
    }

    return level.replace(/-/g, ' ');

  }, [userData?.status]);

  // 我們仍然保留 initialTestStatus，因為它包含了 currentWord
  const initialTestStatus = useMemo(() => {
    if (!userData?.status?.cur_lvl || !userData.status.cur_lvl.startsWith('initial_test_')) {
      return null;
    }
    return {
      currentWord: userData.status.cur_word || 'N/A',
    };
  }, [userData?.status]);

  // ==================== 變更結束 ====================


  if (!userData) {
    return null;
  }

  const getDisplayLanguage = (langCode) => {
    const languageMap = { en: 'English', zh: '繁體中文' };
    return languageMap[langCode] || langCode;
  };

  const { id, email, username, status } = userData;
  // ✨ 步驟 2: 為了更清晰，我們將 suggestedLevel 的 'N/A' 處理移到這裡
  const suggestedLevel = userData.settings?.sug_lvl 
  ? userData.settings.sug_lvl.replace(/-/g, ' ') 
  : 'Not set';
  const hasCompletedTest = !!userData.settings?.sug_lvl;

  return (
    <div 
      className="mini-profile-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="profile-content">
        {isHovered ? (
          <>
            <h4 className="status-header">{t('miniProfile.statusTitle', 'Current Status')}</h4>
            
            <p><strong>{t('miniProfile.language', 'Language')}:</strong> {getDisplayLanguage(latestPracticeLanguage)}</p>
            
            {/* ✨ 步驟 3: 修改 JSX，使用新的 currentLevelDisplay */}
            {hasCompletedTest ? (
              <>
                <p><strong>{t('miniProfile.sug_lvl', 'Suggested Lvl')}:</strong> {suggestedLevel}</p>
                {/* 現在無論何時都能正確顯示當前等級 */}
                <p><strong>{t('miniProfile.cur_lvl', 'Current Lvl')}:</strong> {currentLevelDisplay}</p>
                <p><strong>{t('miniProfile.target', 'Target Word')}:</strong> {status?.cur_word || 'N/A'}</p>
                <p><strong>{t('miniProfile.errors')}:</strong> {status?.cur_err || 'N/A'}</p>
              </>
            ) : (
              <>
                {/* 在初始測試期間，也能正確顯示 */}
                <p><strong>{t('miniProfile.cur_lvl', 'Current Lvl')}:</strong> {currentLevelDisplay}</p>
                <p><strong>{t('miniProfile.currentWord', 'Current Word')}:</strong> {initialTestStatus?.currentWord}</p>
              </>
            )}
          </>
        ) : (
          <>
            {/* 非懸停狀態保持不變 */}
            <h4 className="status-header">{t('miniProfile.title', 'Mini Profile')}</h4>
            <p><strong>{t('miniProfile.userId')}</strong> {id}</p>
            <p><strong>{t('miniProfile.emailAddress')}</strong> {email}</p>
            <p><strong>{t('miniProfile.userName')}</strong> {username || 'N/A'}</p>
          </>
        )}
      </div>
    </div>
  );
};

export default MiniProfile;
