import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// 引入您的語言資源檔
import translationEN from './locales/en/translation.json';
import translationZH from './locales/zh/translation.json';

const resources = {
  en: {
    translation: translationEN
  },
  zh: {
    translation: translationZH
  }
};

i18n
  .use(initReactI18next) // 將 i18n 實例傳遞給 react-i18next
  .init({
    resources, // 語言資源
    lng: 'en', // 預設語言
    fallbackLng: 'en', // 如果當前語言沒有對應的翻譯，則使用的備用語言
    interpolation: {
      escapeValue: false // React 已經會處理 XSS，所以設定為 false
    }
  });

export default i18n;
