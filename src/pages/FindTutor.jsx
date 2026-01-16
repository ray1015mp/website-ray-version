// src/pages/FindTutor.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import '../styles/FindTutor.css';

// 獲取名字首字母
const getInitial = (name) => {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
};

// 經驗年數轉換為顯示文字
const getExperienceLabel = (years, t) => {
  if (!years) return 'N/A';
  if (years >= 5) return `5+ ${t('findTutor.yearsExp', 'years exp.')}`;
  if (years >= 3) return `3-5 ${t('findTutor.yearsExp', 'years exp.')}`;
  if (years >= 1) return `1-3 ${t('findTutor.yearsExp', 'years exp.')}`;
  return `< 1 ${t('findTutor.yearsExp', 'year exp.')}`;
};

// Tutor Card 元件
const TutorCard = ({ tutor, onViewProfile, t }) => {
  const initial = getInitial(tutor.display_name || tutor.full_name);
  const experienceLabel = getExperienceLabel(tutor.years_of_experience, t);

  return (
    <div className="tutor-card">
      <div className="tutor-card-header">
        <div className="tutor-avatar" data-initial={initial}>
          {initial}
        </div>
        <div className="tutor-info">
          <h3 className="tutor-name">{tutor.display_name || tutor.full_name}</h3>
          <p className="tutor-headline">{tutor.headline || t('findTutor.certifiedTutor', 'Certified Tutor')}</p>
        </div>
      </div>

      <div className="tutor-tags">
        {tutor.languages?.map((lang, index) => (
          <span key={index} className="tag tag-language">{lang}</span>
        ))}
        <span className="tag tag-experience">{experienceLabel}</span>
        {tutor.specialties?.map((specialty, index) => (
          <span key={index} className="tag tag-specialty">{specialty}</span>
        ))}
      </div>

      <p className="tutor-bio">
        {tutor.bio || t('findTutor.noBio', 'No bio available.')}
      </p>

      <button 
        className="btn-view-profile"
        onClick={() => onViewProfile(tutor)}
      >
        {t('findTutor.viewProfile', 'View Profile')}
      </button>
    </div>
  );
};

