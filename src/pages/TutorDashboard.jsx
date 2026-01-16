// src/pages/TutorDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@supabase/auth-helpers-react';
import { supabase } from '../supabaseClient';
import '../styles/TutorDashboard.css';

// ===== 工具函數 (放喺 component 外面) =====
const getInitial = (name) => {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-CA');
};

// ✨ 將呢個函數移到 component 外面
const calculatePlanProgress = (planData) => {
  if (!planData) {
    return { progress: 0, currentWeek: 1, completedWeeks: 0, totalWeeks: 0 };
  }

  let weeks = [];

  // Parse plan_data
  if (typeof planData === 'string') {
    try {
      const parsed = JSON.parse(planData);
      weeks = parsed.weeks || parsed || [];
    } catch (e) {
      console.error('Failed to parse plan_data:', e);
      return { progress: 0, currentWeek: 1, completedWeeks: 0, totalWeeks: 0 };
    }
  } else if (planData.weeks) {
    weeks = planData.weeks;
  } else if (Array.isArray(planData)) {
    weeks = planData;
  }

  if (!Array.isArray(weeks) || weeks.length === 0) {
    return { progress: 0, currentWeek: 1, completedWeeks: 0, totalWeeks: 0 };
  }

  const totalWeeks = weeks.length;
  const completedWeeks = weeks.filter(w => w.completed === true).length;
  const progress = Math.round((completedWeeks / totalWeeks) * 100);

  let currentWeek = 1;
  for (let i = 0; i < weeks.length; i++) {
    if (!weeks[i].completed) {
      currentWeek = weeks[i].week || i + 1;
      break;
    }
    if (i === weeks.length - 1) {
      currentWeek = weeks[i].week || weeks.length;
    }
  }

  return { progress, currentWeek, completedWeeks, totalWeeks };
};

// ===== 子元件：Student Card =====
const StudentCard = ({ student, onViewRecords, onRemove, onRegeneratePlan, onGetAIReport }) => {
  const progress = student.plan_progress || 0;
  const currentWeek = student.current_week || 1;
  const completedWeeks = student.completed_weeks || 0;
  const totalWeeks = student.total_weeks || 4;
  const hasPlan = student.has_plan;

  return (
    <div className="student-card">
      <div className="student-header">
        <div className="student-avatar">
          {student.username?.charAt(0).toUpperCase() || '?'}
        </div>
        <div className="student-info">
          <h3>{student.username || 'Unknown Student'}</h3>
          <p>Current Level: <strong>{student.sug_lvl || 'N/A'}</strong></p>
          
          {/* ✨ Plan Progress */}
          <div className="plan-progress">
            {hasPlan ? (
              <>
                <span className="progress-label">
                  Plan Progress (Week {currentWeek}) - {completedWeeks}/{totalWeeks} completed
                </span>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <span className="progress-percentage">{progress}%</span>
              </>
            ) : (
              <span className="no-plan-label">No active plan</span>
            )}
          </div>
        </div>
      </div>
      
      <div className="student-actions">
        <button 
          className="btn-action btn-view"
          onClick={() => onViewRecords(student)}
        >
          View Records
        </button>
        <button 
          className="btn-action btn-remove"
          onClick={() => onRemove(student)}
        >
          Remove
        </button>
        <button 
          className="btn-action btn-regenerate"
          onClick={() => onRegeneratePlan(student)}
        >
          AI Regenerate Plan
        </button>
        <button 
          className="btn-action btn-report"
          onClick={() => onGetAIReport(student)}
        >
          Get AI Report
        </button>
      </div>
    </div>
  );
};

