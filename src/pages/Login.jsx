// src/pages/Login.jsx
import React, { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Silk from '../components/Silk';
import GradientText from '../components/GradientText';
import LanguageSelector from '../components/LanguageSelector';
import '../styles/Login.css';

const Loader = () => <div className="loader"></div>;

export default function Login() { 
  const { t } = useTranslation();
  const supabase = useSupabaseClient();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setMessage({ text: '', type: '' });
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setMessage({ text: '', type: '' });
    
    if (!isLoginMode && password !== confirmPassword) {
      setMessage({ text: t('login.passwordsNoMatch', 'Passwords do not match.'), type: 'error' });
      return;
    }

    setLoading(true);

    try {
      if (isLoginMode) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: password,
        });
        if (error) throw error;

        // ✨ 新增檢查: 如果登入成功，檢查用戶角色
        if (data.user) {
          // 直接在 Login.jsx 中查詢 profiles 表以獲取角色
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

          if (profileError) throw profileError;

          if (profileData && profileData.role === 'tutor_pending') {
            const errorMessage = t('login.tutorPending', 'Your tutor application is under review. Please wait for admin approval.');
            
            // ✨ 關鍵修正：使用原生 alert 確保訊息被看到
            alert(errorMessage); 
            
            // 立即登出，這會觸發頁面重定向/重新載入
            await supabase.auth.signOut();
            
            // 由於 alert 已經顯示了訊息，我們在這裡拋出一個空錯誤
            // 或者直接 return，讓 finally 區塊執行 setLoading(false)
            return; 
          }
        }
      } else {
        // 學生註冊邏輯保持不變
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          // ✨ 您可以在這裡為學生的 metadata 預設一個 role
          // options: {
          //   data: {
          //     role: 'student' 
          //   }
          // }
        });
        if (error) throw error;
        setMessage({ text: t('login.accountCreated', 'Account created! Please check your email for verification.'), type: 'success' });
        setIsLoginMode(true);
      }
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="background-layer"><Silk /></div>
      <div className="content-layer">
        <div className="login-language-selector">
          <LanguageSelector />
        </div>
        <div className="login-content-wrapper">
          <h1 className="login-page-title">
            <GradientText colors={["#4f46e5", "#7C3AED", "#3B82F6", "#4f46e5"]} animationSpeed={6}>
              TheraLingua AI
            </GradientText>
          </h1>
          <div className="auth-container">
            {message.text && <div className={`message ${message.type}`}>{message.text}</div>}
            <div className="auth-header">
              <h1>{isLoginMode ? t('login.welcomeBack', 'Welcome Back!') : t('login.createAccount', 'Create a Student Account')}</h1>
              <p>{isLoginMode ? t('login.signInSubtitle', 'Sign in to access the TheraLingua AI platform.') : t('login.signUpSubtitle', 'Get started with TheraLingua AI today.')}</p>
            </div>
            <form id="auth-form" className="auth-form" onSubmit={handleFormSubmit}>
              <div className="input-group">
                <label htmlFor="email">{t('login.email', 'Email Address')}</label>
                <input type="email" id="email" name="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="input-group">
                <label htmlFor="password">{t('login.password', 'Password')}</label>
                <input type="password" id="password" name="password" placeholder="••••••••" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {!isLoginMode && (
                <div id="confirm-password-group" className="input-group">
                  <label htmlFor="confirm-password">{t('login.confirmPassword', 'Confirm Password')}</label>
                  <input type="password" id="confirm-password" name="confirm-password" placeholder="••••••••" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              )}
              <button type="submit" id="submit-button" className="submit-btn" disabled={loading}>
                {loading ? <Loader /> : <span>{isLoginMode ? t('login.signIn', 'Sign In') : t('login.signUp', 'Sign Up')}</span>}
              </button>
            </form>
            <div className="auth-footer">
              <p>
                {isLoginMode ? t('login.noAccount', "Don't have an account? ") : t('login.hasAccount', 'Already have an account? ')}
                <a onClick={toggleMode} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
                  {isLoginMode ? t('login.signUp', 'Sign Up') : t('login.signIn', 'Sign In')}
                </a>
              </p>
              
              {/* ====================================================== */}
              {/* == ✨ 2. 新增的導師註冊入口 ✨ == */}
              {/* ====================================================== */}
              {!isLoginMode && (
                <p className="tutor-signup-link">
                  {t('login.areTutor', 'Are you a tutor?')}{' '}
                  <Link to="/tutor-signup">
                    {t('login.registerHere', 'Register here.')}
                  </Link>
                </p>
              )}
              {/* ====================================================== */}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
