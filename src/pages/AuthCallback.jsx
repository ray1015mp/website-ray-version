import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// 這個組件沒有 UI，只處理邏輯
export default function AuthCallback() {
  const navigate = useNavigate();
  const supabaseClient = useSupabaseClient();
  const [message, setMessage] = useState('Verifying authentication...');

  useEffect(() => {
    // onAuthStateChange 會在 Supabase 處理完 URL hash 後觸發
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      // 無論是登入、註冊確認還是密碼重置，只要 session 存在，就導航到主頁
      // Supabase Auth Helpers 會觸發 App.jsx 中的另一個 onAuthStateChange 來處理 PASSWORD_RECOVERY UI
      if (session) {
        // 檢查用戶角色
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        // 如果是待審核的導師，登出並導航到登入頁面
        if (profile?.role === 'tutor_pending') {
          setMessage('Email verified! Your tutor application is pending admin approval. Please wait for approval before logging in.');
          await supabaseClient.auth.signOut();
          
          // 延遲3秒後導航到登入頁面
          setTimeout(() => {
            subscription.unsubscribe();
            navigate('/login');
          }, 3000);
        } else {
          // 其他用戶正常導航
          subscription.unsubscribe();
          navigate('/introduction');
        }
      }
    });

    return () => {
      // 組件卸載時也取消訂閱
      subscription.unsubscribe();
    };
  }, [supabaseClient, navigate]);

  // 顯示一個全局的加載指示器
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontSize: '1.5rem',
      fontWeight: 'bold',
      textAlign: 'center',
      padding: '2rem'
    }}>
      {message}
    </div>
  );
}
