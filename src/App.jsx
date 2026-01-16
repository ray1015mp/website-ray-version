// src/App.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SessionContextProvider, useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getFullUserProfile, getUserRole } from './api/supabaseAPI';
import { supabase } from './supabaseClient';

// --- 共用頁面 ---
import AuthCallback from './pages/AuthCallback';
import FriendsPage from './pages/FriendsPage';
import InitialTest from './pages/InitialTest';
import Introduction from './pages/Introduction';
import Leaderboard from './pages/Leaderboard';
import Login from './pages/Login';
import Practice from './pages/Practice';
import Profile from './pages/Profile';
import Records from './pages/Records';
import TrainingPlanPage from './pages/TrainingPlanModal';
import TutorSignup from './pages/TutorSignup';
import FindTutor from './pages/FindTutor';
import ContextualQuestions from './pages/ContextualQuestions';

// --- Admin 頁面 ---
import AdminPage from './pages/AdminPage';

// --- Tutor 獨有頁面 ---
import TutorDashboard from './pages/TutorDashboard';

// --- 共用元件 ---
import ClickSpark from './components/ClickSpark';
import Header from './components/Header';
import TutorHeader from './components/TutorHeader';  // ✨ 新增
import LanguageSelector from './components/LanguageSelector';
import MiniProfile from './components/MiniProfile';
import ResetPassword from './components/ResetPassword';

// --- 全螢幕載入元件 ---
const FullScreenLoader = () => (
  <div style={{
    position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
    justifyContent: 'center', backgroundColor: 'var(--background-light)', zIndex: 9999,
  }}>
    <div style={{ fontSize: '1.5rem', color: 'var(--text-medium)', fontWeight: '600' }}>
      Loading Application...
    </div>
  </div>
);

// --- 自定義 Hook: 獲取用戶數據 ---
const useUser = () => {
  const session = useSession();
  const userId = session?.user?.id;
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => getFullUserProfile(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
};

// --- 自定義 Hook: 獲取用戶角色 ---
const useUserRole = () => {
  const session = useSession();
  const userId = session?.user?.id;
  return useQuery({
    queryKey: ['userRole', userId],
    queryFn: () => getUserRole(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
};

// --- 根據角色返回首頁路徑 ---
const getHomePageByRole = (role) => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'tutor':
      return '/tutor/dashboard';
    case 'user':
    default:
      return '/introduction';
  }
};

// --- 學生佈局 (Student Layout) ---
const StudentLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const { data: profileData } = useUser();
  const supabaseClient = useSupabaseClient();
  const queryClient = useQueryClient();

  const handleLogout = useCallback(async () => {
    await supabaseClient.auth.signOut();
    queryClient.clear();
    navigate('/login');
  }, [supabaseClient, queryClient, navigate]);

  const hasCompletedTest = !!profileData?.settings?.sug_lvl;
  
  // 合併 session 中的 email 到 profileData
  const userDataWithEmail = profileData ? { ...profileData, email: session?.user?.email } : null;

  return (
    <div className="app-container">
      <Header
        activePage={location.pathname.split('/')[1] || 'introduction'}
        onNavigate={navigate}
        onLogout={handleLogout}
        hasCompletedTest={hasCompletedTest}
      />
      <ClickSpark>
        <Outlet />
      </ClickSpark>
      <MiniProfile userData={userDataWithEmail} />
      <LanguageSelector />
    </div>
  );
};

// --- ✨ Tutor 佈局 (Tutor Layout) ---
const TutorLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSession();
  const { data: profileData } = useUser();
  const supabaseClient = useSupabaseClient();
  const queryClient = useQueryClient();

  const handleLogout = useCallback(async () => {
    await supabaseClient.auth.signOut();
    queryClient.clear();
    navigate('/login');
  }, [supabaseClient, queryClient, navigate]);

  // 獲取當前頁面名稱 (例如 /tutor/dashboard -> dashboard)
  const currentPage = location.pathname.split('/')[2] || 'dashboard';
  
  // 合併 session 中的 email 到 profileData
  const userDataWithEmail = profileData ? { ...profileData, email: session?.user?.email } : null;

  return (
    <div className="app-container tutor-app">
      <TutorHeader
        activePage={currentPage}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
      <ClickSpark>
        <Outlet />
      </ClickSpark>
      <MiniProfile userData={userDataWithEmail} />
      <LanguageSelector />
    </div>
  );
};

// --- Admin 佈局 ---
const AdminLayout = () => {
  const navigate = useNavigate();
  const supabaseClient = useSupabaseClient();
  const queryClient = useQueryClient();

  const handleLogout = useCallback(async () => {
    await supabaseClient.auth.signOut();
    queryClient.clear();
    navigate('/login');
  }, [supabaseClient, queryClient, navigate]);

  return (
    <div className="app-container admin-app">
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        backgroundColor: '#1a1a2e',
        color: 'white'
      }}>
        <h2>TheraLingua AI - Admin</h2>
        <button onClick={handleLogout} style={{
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          backgroundColor: '#e74c3c',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}>
          Logout
        </button>
      </header>
      <Outlet />
    </div>
  );
};

