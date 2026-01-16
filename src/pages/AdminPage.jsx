// src/pages/AdminPage.jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import LanguageSelector from '../components/LanguageSelector'
import '../styles/AdminPage.css'
import { supabase } from '../supabaseClient'

const TAB = {
  PENDING: 'pending',
  CERTIFIED: 'certified',
}

// ACTION_COPY moved inside component to use translations

const formatDate = (iso) =>
  iso
    ? new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(new Date(iso))
    : '—'

const statusClass = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'active':
      return 'status-chip status-active'
    case 'suspended':
      return 'status-chip status-suspended'
    case 'revoked':
      return 'status-chip status-revoked'
    default:
      return 'status-chip'
  }
}

const Toast = ({ message, tone }) => (
  <div className={`tl-toast ${tone === 'error' ? 'tl-toast-error' : ''}`}>
    {message}
  </div>
)

const ConfirmModal = ({ title, message, onConfirm, onCancel, loading, t }) => (
  <div className="tl-modal-backdrop">
    <div className="tl-modal">
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="tl-modal-actions">
        <button className="btn-secondary" onClick={onCancel} disabled={loading}>
          {t('adminPage.cancel')}
        </button>
        <button
          className="btn-primary"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? t('adminPage.processing') : t('adminPage.confirm')}
        </button>
      </div>
    </div>
  </div>
)

