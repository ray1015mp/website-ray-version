// src/components/TrainingPlanModal.jsx (Upgraded to a Page Component)

import React from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getActiveTrainingPlan } from '../api/supabaseAPI'; // 確保 API 函式已引入
import Loader from '../components/Loader'; // 假設您有 Loader 元件
import '../styles/TrainingPlanModal.css'; // 確保引入了 CSS

// ✨ 核心修改：不再接收 props，而是自己獲取資料
const TrainingPlanPage = () => {
  const { t } = useTranslation();
  const session = useSession();
  const userId = session?.user?.id;

  // ✨ 使用 useQuery 來獲取訓練計畫資料
  const { data: planData, isLoading, isError } = useQuery({
    queryKey: ['trainingPlan', userId],
    queryFn: () => getActiveTrainingPlan(userId),
    enabled: !!userId, // 只有在 userId 存在時才執行查詢
  });

  // --- 狀態處理 ---

  if (isLoading) {
    // 使用 main-content class 來確保佈局居中
    return <div className="main-content" style={{ textAlign: 'center' }}><Loader /></div>;
  }

  if (isError || !planData || !planData.plan_data || !planData.plan_data.weeks) {
    return (
      <div className="main-content" style={{ textAlign: 'center' }}>
        <h2>{t('trainingPlan.noPlan', '找不到有效的訓練計畫')}</h2>
        <p>{t('trainingPlan.noPlanDesc', '您可能尚未完成初始能力測試，或者計畫資料已過期。')}</p>
      </div>
    );
  }

  // --- 資料解構 ---
  const { weeks } = planData.plan_data;

  // --- 渲染 UI ---
  // 我們不再需要 modal-overlay，因為它現在是頁面主體
  return (
    <div className="main-content" style={{ maxWidth: '600px', margin: '2rem auto' }}>
      <div className="modal-header" style={{ marginBottom: '2rem' }}>
        <h2>{t('trainingPlan.title', '我的專屬訓練行程')}</h2>
        <p>{t('trainingPlan.generatedAt', '根據您在 {{date}} 的測試結果生成。', { date: new Date(planData.generated_at).toLocaleDateString() })}</p>
      </div>

      <div className="plan-body">
        {weeks.map((item) => (
          <div key={item.week} className="week-card">
            <div className="week-number">{t('trainingPlan.week', 'Week')} {item.week}</div>
            <div className="week-details">
              <div className="week-focus">{item.focus}</div>
              <div className="week-goal">{item.goal}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="modal-footer" style={{ marginTop: '2rem' }}>
        <p>{t('trainingPlan.encouragement', '堅持練習，你會看到自己的進步！')}</p>
      </div>
    </div>
  );
};

export default TrainingPlanPage;