// --- 角色路由守衛 ---
const RoleBasedRoute = ({ allowedRoles, children }) => {
  const session = useSession();
  const { data: role, isLoading } = useUserRole();
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getHomePageByRole(role)} replace />;
  }

  return children;
};

// --- 登入後自動導航 ---
const AuthenticatedRedirect = () => {
  const session = useSession();
  const { data: role, isLoading } = useUserRole();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return <FullScreenLoader />;
  }

  return <Navigate to={getHomePageByRole(role)} replace />;
};

// --- App 主元件 ---
function App() {
  const session = useSession();
  const location = useLocation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const { data: profileData, isLoading: isLoadingProfile, isError } = useUser();
  const { data: userRole, isLoading: isLoadingRole } = useUserRole();

  const practiceLanguage = useMemo(() => profileData?.settings?.language || 'en', [profileData]);
  const hasCompletedTest = useMemo(() => !!profileData?.settings?.sug_lvl, [profileData]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setShowPasswordReset(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onTestComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['user'] });
    navigate('/plan');
  }, [queryClient, navigate]);

  const handlePasswordUpdated = () => {
    setShowPasswordReset(false);
  };

  if (session && (isLoadingProfile || isLoadingRole)) return <FullScreenLoader />;

  if (isError) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'red' }}>
        <p>Error: Failed to load user profile.</p>
      </div>
    );
  }

  return (
    <>
      {showPasswordReset && <ResetPassword onPasswordUpdated={handlePasswordUpdated} />}
      <Routes>
        {/* ===== 公開路由 ===== */}
        <Route path="/login" element={
          session ? <AuthenticatedRedirect /> : <Login />
        } />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/tutor-signup" element={<TutorSignup />} />

        {/* ===== 根路徑重定向 ===== */}
        <Route path="/" element={
          session ? <AuthenticatedRedirect /> : <Navigate to="/login" replace />
        } />

        {/* ===== 學生路由 (Student Routes) ===== */}
        <Route element={
          <RoleBasedRoute allowedRoles={['student', 'admin']}>
            <StudentLayout />
          </RoleBasedRoute>
        }>
          <Route path="introduction" element={<Introduction />} />
          <Route path="practice" element={<Practice practiceLanguage={practiceLanguage} />} />
          <Route path="records" element={<Records />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="friends" element={<FriendsPage />} />
          <Route path="profile" element={<Profile />} />
          <Route path="find-tutor" element={<FindTutor />} />
          <Route path="TrainingPlanModal" element={<TrainingPlanPage />} />
          <Route path="plan" element={<TrainingPlanPage />} />
          <Route path="contextual" element={<ContextualQuestions />} />
        </Route>

        {/* ===== Initial Test (學生專用) ===== */}
        <Route path="/initial-test" element={
          <RoleBasedRoute allowedRoles={['student', 'admin']}>
            {hasCompletedTest ? (
              <Navigate to="/introduction" replace />
            ) : (
              <ClickSpark>
                <InitialTest onTestComplete={onTestComplete} practiceLanguage={practiceLanguage} />
              </ClickSpark>
            )}
          </RoleBasedRoute>
        } />

        {/* ===== Tutor 路由 (共用頁面) ===== */}
        <Route path="/tutor" element={
          <RoleBasedRoute allowedRoles={['tutor', 'admin']}>
            <TutorLayout />
          </RoleBasedRoute>
        }>
          <Route index element={<Navigate to="/tutor/dashboard" replace />} />
          <Route path="dashboard" element={<TutorDashboard />} />
          {/* ✨ 共用頁面 */}
          <Route path="introduction" element={<Introduction />} />
          <Route path="profile" element={<Profile />} />
          <Route path="leaderboard" element={<Leaderboard />} />
        </Route>

        {/* ===== Admin 路由 ===== */}
        <Route path="/admin" element={
          <RoleBasedRoute allowedRoles={['admin']}>
            <AdminLayout />
          </RoleBasedRoute>
        }>
          <Route index element={<AdminPage />} />
        </Route>

        {/* ===== 404 ===== */}
        <Route path="*" element={<p>Page Not Found</p>} />
      </Routes>
    </>
  );
}

// --- 帶有認證載入邏輯的 App 包裹器 ---
const AppWithAuth = () => {
  const session = useSession();
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    if (session !== undefined) {
      const timer = setTimeout(() => setInitialLoad(false), 100);
      return () => clearTimeout(timer);
    }
  }, [session]);

  if (initialLoad) return <FullScreenLoader />;

  return <App />;
};

// --- 最終導出的根元件 ---
export default function AppWrapper() {
  return (
    <BrowserRouter>
      <SessionContextProvider supabaseClient={supabase}>
        <AppWithAuth />
      </SessionContextProvider>
    </BrowserRouter>
  );
}