// ===== 子元件：Edit Profile Modal =====
const EditProfileModal = ({ tutor, onClose, onSave }) => {
  const [headline, setHeadline] = useState(tutor?.headline || '');
  const [philosophy, setPhilosophy] = useState(tutor?.philosophy || '');
  const [certifications, setCertifications] = useState(tutor?.certifications || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ headline, philosophy, certifications });
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Edit Public Profile</h2>

        <div className="form-group">
          <label>Headline</label>
          <input
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="e.g., Certified Speech-Language Pathologist"
          />
        </div>

        <div className="form-group">
          <label>Teaching Philosophy</label>
          <textarea
            value={philosophy}
            onChange={(e) => setPhilosophy(e.target.value)}
            placeholder="I believe in creating a supportive and engaging environment..."
            rows={4}
          />
        </div>

        <div className="form-group">
          <label>Certifications (one per line)</label>
          <textarea
            value={certifications}
            onChange={(e) => setCertifications(e.target.value)}
            placeholder="Certificate of Clinical Competence..."
            rows={4}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== 子元件：View Records Modal =====
const RecordsModal = ({ student, records, onClose }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Records - {student?.username}</h2>

        {records.length === 0 ? (
          <p className="no-data">No practice records found.</p>
        ) : (
          <div className="records-table-wrapper">
            <table className="records-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Word</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr key={index}>
                    <td>{formatDate(record.created_at)}</td>
                    <td>{record.target_word}</td>
                    <td>{record.error_rate != null ? `${(100 - record.error_rate * 100).toFixed(0)}%` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ===== 子元件：AI Report Modal =====
const AIReportModal = ({ student, report, loading, onClose }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>AI Student Report - {student?.username}</h2>

        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Generating AI Report...</p>
          </div>
        ) : report ? (
          <>
            <div className="report-section">
              <h3>Primary Pronunciation Issues</h3>
              <ul>
                {report.issues?.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
            </div>

            <div className="report-section">
              <h3>Suggested Training Focus</h3>
              <ul>
                {report.suggestions?.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="no-data">Unable to generate report. Please try again.</p>
        )}

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ===== 子元件：Regenerate Plan Modal =====
const RegeneratePlanModal = ({ student, currentPlan, onClose, onRegenerate }) => {
  const [instructions, setInstructions] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [displayPlan, setDisplayPlan] = useState(currentPlan);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    setDisplayPlan(currentPlan);
  }, [currentPlan]);

  // Loading steps 動畫
  useEffect(() => {
    if (regenerating) {
      const interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % 3);
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setLoadingStep(0);
    }
  }, [regenerating]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    const newPlan = await onRegenerate(instructions);
    setRegenerating(false);
    
    if (newPlan) {
      setDisplayPlan(newPlan);
      setInstructions('');  // ✨ 重置輸入框
    }
  };

  const getPlanWeeks = () => {
    if (!displayPlan?.plan_data) return null;
    
    let planData = displayPlan.plan_data;
    
    if (typeof planData === 'string') {
      try {
        planData = JSON.parse(planData);
      } catch (e) {
        console.error('Failed to parse plan_data:', e);
        return null;
      }
    }
    
    if (planData.weeks && Array.isArray(planData.weeks)) {
      return planData.weeks;
    }
    
    if (Array.isArray(planData)) {
      return planData;
    }
    
    return null;
  };

  const planWeeks = getPlanWeeks();

  const loadingSteps = [
    { icon: '📊', text: 'Analyzing student data' },
    { icon: '🎯', text: 'Identifying weak areas' },
    { icon: '📝', text: 'Creating personalized plan' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>AI Regenerate Plan - {student?.username}</h2>

        <div className="current-plan-section">
          <h3>Current Plan</h3>
          
          {regenerating ? (
            /* ✨ AI Loading 動畫 */
            <div className="ai-loading-container">
              {/* Brain Animation */}
              <div className="ai-brain-wrapper">
                <div className="ai-brain-pulse"></div>
                <div className="ai-brain-pulse delay-1"></div>
                <div className="ai-brain-pulse delay-2"></div>
                <div className="ai-brain-icon">🧠</div>
              </div>

              {/* Loading Text */}
              <div className="ai-loading-text">
                <span>AI is generating your plan</span>
                <span className="loading-dots-animated">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>

              {/* Progress Bar */}
              <div className="ai-progress-bar">
                <div className="ai-progress-fill"></div>
              </div>

              {/* Steps */}
              <div className="ai-loading-steps">
                {loadingSteps.map((step, index) => (
                  <div 
                    key={index} 
                    className={`ai-step ${index <= loadingStep ? 'active' : ''} ${index === loadingStep ? 'current' : ''}`}
                  >
                    <span className="ai-step-icon">{step.icon}</span>
                    <span className="ai-step-text">{step.text}</span>
                    {index < loadingStep && <span className="ai-step-check">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : planWeeks && planWeeks.length > 0 ? (
            <div className="plan-weeks">
              {planWeeks.map((week, index) => (
                <div key={index} className={`plan-week ${week.completed ? 'completed' : ''}`}>
                  {/* Week Label */}
                  <span className="week-label">Week {week.week || index + 1}</span>
                  
                  {/* Week Content */}
                  <div className="week-content">
                    <div className="week-header">
                      <strong>{week.focus}</strong>
                      {week.completed && <span className="completed-badge">✓ Completed</span>}
                    </div>
                    <p>{week.goal}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No current plan found.</p>
          )}
        </div>

        <div className="form-group">
          <label>Your Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Enter any specific instructions for the AI to consider when regenerating the plan..."
            rows={4}
            disabled={regenerating}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={regenerating}>
            Cancel
          </button>
          <button 
            className="btn-primary btn-ai" 
            onClick={handleRegenerate} 
            disabled={regenerating}
          >
            {regenerating ? (
              <>
                <span className="btn-spinner"></span>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <span>✨</span>
                <span>Regenerate with AI</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== 子元件：Add Student Modal =====
const AddStudentModal = ({ onClose, onAdd, searchResults, onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    await onSearch(searchQuery);
    setSearching(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h2>Add Student</h2>

        {/* 搜索框同按鈕同一行 */}
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for a student by name..."
            className="search-input-full"
          />
          <button type="submit" className="btn-search" disabled={searching}>
            {searching ? '...' : 'Search'}
          </button>
        </form>

        {/* 搜索結果 */}
        <div className="search-results">
          {searchResults.length === 0 ? (
            <p className="no-data">No students found.</p>
          ) : (
            searchResults.map((user) => (
              <div key={user.id} className="search-result-item">
                <div className="result-avatar">
                  {user.username?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="result-info">
                  <strong>{user.username}</strong>
                  <span>Level: {user.settings?.sug_lvl || 'Not set'}</span>
                </div>
                <button 
                  className="btn-add-small"
                  onClick={() => onAdd(user)}
                >
                  Add
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ===== 子元件：Confirm Modal =====
const ConfirmModal = ({ title, message, onConfirm, onCancel, loading }) => {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <h2>{title || 'Confirm Action'}</h2>
        <p>{message || 'Are you sure?'}</p>
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== 主元件 =====
export default function TutorDashboard() {
  const { t } = useTranslation();
  const session = useSession();
  const tutorId = session?.user?.id;

  // ===== State =====
  const [tutorProfile, setTutorProfile] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal States
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const [showAIReport, setShowAIReport] = useState(false);
  const [showRegeneratePlan, setShowRegeneratePlan] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Selected Data
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentRecords, setStudentRecords] = useState([]);
  const [aiReport, setAiReport] = useState(null);
  const [aiReportLoading, setAiReportLoading] = useState(false);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [confirmAction, setConfirmAction] = useState(null);

  // ===== 載入數據 =====
  const loadDashboardData = useCallback(async () => {
    if (!tutorId) {
      console.log('❌ No tutor ID!');
      setLoading(false);
      return;
    }

    console.log('🔄 Loading dashboard for tutor:', tutorId);
    setLoading(true);
    setError(null);

    try {
      // 1. 獲取 Tutor Profile
      const { data: tutorData, error: tutorError } = await supabase
        .from('tutors')
        .select('*')
        .eq('user_id', tutorId)
        .single();

      if (tutorError && tutorError.code !== 'PGRST116') {
        console.error('Tutor fetch error:', tutorError);
      }

      const { data: appData } = await supabase
        .from('tutor_applications')
        .select('headline, bio')
        .eq('user_id', tutorId)
        .eq('status', 'approved')
        .single();

      setTutorProfile({
        ...tutorData,
        headline: appData?.headline || tutorData?.headline,
        philosophy: appData?.bio || '',
      });

      // 2. 獲取 tutor_students
      const { data: tutorStudentsData, error: tutorStudentsError } = await supabase
        .from('tutor_students')
        .select('student_id, created_at')
        .eq('tutor_id', tutorId);

      console.log('tutor_students:', tutorStudentsData);

      if (tutorStudentsError) {
        console.error('tutor_students error:', tutorStudentsError);
        setStudents([]);
        setLoading(false);
        return;
      }

      if (!tutorStudentsData || tutorStudentsData.length === 0) {
        console.log('No students found');
        setStudents([]);
        setLoading(false);
        return;
      }

      // 3. 獲取 student profiles
      const studentIds = tutorStudentsData.map(ts => ts.student_id);
      console.log('Student IDs:', studentIds);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, role')
        .in('id', studentIds);

      if (profilesError) {
        console.error('Profiles error:', profilesError);
        setStudents([]);
        setLoading(false);
        return;
      }

      // 4. 獲取 user_settings
      const { data: settingsData } = await supabase
        .from('user_settings')
        .select('user_id, sug_lvl, language')
        .in('user_id', studentIds);

      // 5. 獲取 training_plans
      const { data: plansData } = await supabase
        .from('training_plans')
        .select('user_id, plan_data, is_active')
        .in('user_id', studentIds)
        .eq('is_active', true);

      console.log('Plans data:', plansData);

      // 6. 合併數據
      const formattedStudents = (profilesData || []).map((profile) => {
        const settings = settingsData?.find(s => s.user_id === profile.id);
        const tutorStudent = tutorStudentsData.find(ts => ts.student_id === profile.id);
        const plan = plansData?.find(p => p.user_id === profile.id);

        const planProgress = calculatePlanProgress(plan?.plan_data);

        return {
          id: profile.id,
          username: profile.username || 'Unknown',
          sug_lvl: settings?.sug_lvl || 'N/A',
          language: settings?.language || 'en',
          created_at: tutorStudent?.created_at,
          plan_progress: planProgress.progress,
          current_week: planProgress.currentWeek,
          completed_weeks: planProgress.completedWeeks,
          total_weeks: planProgress.totalWeeks,
          has_plan: !!plan,
        };
      });

      console.log('✅ Final students:', formattedStudents);
      setStudents(formattedStudents);

    } catch (err) {
      console.error('💥 Error loading dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tutorId]);

  // ===== useEffect =====
  useEffect(() => {
    if (tutorId) {
      loadDashboardData();
    }
  }, [tutorId, loadDashboardData]);

// ✨ 計算 Plan Progress 嘅 helper function
const calculatePlanProgress = (planData) => {
  if (!planData) {
    return { progress: 0, currentWeek: 1, completedWeeks: 0, totalWeeks: 0 };
  }

  let weeks = [];

  // Parse plan_data
  if (typeof planData === 'string') {
    try {
      const parsed = JSON.parse(planData);
      weeks = parsed.weeks || parsed || [];
    } catch (e) {
      console.error('Failed to parse plan_data:', e);
      return { progress: 0, currentWeek: 1, completedWeeks: 0, totalWeeks: 0 };
    }
  } else if (planData.weeks) {
    weeks = planData.weeks;
  } else if (Array.isArray(planData)) {
    weeks = planData;
  }

  if (!Array.isArray(weeks) || weeks.length === 0) {
    return { progress: 0, currentWeek: 1, completedWeeks: 0, totalWeeks: 0 };
  }

  const totalWeeks = weeks.length;
  const completedWeeks = weeks.filter(w => w.completed === true).length;
  const progress = Math.round((completedWeeks / totalWeeks) * 100);

  // 找出當前週數 (第一個未完成嘅週)
  let currentWeek = 1;
  for (let i = 0; i < weeks.length; i++) {
    if (!weeks[i].completed) {
      currentWeek = weeks[i].week || i + 1;
      break;
    }
    // 如果全部完成，顯示最後一週
    if (i === weeks.length - 1) {
      currentWeek = weeks[i].week || weeks.length;
    }
  }

  return { progress, currentWeek, completedWeeks, totalWeeks };
};

  // ===== 處理函數 =====

  // 編輯 Profile
  const handleSaveProfile = async (profileData) => {
    try {
      const { error } = await supabase
        .from('tutors')
        .update({
          headline: profileData.headline,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', tutorId);

      if (error) throw error;

      // 更新 bio in tutor_applications
      await supabase
        .from('tutor_applications')
        .update({
          headline: profileData.headline,
          bio: profileData.philosophy,
        })
        .eq('user_id', tutorId);

      setTutorProfile((prev) => ({
        ...prev,
        ...profileData,
      }));

      setShowEditProfile(false);
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Failed to save profile: ' + err.message);
    }
  };

  // 搜索學生
  const handleSearchStudents = async (query) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          username,
          role,
          settings:user_settings(sug_lvl)
        `)
        .ilike('username', `%${query}%`)
        .eq('role', 'student')
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching students:', err);
      setSearchResults([]);
    }
  };

  // 添加學生
  const handleAddStudent = async (student) => {
    try {
      const { error } = await supabase
        .from('tutor_students')
        .insert({
          tutor_id: tutorId,
          student_id: student.id,
        });

      if (error) {
        if (error.code === '23505') {
          alert('This student is already in your list.');
          return;
        }
        throw error;
      }

      setShowAddStudent(false);
      setSearchResults([]);
      loadDashboardData();
      alert('Student added successfully!');
    } catch (err) {
      console.error('Error adding student:', err);
      alert('Failed to add student: ' + err.message);
    }
  };

  // 查看記錄
  const handleViewRecords = async (student) => {
    setSelectedStudent(student);
    setShowRecords(true);

    try {
      const { data, error } = await supabase
        .from('practice_sessions')
        .select('created_at, target_word, error_rate')
        .eq('user_id', student.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setStudentRecords(data || []);
    } catch (err) {
      console.error('Error fetching records:', err);
      setStudentRecords([]);
    }
  };

  // 移除學生
  const handleRemoveStudent = (student) => {
    setSelectedStudent(student);
    setConfirmAction(() => async () => {
      try {
        const { error } = await supabase
          .from('tutor_students')
          .delete()
          .eq('tutor_id', tutorId)
          .eq('student_id', student.id);

        if (error) throw error;

        setShowConfirm(false);
        loadDashboardData();
        alert('Student removed successfully!');
      } catch (err) {
        console.error('Error removing student:', err);
        alert('Failed to remove student: ' + err.message);
      }
    });
    setShowConfirm(true);
  };

  // 獲取 AI Report
  const handleGetAIReport = async (student) => {
    setSelectedStudent(student);
    setShowAIReport(true);
    setAiReportLoading(true);
    setAiReport(null);

    try {
      // 調用 Edge Function 生成報告
      const { data, error } = await supabase.functions.invoke('generate-student-report', {
        body: { studentId: student.id },
      });

      if (error) throw error;

      setAiReport(data || {
        issues: [
          "Difficulty distinguishing between long vowel /i:/ and short vowel /ɪ/.",
          "Inconsistent pronunciation of the 'th' sound /θ/.",
        ],
        suggestions: [
          "Minimal pair exercises for /i:/ vs /ɪ/.",
          "Targeted practice on words starting with 'th'.",
        ],
      });
    } catch (err) {
      console.error('Error generating AI report:', err);
      // 使用假數據作為 fallback
      setAiReport({
        issues: [
          "Difficulty distinguishing between long vowel /i:/ and short vowel /ɪ/. (demo data)",
          "Inconsistent pronunciation of the 'th' sound /θ/. (demo data)",
        ],
        suggestions: [
          "Minimal pair exercises for /i:/ vs /ɪ/. (demo data)",
          "Targeted practice on words starting with 'th'. (demo data)",
        ],
      });
    } finally {
      setAiReportLoading(false);
    }
  };

  // 重新生成計劃
  const handleRegeneratePlan = async (student) => {
    setSelectedStudent(student);
    
    // 獲取當前計劃
    try {
      const { data } = await supabase
        .from('training_plans')
        .select('*')
        .eq('user_id', student.id)
        .eq('is_active', true)
        .single();

      setCurrentPlan(data);
    } catch (err) {
      console.warn('No current plan found');
      setCurrentPlan(null);
    }

    setShowRegeneratePlan(true);
  };

 const handleDoRegeneratePlan = async (instructions) => {
  try {
    const { data, error } = await supabase.functions.invoke('regenerate-training-plan', {
      body: {
        studentId: selectedStudent.id,
        tutorId: tutorId,
        instructions: instructions,
      },
    });

    console.log('Regenerate result:', data);

    if (error) throw error;

    if (data?.plan) {
      setCurrentPlan(data.plan);
      
      // ✨ 重新載入學生數據以更新 progress
      await loadDashboardData();
      
      return data.plan;
    }

    return null;
  } catch (err) {
    console.error('Error regenerating plan:', err);
    alert('Failed to regenerate plan: ' + err.message);
    return null;
  }
};

  // ===== Render =====
  if (loading) {
    return (
      <div className="tutor-dashboard">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="tutor-dashboard">
        <div className="error-state">
          <p>Error: {error}</p>
          <button onClick={loadDashboardData} className="btn-retry">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tutor-dashboard">
      {/* ===== Header Section ===== */}
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>{t('tutor.dashboard.title', 'Tutor Dashboard')}</h1>
          <p className="welcome-message">
            {t('tutor.dashboard.welcome', 'Welcome back')}, {tutorProfile?.display_name || tutorProfile?.full_name || 'Tutor'}!
          </p>
        </div>
        <button 
          className="btn-edit-profile"
          onClick={() => setShowEditProfile(true)}
        >
          Edit Public Profile
        </button>
      </div>

      {/* ===== Students Section ===== */}
      <div className="students-section">
        <div className="section-header">
          <h2>My Students</h2>
          <button 
            className="btn-add-student"
            onClick={() => setShowAddStudent(true)}
          >
            + Add Student
          </button>
        </div>

        {students.length === 0 ? (
          <div className="empty-state">
            <p>You don't have any students yet.</p>
            <p>Click "Add Student" to search and add students to your list.</p>
          </div>
        ) : (
          <div className="students-grid">
            {students.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                onViewRecords={handleViewRecords}
                onRemove={handleRemoveStudent}
                onRegeneratePlan={handleRegeneratePlan}
                onGetAIReport={handleGetAIReport}
              />
            ))}
          </div>
        )}
      </div>

      {/* ===== Modals ===== */}
      {showEditProfile && (
        <EditProfileModal
          tutor={tutorProfile}
          onClose={() => setShowEditProfile(false)}
          onSave={handleSaveProfile}
        />
      )}

      {showAddStudent && (
        <AddStudentModal
          onClose={() => {
            setShowAddStudent(false);
            setSearchResults([]);
          }}
          onAdd={handleAddStudent}
          searchResults={searchResults}
          onSearch={handleSearchStudents}
        />
      )}

      {showRecords && (
        <RecordsModal
          student={selectedStudent}
          records={studentRecords}
          onClose={() => {
            setShowRecords(false);
            setSelectedStudent(null);
            setStudentRecords([]);
          }}
        />
      )}

      {showAIReport && (
        <AIReportModal
          student={selectedStudent}
          report={aiReport}
          loading={aiReportLoading}
          onClose={() => {
            setShowAIReport(false);
            setSelectedStudent(null);
            setAiReport(null);
          }}
        />
      )}

      {showRegeneratePlan && (
        <RegeneratePlanModal
          student={selectedStudent}
          currentPlan={currentPlan}
          onClose={() => {
            setShowRegeneratePlan(false);
            setSelectedStudent(null);
            setCurrentPlan(null);
          }}
          onRegenerate={handleDoRegeneratePlan}
          onPlanUpdated={(newPlan) => setCurrentPlan(newPlan)}
        />
      )}

      {showConfirm && (
        <ConfirmModal
          title="Remove Student"
          message={`Are you sure you want to remove ${selectedStudent?.username} from your student list?`}
          onConfirm={confirmAction}
          onCancel={() => {
            setShowConfirm(false);
            setSelectedStudent(null);
            setConfirmAction(null);
          }}
        />
      )}
    </div>
  );
}