// Tutor Profile Modal 元件
const TutorProfileModal = ({ tutor, onClose, onSendEmail, t }) => {
  if (!tutor) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          <div className="tutor-avatar large" data-initial={getInitial(tutor.display_name || tutor.full_name)}>
            {getInitial(tutor.display_name || tutor.full_name)}
          </div>
          <div>
            <h2>{tutor.display_name || tutor.full_name}</h2>
            <p className="tutor-headline">{tutor.headline || t('findTutor.certifiedTutor', 'Certified Tutor')}</p>
          </div>
        </div>

        <div className="modal-section">
          <h3>{t('findTutor.about', 'About')}</h3>
          <p>{tutor.bio || t('findTutor.noBio', 'No bio available.')}</p>
        </div>

        <div className="modal-section">
          <h3>{t('findTutor.languages', 'Languages')}</h3>
          <div className="tutor-tags">
            {tutor.languages?.map((lang, index) => (
              <span key={index} className="tag tag-language">{lang}</span>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <h3>{t('findTutor.experience', 'Experience')}</h3>
          <p>{getExperienceLabel(tutor.years_of_experience, t)}</p>
        </div>

        {tutor.specialties?.length > 0 && (
          <div className="modal-section">
            <h3>{t('findTutor.specialties', 'Specialties')}</h3>
            <div className="tutor-tags">
              {tutor.specialties.map((specialty, index) => (
                <span key={index} className="tag tag-specialty">{specialty}</span>
              ))}
            </div>
          </div>
        )}

        <div className="modal-section tips">
          <h3>{t('findTutor.howToChoose', 'How to Choose a Tutor')}</h3>
          <ol>
            <li>{t('findTutor.tip1', "Check the tutor's specialties and years of experience.")}</li>
            <li>{t('findTutor.tip2', 'Read their bio to understand their teaching style.')}</li>
            <li>{t('findTutor.tip3', 'Use "View Profile" for more details.')}</li>
            <li>{t('findTutor.tip4', "Don't hesitate to ask questions before booking.")}</li>
          </ol>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            {t('findTutor.close', 'Close')}
          </button>
          <button className="btn-primary" onClick={() => onSendEmail(tutor)}>
            {t('findTutor.sendToEmail', 'Send to My Email')}
          </button>
        </div>
      </div>
    </div>
  );
};

// 主頁面元件
export default function FindTutor() {
  const { t } = useTranslation();
  
  // State
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTutor, setSelectedTutor] = useState(null);
  
  // Filters
  const [languageFilter, setLanguageFilter] = useState('any');
  const [experienceFilter, setExperienceFilter] = useState('any');
  const [searchQuery, setSearchQuery] = useState('');

  // 從數據庫獲取 tutors
  useEffect(() => {
    fetchTutors();
  }, []);

  const fetchTutors = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('tutors')
        .select(`
          user_id,
          full_name,
          display_name,
          email,
          status,
          certified_by
        `)
        .eq('status', 'Active');

      if (fetchError) throw fetchError;

      // 同時獲取 tutor_applications 嘅額外資料 (headline, bio, years_of_ex)
      const tutorsWithDetails = await Promise.all(
        (data || []).map(async (tutor) => {
          const { data: appData } = await supabase
            .from('tutor_applications')
            .select('headline, bio, years_of_ex')
            .eq('user_id', tutor.user_id)
            .eq('status', 'approved')
            .single();

          return {
            ...tutor,
            headline: appData?.headline || null,
            bio: appData?.bio || null,
            years_of_experience: appData?.years_of_ex || null,
            // 暫時用假數據，你可以之後加入 tutor_languages 同 tutor_specialties 表
            languages: ['English'],
            specialties: ['General'],
          };
        })
      );

      setTutors(tutorsWithDetails);
    } catch (err) {
      console.error('Error fetching tutors:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 過濾 tutors
  const filteredTutors = tutors.filter((tutor) => {
    // 名字搜索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const name = (tutor.display_name || tutor.full_name || '').toLowerCase();
      if (!name.includes(query)) return false;
    }

    // 語言過濾
    if (languageFilter !== 'any') {
      if (!tutor.languages?.includes(languageFilter)) return false;
    }

    // 經驗過濾
    if (experienceFilter !== 'any') {
      const years = tutor.years_of_experience || 0;
      switch (experienceFilter) {
        case '1-3':
          if (years < 1 || years >= 3) return false;
          break;
        case '3-5':
          if (years < 3 || years >= 5) return false;
          break;
        case '5+':
          if (years < 5) return false;
          break;
        default:
          break;
      }
    }

    return true;
  });

  // 處理 View Profile
  const handleViewProfile = (tutor) => {
    setSelectedTutor(tutor);
  };

  // 處理 Send Email
  const handleSendEmail = async (tutor) => {
    try {
      // 獲取當前用戶
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        alert('Please login to use this feature.');
        return;
      }

      // 這裡可以調用 Edge Function 發送郵件
      // 暫時用 alert 代替
      alert(`Tutor information will be sent to: ${user.email}\n\nTutor: ${tutor.display_name || tutor.full_name}\nEmail: ${tutor.email}`);
      
      setSelectedTutor(null);
    } catch (err) {
      console.error('Error sending email:', err);
      alert('Failed to send email. Please try again.');
    }
  };

  // 處理搜索
  const handleSearch = (e) => {
    e.preventDefault();
    // 搜索已經通過 filteredTutors 實現
  };

  return (
    <div className="find-tutor-page">
      <div className="find-tutor-container">
        {/* Header */}
        <div className="page-header">
          <h1>{t('findTutor.title', 'Find Your Perfect Tutor')}</h1>
        </div>

        {/* Filters */}
        <form className="filter-bar" onSubmit={handleSearch}>
          <div className="filter-group">
            <label htmlFor="language-filter">{t('findTutor.language', 'Language')}</label>
            <select
              id="language-filter"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              <option value="any">{t('findTutor.any', 'Any')}</option>
              <option value="English">English</option>
              <option value="中文">中文</option>
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="experience-filter">{t('findTutor.experience', 'Experience')}</label>
            <select
              id="experience-filter"
              value={experienceFilter}
              onChange={(e) => setExperienceFilter(e.target.value)}
            >
              <option value="any">{t('findTutor.any', 'Any')}</option>
              <option value="1-3">1-3 {t('findTutor.years', 'years')}</option>
              <option value="3-5">3-5 {t('findTutor.years', 'years')}</option>
              <option value="5+">5+ {t('findTutor.years', 'years')}</option>
            </select>
          </div>

          <div className="filter-group search-group">
            <label htmlFor="tutor-search">{t('findTutor.tutorName', 'Tutor Name')}</label>
            <div className="search-input-wrapper">
              <input
                type="text"
                id="tutor-search"
                placeholder={t('findTutor.searchPlaceholder', 'Search by name...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn-search">
                {t('findTutor.search', 'Search')}
              </button>
            </div>
          </div>
        </form>

        {/* Content */}
        <div className="tutor-list-section">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>{t('common.loading', 'Loading...')}</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p>{t('common.error', 'Error')}: {error}</p>
              <button onClick={fetchTutors} className="btn-retry">
                {t('findTutor.retry', 'Retry')}
              </button>
            </div>
          ) : filteredTutors.length === 0 ? (
            <div className="empty-state">
              <p>{t('findTutor.noResults', 'No tutors found matching your criteria.')}</p>
            </div>
          ) : (
            <div className="tutor-grid">
              {filteredTutors.map((tutor) => (
                <TutorCard
                  key={tutor.user_id}
                  tutor={tutor}
                  onViewProfile={handleViewProfile}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profile Modal */}
      {selectedTutor && (
        <TutorProfileModal
          tutor={selectedTutor}
          onClose={() => setSelectedTutor(null)}
          onSendEmail={handleSendEmail}
          t={t}
        />
      )}
    </div>
  );
}