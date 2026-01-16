// src/pages/TutorSignup.jsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { submitTutorApplication } from '../api/submitTutorApplication';
import LanguageSelector from '../components/LanguageSelector';
import '../styles/TutorSignup.css';

// 初始表單狀態
const initialFormState = {
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    headline: '',
    bio: '',
    yearsOfEx: ''
};

export default function TutorSignup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialFormState);
  const [status, setStatus] = useState({ loading: false, error: null, success: false });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // 每次提交時，清除狀態
    setStatus({ loading: true, error: null, success: false });

    // 密碼匹配驗證
    if (form.password !== form.confirmPassword) {
      setStatus({ loading: false, error: t('tutorSignup.passwordsNoMatch', '密碼與確認密碼不匹配，請重新輸入。'), success: false });
      return;
    }

    try {
      // 捕捉返回結果
      const result = await submitTutorApplication({
        ...form,
        yearsOfEx: form.yearsOfEx === '' ? undefined : Number(form.yearsOfEx)
      });
      
      // 檢查返回結果並處理成功狀態
      if (result && result.success) {
          // 成功後，重置表單並顯示成功訊息 (需求 2)
          setForm(initialFormState); // 重置表單
          setStatus({ loading: false, error: null, success: true }); // 顯示成功訊息
      } else {
          // 理論上不會執行，但作為防禦性編程
          setStatus({ loading: false, error: t('tutorSignup.submitAbnormal', '提交成功，但返回結果異常。'), success: false });
      }
      
    } catch (error) {
      // 處理錯誤訊息
      setStatus({ loading: false, error: error.message || t('tutorSignup.unknownError', '提交申請時發生未知錯誤。'), success: false });
    }
  };

  return (
    <div className="tutor-signup">
      <div className="tutor-signup__language-selector">
        <LanguageSelector />
      </div>
      <form className="tutor-signup__form" onSubmit={handleSubmit}>
        <h1 className="tutor-signup__title">{t('tutorSignup.title', 'Apply to Become a Tutor')}</h1>

        <label className="tutor-signup__label">
          {t('tutorSignup.email', 'Email')}
          <input
            className="tutor-signup__input"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
          />
        </label>

        <label className="tutor-signup__label">
          {t('tutorSignup.password', 'Password')}
          <input
            className="tutor-signup__input"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            required
            minLength={6}
          />
        </label>
        
        {/* 確認密碼輸入框 */}
        <label className="tutor-signup__label">
          {t('tutorSignup.confirmPassword', 'Confirm Password')}
          <input
            className="tutor-signup__input"
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            minLength={6}
          />
        </label>

        <label className="tutor-signup__label">
          {t('tutorSignup.fullName', 'Full Name')}
          <input
            className="tutor-signup__input"
            name="fullName"
            value={form.fullName}
            onChange={handleChange}
            required
          />
        </label>

        <label className="tutor-signup__label">
          {t('tutorSignup.headline', 'Professional Headline')}
          <input
            className="tutor-signup__input"
            name="headline"
            value={form.headline}
            onChange={handleChange}
          />
        </label>

        <label className="tutor-signup__label">
          {t('tutorSignup.bio', 'About You')}
          <textarea
            className="tutor-signup__textarea"
            name="bio"
            value={form.bio}
            onChange={handleChange}
            rows={4}
          />
        </label>

        <label className="tutor-signup__label">
          {t('tutorSignup.yearsOfExperience', 'Years of Experience')}
          <input
            className="tutor-signup__input"
            type="number"
            min="0"
            name="yearsOfEx"
            value={form.yearsOfEx}
            onChange={handleChange}
          />
        </label>

        <button
          className="tutor-signup__submit"
          type="submit"
          disabled={status.loading}
        >
          {status.loading ? t('tutorSignup.submitting', 'Submitting...') : t('tutorSignup.submitButton', 'Submit Application')}
        </button>

        {status.error && (
          <p className="tutor-signup__error">{status.error}</p>
        )}
        
        {/* 顯示成功訊息 */}
        {status.success && (
          <p className="tutor-signup__success">{t('tutorSignup.successMessage', '導師申請已成功提交！請檢查您的 Email 以完成註冊，並等待管理員審核。')}</p>
        )}
        
        <button
          className="tutor-signup__back-to-login"
          type="button"
          onClick={() => navigate('/login')}
        >
          {t('tutorSignup.backToLogin', 'Back to Login')}
        </button>
      </form>
    </div>
  );
}
