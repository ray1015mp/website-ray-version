// src/components/ResetPassword.jsx (Standalone Page Style)

import React, { useState } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import Loader from './Loader';
import Message from './Message';
// 我們將直接在這裡定義樣式，而不是依賴 Login.css，以實現更好的隔離
// import '../styles/Login.css'; 

// ✨ 1. 為組件定義自己的樣式，使其像一個獨立的頁面
const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(248, 250, 252, 0.95)', // 使用一個幾乎不透明的背景
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
};

const containerStyle = {
  width: '100%',
  maxWidth: '26rem',
  backgroundColor: '#ffffff',
  padding: '2.5rem',
  borderRadius: '0.75rem',
  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
  textAlign: 'center',
};

const headerStyle = {
  marginBottom: '2rem',
};

const h1Style = {
  fontSize: '1.875rem',
  fontWeight: '700',
  color: '#1e293b',
  marginBottom: '0.5rem',
};

const pStyle = {
  color: '#64748b',
};

const formStyle = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};

const inputGroupStyle = {
  textAlign: 'left',
};

const labelStyle = {
  display: 'block',
  fontWeight: '500',
  marginBottom: '0.5rem',
  color: '#475569',
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem 1rem',
  border: '1px solid #cbd5e1',
  borderRadius: '0.375rem',
  fontSize: '1rem',
};

const buttonStyle = {
  width: '100%',
  backgroundColor: '#4f46e5',
  color: '#ffffff',
  padding: '0.875rem',
  border: 'none',
  borderRadius: '0.375rem',
  fontSize: '1rem',
  fontWeight: '600',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  minHeight: '44px',
};


export default function ResetPassword({ onPasswordUpdated }) {
  const supabaseClient = useSupabaseClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }
    if (password.length < 6) {
      setMessage({ text: 'Password should be at least 6 characters.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage({ text: '', type: '' });

    const { error } = await supabaseClient.auth.updateUser({ password: password });

    if (error) {
      setMessage({ text: `Error: ${error.message}`, type: 'error' });
      setLoading(false);
    } else {
      setMessage({ text: 'Your password has been updated successfully! You will be logged out.', type: 'success' });
      // ✨ 2. 密碼更新成功後，調用父組件的回調來觸發登出
      setTimeout(() => {
        onPasswordUpdated();
      }, 2500); // 延長時間讓用戶能看清消息
    }
    // 注意：成功後我們不再設置 setLoading(false)，因為頁面即將被銷毀
  };

  return (
    <div style={overlayStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h1 style={h1Style}>Reset Your Password</h1>
          <p style={pStyle}>Enter your new password below.</p>
        </div>
        {message.text && <Message text={message.text} type={message.type} />}
        <form style={formStyle} onSubmit={handleFormSubmit}>
          <div style={inputGroupStyle}>
            <label htmlFor="password" style={labelStyle}>New Password</label>
            <input
              type="password"
              id="password"
              name="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={inputGroupStyle}>
            <label htmlFor="confirm-password" style={labelStyle}>Confirm New Password</label>
            <input
              type="password"
              id="confirm-password"
              name="confirm-password"
              placeholder="••••••••"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? <Loader /> : <span>Update Password</span>}
          </button>
        </form>
      </div>
    </div>
  );
}
