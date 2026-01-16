// src/index.js

import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './i18n';

// ✨ 核心修改：在創建 QueryClient 時，設定全局預設值 ✨
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 禁用窗口聚焦時自動重新獲取數據
      // 這將解決切換分頁時自動換詞的問題
      refetchOnWindowFocus: false, 
      
      // 其他推薦的預設值
      staleTime: 1000 * 60 * 5, // 5 分鐘內數據視為新鮮
      retry: 1, // 失敗後重試 1 次
    },
  },
});

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