export default function AdminPage() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState(TAB.PENDING)
  const [pendingApplications, setPendingApplications] = useState([])
  const [certifiedTutors, setCertifiedTutors] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Translation-aware action copy
  const ACTION_COPY = {
    approve: {
      title: t('adminPage.actions.approveTitle'),
      message: t('adminPage.actions.approveMessage'),
      success: t('adminPage.actions.approveSuccess'),
    },
    reject: {
      title: t('adminPage.actions.rejectTitle'),
      message: t('adminPage.actions.rejectMessage'),
      success: t('adminPage.actions.rejectSuccess'),
    },
    suspend: {
      title: t('adminPage.actions.suspendTitle'),
      message: t('adminPage.actions.suspendMessage'),
      success: t('adminPage.actions.suspendSuccess'),
    },
    reinstate: {
      title: t('adminPage.actions.reinstateTitle'),
      message: t('adminPage.actions.reinstateMessage'),
      success: t('adminPage.actions.reinstateSuccess'),
    },
    revoke: {
      title: t('adminPage.actions.revokeTitle'),
      message: t('adminPage.actions.revokeMessage'),
      success: t('adminPage.actions.revokeSuccess'),
    },
  }

  // Format date based on current language
  const formatDateLocale = (iso) =>
    iso
      ? new Intl.DateTimeFormat(i18n.language === 'zh' ? 'zh-TW' : 'en', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(new Date(iso))
      : '—'

  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [adminId, setAdminId] = useState(null)
  const [confirmState, setConfirmState] = useState({
    open: false,
    action: null,
    item: null,
    section: null,
  })

  const showToast = (message, tone = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 4200)
  }

  // Handle mode switch for testing as student or tutor
  const handleModeSwitch = async (mode) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showToast(t('adminPage.loginRequired'), 'error')
        return
      }

      // Update the user's role in profiles table temporarily
      const newRole = mode === 'tutor' ? 'tutor' : 'student'
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }

      showToast(t('adminPage.modeSwitchSuccess', { mode: t(`adminPage.${mode}Mode`) }))
      
      // Store admin mode flag in localStorage so we can show return button
      localStorage.setItem('adminTestMode', 'true')
      
      // Navigate to the appropriate page
      if (mode === 'tutor') {
        navigate('/tutor/dashboard')
      } else {
        navigate('/introduction')
      }
      
      // Force page reload to update role-based routing
      window.location.reload()
    } catch (err) {
      console.error('Mode switch error:', err)
      showToast(err.message || t('adminPage.modeSwitchError'), 'error')
    }
  }

  /**
   * 以 useCallback 將資料載入流程封裝：
   * 1. 撈取登入管理員、待審申請與已認證講師
   * 2. 將結果轉成前端可用的資料結構
   * 3. 同步更新畫面狀態
   */
  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [
        { data: userData, error: userError },
        { data: pendingData, error: pendingError },
        { data: certifiedData, error: certifiedError },
      ] = await Promise.all([
        // 取得目前登入的 Supabase 使用者
        supabase.auth.getUser(),
        // 取得待審核講師申請，採用左連接邏輯避免缺少 profiles 項目時資料被濾掉
        supabase
          .from('tutor_applications')
          .select(
            `
              id,
              user_id,
              full_name,
              headline,
              bio,
              years_of_ex,
              email,
              applied_at,
              status,
              reviewed_at,
              reviewer_id
            `
          )
          .eq('status', 'pending')
          .order('applied_at', { ascending: false }),
        // 取得已認證講師清單
        supabase
          .from('tutors')
          .select(
            `
              user_id,
              full_name,
              display_name,
              email,
              certified_by,
              status,
              created_at,
              updated_at
            `
          )
          .order('created_at', { ascending: false }),
      ])

      if (userError) throw userError
      if (pendingError) throw pendingError
      if (certifiedError) throw certifiedError

      // 將登入使用者 Id 保存，後續審核動作需要紀錄 reviewer
      setAdminId(userData?.user?.id ?? null)

      // 轉換待審申請資料給表格使用
      setPendingApplications(
        (pendingData ?? []).map((item) => ({
          id: item.id,
          userId: item.user_id,
          fullName: item.full_name,
          email: item.email,
          headline: item.headline,
          bio: item.bio,
          yearsOfEx: item.years_of_ex,
          appliedAt: item.applied_at,
          status: item.status,
          reviewedAt: item.reviewed_at,
          reviewerId: item.reviewer_id,
        }))
      )

      // 轉換已認證講師資料給表格使用
      setCertifiedTutors(
        (certifiedData ?? []).map((item) => ({
          id: item.user_id,
          userId: item.user_id,
          fullName: item.full_name,
          displayName: item.display_name ?? item.full_name ?? '',
          email: item.email,
          certifiedBy: item.certified_by,
          certifiedSince: item.created_at,
          status: item.status ?? 'Active',
          updatedAt: item.updated_at,
        }))
      )
    } catch (err) {
      console.error('[AdminPage] loadDashboardData failed:', err)
      setError(err.message ?? 'Unable to load admin dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * 元件初始化時載入管理後台所需資料
   */
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  const pendingCount = pendingApplications.length
  const certifiedCount = useMemo(
    () =>
      certifiedTutors.filter(
        (tutor) => tutor.status?.toLowerCase() === 'active'
      ).length,
    [certifiedTutors]
  )

  const activeList =
    activeTab === TAB.PENDING ? pendingApplications : certifiedTutors

  const openConfirm = (action, item, section) => {
    setConfirmState({
      open: true,
      action,
      item,
      section,
    })
  }

  const closeConfirm = () => {
    setConfirmState({
      open: false,
      action: null,
      item: null,
      section: null,
    })
  }

  /**
   * 封裝後端動作呼叫，其餘 Edge Function 請依新 payload 更新
   */
  const invokeAdminAction = async (action, payload) => {
    switch (action) {
      case 'approve':
        return supabase.functions.invoke('approve-tutor', {
          body: payload,
        })
      case 'reject':
        return supabase.functions.invoke('reject-tutor-application', {
          body: payload,
        })
      case 'suspend':
      case 'reinstate':
      case 'revoke':
        return supabase.functions.invoke('manage-certified-tutor', {
          body: { ...payload, action },
        })
      default:
        throw new Error('Unsupported admin action.')
    }
  }

  /**
   * 處理審核/啟停等管理員操作，完成後重新載入表格
   */
  const executeAction = async () => {
    if (!confirmState.action || !confirmState.item) return

    setActionLoading(true)
    const selectedAction = confirmState.action
    const item = confirmState.item

    try {
      if (!adminId) {
        throw new Error('Admin identity missing. Please re-login.')
      }

      // 基本 payload 會帶上管理員 Id
      let payload = { adminId }

      if (confirmState.section === TAB.PENDING) {
        // 待審區塊需要申請單 Id 與申請人使用者 Id
        payload = {
          ...payload,
          applicationId: item.id,
          applicantUserId: item.userId,
        }
      } else {
        // 已認證區塊主要以使用者 Id 操作講師資料
        payload = {
          ...payload,
          tutorId: item.userId,
        }
      }

      const { error: actionError } = await invokeAdminAction(
        selectedAction,
        payload
      )

      if (actionError) {
        throw actionError
      }

      showToast(ACTION_COPY[selectedAction].success)
      closeConfirm()
      await loadDashboardData()
    } catch (err) {
      console.error(err)
      showToast(err.message ?? 'Unable to complete action.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <h1>{t('adminPage.title')}</h1>
          <p>{t('adminPage.subtitle')}</p>
        </div>
        <div className="admin-header-actions">
          <LanguageSelector />
          <div className="mode-switcher">
            <span>{t('adminPage.testAs')}</span>
            <button 
              className="btn-mode btn-student-mode"
              onClick={() => handleModeSwitch('student')}
            >
              {t('adminPage.studentMode')}
            </button>
            <button 
              className="btn-mode btn-tutor-mode"
              onClick={() => handleModeSwitch('tutor')}
            >
              {t('adminPage.tutorMode')}
            </button>
          </div>
        </div>
      </header>

      <section className="summary-grid">
        <article className="summary-card summary-card-pending">
          <p>{t('adminPage.pendingApplications')}</p>
          <h2>{pendingCount}</h2>
        </article>
        <article className="summary-card summary-card-certified">
          <p>{t('adminPage.certifiedTutors')}</p>
          <h2>{certifiedCount}</h2>
        </article>
      </section>

      <nav className="tab-toggle">
        <button
          className={activeTab === TAB.PENDING ? 'active' : ''}
          onClick={() => setActiveTab(TAB.PENDING)}
        >
          {t('adminPage.pendingApplications')}
        </button>
        <button
          className={activeTab === TAB.CERTIFIED ? 'active' : ''}
          onClick={() => setActiveTab(TAB.CERTIFIED)}
        >
          {t('adminPage.manageCertified')}
        </button>
      </nav>

      <section className="table-section">
        {loading ? (
          <div className="loading-state">{t('adminPage.loading')}</div>
        ) : error ? (
          <div className="error-state">
            <h3>{t('adminPage.unableToLoad')}</h3>
            <p>{error}</p>
            <button className="btn-secondary" onClick={loadDashboardData}>
              {t('adminPage.retry')}
            </button>
          </div>
        ) : activeList.length === 0 ? (
          <div className="empty-state">
            {activeTab === TAB.PENDING
              ? t('adminPage.noApplications')
              : t('adminPage.noCertifiedTutors')}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                {activeTab === TAB.PENDING ? (
                  <tr>
                    <th>{t('adminPage.table.name')}</th>
                    <th>{t('adminPage.table.email')}</th>
                    <th>{t('adminPage.table.appliedAt')}</th>
                    <th>{t('adminPage.table.headline')}</th>
                    <th>{t('adminPage.table.experience')}</th>
                    <th className="actions-col">{t('adminPage.table.actions')}</th>
                  </tr>
                ) : (
                  <tr>
                    <th>{t('adminPage.table.name')}</th>
                    <th>{t('adminPage.table.email')}</th>
                    <th>{t('adminPage.table.certifiedSince')}</th>
                    <th>{t('adminPage.table.status')}</th>
                    <th className="actions-col">{t('adminPage.table.actions')}</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {activeList.map((item) =>
                  activeTab === TAB.PENDING ? (
                    <tr key={item.id}>
                      <td>{item.fullName}</td>
                      <td>{item.email}</td>
                      <td>{formatDateLocale(item.appliedAt)}</td>
                      <td>{item.headline || '—'}</td>
                      <td>{item.yearsOfEx ?? '—'}</td>
                      <td className="actions-col">
                        <button
                          className="btn-primary compact"
                          onClick={() =>
                            openConfirm('approve', item, TAB.PENDING)
                          }
                        >
                          {t('adminPage.approve')}
                        </button>
                        <button
                          className="btn-danger compact"
                          onClick={() =>
                            openConfirm('reject', item, TAB.PENDING)
                          }
                        >
                          {t('adminPage.reject')}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id}>
                      <td>{item.displayName || item.fullName}</td>
                      <td>{item.email}</td>
                      <td>{formatDateLocale(item.certifiedSince)}</td>
                      <td>
                        <span className={statusClass(item.status)}>
                          {t(`adminPage.status.${item.status?.toLowerCase()}`) || item.status}
                        </span>
                      </td>
                      <td className="actions-col">
                        {item.status?.toLowerCase() === 'suspended' ? (
                          <button
                            className="btn-primary compact"
                            onClick={() =>
                              openConfirm('reinstate', item, TAB.CERTIFIED)
                            }
                          >
                            {t('adminPage.reinstate')}
                          </button>
                        ) : (
                          <button
                            className="btn-warning compact"
                            onClick={() =>
                              openConfirm('suspend', item, TAB.CERTIFIED)
                            }
                          >
                            {t('adminPage.suspend')}
                          </button>
                        )}
                        <button
                          className="btn-danger compact"
                          onClick={() =>
                            openConfirm('revoke', item, TAB.CERTIFIED)
                          }
                        >
                          {t('adminPage.revoke')}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmState.open && (
        <ConfirmModal
          title={ACTION_COPY[confirmState.action].title}
          message={ACTION_COPY[confirmState.action].message}
          onConfirm={executeAction}
          onCancel={closeConfirm}
          loading={actionLoading}
          t={t}
        />
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  )
}