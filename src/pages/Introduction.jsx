// src/pages/Introduction.jsx (The final, structurally correct version)

import React from 'react';
import { useTranslation } from 'react-i18next';
import '../styles/Introduction.css';
import '../styles/Layout.css';

// --- ✨ 核心修正: 讓這個元件渲染出一個 <span>，而不是 <div> ✨ ---
// <span> 是行內元素，可以被合法地放置在 <p> 或 <li> 標籤內部。
const DangerousHTML = ({ html }) => {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

function Introduction() {
  const { t } = useTranslation();

  return (
    <main className="main-content width-intro">
      <h1 className="page-title">{t('introductionPage.title')}</h1>

      <div className="content-section">
        <h2>
          <span className="icon">🎯</span>
          {t('introductionPage.whatIsTitle')}
        </h2>
        <p>{t('introductionPage.whatIsText')}</p>
      </div>

      <div className="content-section">
        <h2>
          <span className="icon">🚀</span>
          {t('introductionPage.howToUseTitle')}
        </h2>
        <p>{t('introductionPage.howToUseText')}</p>
        <ul>
          {/* 現在，這裡的結構是 <li><span>...</span></li>，完全合法 */}
          <li><DangerousHTML html={t('introductionPage.step1')} /></li>
          <li><DangerousHTML html={t('introductionPage.step2')} /></li>
          <li><DangerousHTML html={t('introductionPage.step3')} /></li>
        </ul>
      </div>

      <div className="content-section">
        <h2>
          <span className="icon">📊</span>
          {t('introductionPage.trackProgressTitle')}
        </h2>
        {/* 現在，這裡的結構是 <p><span>...</span></p>，完全合法 */}
        <p><DangerousHTML html={t('introductionPage.trackProgressText')} /></p>
      </div>
    </main>
  );
}

export default Introduction;
