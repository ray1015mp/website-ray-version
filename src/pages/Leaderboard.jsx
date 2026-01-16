import React, { useState, useMemo } from "react";
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from "../supabaseClient";
import Loader from "../components/Loader";
import "../styles/Leaderboard.css";


// =================================================================
// ==   API 函數：用於獲取排行榜數據 (已根據您的資料庫修改)       ==
// =================================================================
const getLeaderboardData = async () => {
  // 呼叫我們剛剛部署的雲端函式
  const { data, error } = await supabase.functions.invoke('get-leaderboard');

  // 如果呼叫出錯，則拋出錯誤讓 React Query 捕獲
  if (error) {
    throw new Error(`Failed to fetch leaderboard: ${error.message}`);
  }

  // 如果成功，直接回傳從雲端計算好的排行榜資料
  return data;
};


// =================================================================
// ==   Leaderboard (排行榜) 元件本身                             ==
// =================================================================

export default function Leaderboard() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('accuracy');
  
  const { data: leaderboardData, isLoading, isError } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboardData,
    staleTime: 1000 * 60 * 5,
  });

  const sortedLeaderboard = useMemo(() => {
    if (!leaderboardData) return [];
    const dataCopy = [...leaderboardData];
    if (activeTab === 'accuracy') {
      return dataCopy.sort((a, b) => b.average_accuracy - a.average_accuracy);
    }
    if (activeTab === 'practice_count') {
      return dataCopy.sort((a, b) => b.practice_count - a.practice_count);
    }
    return dataCopy;
  }, [leaderboardData, activeTab]);

  if (isLoading) {
    return (
      <main className="main-content width-leaderboard">
        <h1 className="page-title">{t('leaderboardPage.title')}</h1>
        <Loader />
      </main>
    );
  }

  if (isError) {
    return (
      <main className="main-content width-leaderboard">
        <p>載入排行榜數據時發生錯誤。</p>
      </main>
    );
  }

  return (
    <main className="main-content width-leaderboard">
      <h1 className="page-title">{t('leaderboardPage.title')}</h1>
      <p className="page-subtitle">{t('leaderboardPage.subtitle')}</p>

      <div className="leaderboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'accuracy' ? 'active' : ''}`}
          onClick={() => setActiveTab('accuracy')}
        >
          {t('leaderboardPage.tabs.accuracy')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'practice_count' ? 'active' : ''}`}
          onClick={() => setActiveTab('practice_count')}
        >
          {t('leaderboardPage.tabs.practiceCount')}
        </button>
      </div>

      <div className="leaderboard-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>{t('leaderboardPage.table.rank')}</th>
              <th>{t('leaderboardPage.table.player')}</th>
              <th>{t('leaderboardPage.table.practiceCount')}</th>
              <th>{t('leaderboardPage.table.avgAccuracy')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeaderboard.length > 0 ? (
              sortedLeaderboard.map((user, index) => (
                <tr key={user.id}>
                  <td className="rank-cell">
                    <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                  </td>
                  <td className="player-cell">
                    {/* ✨ 核心修改：由於沒有 avatar_url，我們使用 Dicebear 根據 username 生成一個獨特的頭像 */}
                    <img 
                      src={`https://api.dicebear.com/7.x/micah/svg?seed=${user.username}`} 
                      alt={user.username} 
                      className="player-avatar"
                    />
                    {/* ✨ 核心修改：顯示 username 而不是 full_name */}
                    <span>{user.username}</span>
                  </td>
                  <td>{user.practice_count}</td>
                  <td>{`${user.average_accuracy}%`}</td>
                </tr>
               ))
            ) : (
              <tr>
                <td colSpan="4" className="no-data-cell">
                  {t('leaderboardPage.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
