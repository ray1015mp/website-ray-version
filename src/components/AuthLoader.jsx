import React, { useState, useEffect } from 'react';
import { useSession } from '@supabase/auth-helpers-react';

const FullScreenLoader = () => (
  <div style={{
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--background-light)',
    zIndex: 9999,
  }}>
    <div style={{ fontSize: '1.5rem', color: 'var(--text-medium)', fontWeight: '600' }}>
      Loading Application...
    </div>
  </div>
);

export const AuthLoader = ({ children }) => {
  const session = useSession();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // `useSession()` 的值從 undefined 變為 null 或 session 物件時，
    // 代表 Supabase 的初始化檢查已經完成。
    if (session !== undefined) {
      // 我們可以設置一個最小的載入時間，例如 500 毫秒，以避免畫面閃爍
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500); // <-- 這裡就是您要的 0.5 秒凍結效果

      return () => clearTimeout(timer);
    }
  }, [session]);

  // 如果正在載入，則始終顯示全螢幕載入器
  if (isLoading) {
    return <FullScreenLoader />;
  }

  // 載入完成後，渲染真正的應用程式內容
  return <>{children}</>;
};
