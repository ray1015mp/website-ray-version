import React from 'react';
import { useTranslation } from 'react-i18next'; // 1. 引入 useTranslation hook
import '../styles/App.css'; // 使用共享的應用程式樣式

const LanguageSelector = () => {
  // 2. 從 hook 中取得 i18n 實例
  const { i18n } = useTranslation();

  // 3. 語言變更的處理函數
  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang); // 呼叫 i18next 的函式來切換語言
  };

  return (
    <div className="language-selector-container">
      <button
        // 4. 根據 i18n.language 來判斷哪個按鈕是 active
        className={`lang-btn ${i18n.language === 'zh' ? 'active' : ''}`}
        onClick={() => handleLanguageChange('zh')}
      >
        中文
      </button>
      <button
        className={`lang-btn ${i18n.language.startsWith('en') ? 'active' : ''}`}
        onClick={() => handleLanguageChange('en')}
      >
        English
      </button>
    </div>
  );
};

export default LanguageSelector;
