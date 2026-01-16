// src/api/supabaseAPI.js

import { supabase } from '../supabaseClient';

// =================================================================
// ==   核心用戶數據 API                                          ==
// =================================================================

/**
 * [新增] 獲取指定用戶的 profiles.role。
 * @param {string} userId - 用戶 ID。
 * @returns {Promise<string|null>} - 用戶的角色字串，如果找不到則為 null。
 */
export const getUserRole = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') { // 忽略找不到記錄的錯誤
      console.error('Error fetching user role:', error);
    }
    return null;
  }

  return data?.role || null;
};


/**
 * [推薦使用] 獲取指定用戶的完整個人資料，包括 settings 和 status。
 * 這個函數現在是應用中獲取用戶數據的核心。
 * @param {string} userId - 用戶 ID。
 * @returns {Promise<object>} - 包含 profile, settings, 和 status 的完整用戶對象。
 */
export const getFullUserProfile = async (userId) => {
  if (!userId) throw new Error('User ID is required.');

  const { data, error } = await supabase
    .from('profiles')
    .select(`
        id,
        username,
        settings:user_settings(*),
        status:user_status(*)
      `)
    .eq('id', userId)
    .single(); // 使用 .single() 來獲取單一物件而不是陣列

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn(`Full user profile not found for user ${userId}. This might happen during initial setup.`);
      return null;
    }
    console.error('Error fetching full user profile:', error);
    throw new Error(error.message);
  }

  return data;
};

/**
 * [舊版] 獲取當前登入用戶的個人資料和設置。
 * @param {string} userId - 當前用戶的 ID。
 * @returns {Promise<object>} - 包含用戶 profile 和 settings 的合併對象。
 */
export const getUserData = async (userId) => {
  if (!userId) throw new Error('User ID is required.');

  const [profilePromise, settingsPromise] = await Promise.all([
    supabase.from('profiles').select('id, username').eq('id', userId).single(),
    supabase.from('user_settings').select('language, sug_lvl').eq('user_id', userId).single(),
  ]);

  if (profilePromise.error) {
    console.error('Error fetching user profile:', profilePromise.error);
    throw new Error(profilePromise.error.message);
  }
  if (settingsPromise.error) {
    console.error('Error fetching user settings:', settingsPromise.error);
    throw new Error(settingsPromise.error.message);
  }

  return {
    ...profilePromise.data,
    settings: settingsPromise.data,
  };
};

/**
 * 更新用戶的個人資料（僅限用戶名）。
 * @param {string} userId - 用戶 ID。
 * @param {object} updates - 包含要更新的欄位的對象，例如 { username: 'New Name' }。
 * @returns {Promise<object>} - 更新後的數據。
 */
export const updateUserProfile = async (userId, updates) => {
  if (!userId || !updates) throw new Error('User ID and updates are required.');

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user profile:', error);
    throw new Error(error.message);
  }

  return data;
};

/**
 * 更新用戶的設置（例如練習語言）。
 * @param {string} userId - 用戶 ID。
 * @param {object} updates - 包含要更新的欄位的對象，例如 { language: 'zh' }。
 * @returns {Promise<object>} - 更新後的數據。
 */
export const updateUserSettings = async (userId, updates) => {
  if (!userId || !updates) throw new Error('User ID and updates are required.');

  const { data, error } = await supabase
    .from('user_settings')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user settings:', error);
    throw new Error(error.message);
  }

  return data;
};

// =================================================================
// ==   初始測試 API                                              ==
// =================================================================

/**
 * 提交一條初始測試的日誌。
 * @param {object} sessionData - 要插入的會話數據。
 * @returns {Promise<object>} - 插入的數據。
 */
export const postInitialTestResult = async (sessionData) => {
  if (!sessionData) throw new Error('Session data is required.');

  const payload = {
    ...sessionData,
    diffi_level: 'initial_test',
  };

  const { data, error } = await supabase.from('practice_sessions').insert([payload]).select().single();

  if (error) {
    console.error('Error posting initial test result:', error);
    throw new Error(error.message);
  }
  return data;
};

/**
 * 標記初始測試已完成，更新 user_settings 表中的 sug_lvl。
 * @param {string} userId - 用戶 ID。
 * @param {string} language - 練習語言。
 * @param {string} suggestedLevel - 根據測試結果建議的等級。
 * @returns {Promise<object>} - 更新後的 user_settings。
 */
export const markTestAsCompleted = async (userId, language, suggestedLevel = 'Primary-School') => {
  if (!userId || !language) throw new Error('User ID and language are required.');

  const { data, error } = await supabase
    .from('user_settings')
    .update({ sug_lvl: suggestedLevel })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error marking test as completed:', error);
    throw new Error(error.message);
  }
  return data;
};

// =================================================================
// ==   初始測試狀態管理 API (新增部分)                           ==
// =================================================================

/**
 * 獲取指定用戶和語言的初始測試狀態。
 * @param {string} userId - 用戶 ID。
 * @param {string} language - 練習語言 ('en', 'zh')。
 * @returns {Promise<object>} - 包含當前進度的 user_status 對象。
 */
export const getInitialTestProgress = async (userId, language) => {
  if (!userId || !language) throw new Error('User ID and language are required.');

  const { data, error } = await supabase
    .from('user_status')
    .select('cur_lvl, cur_word, cur_log')
    .eq('user_id', userId)
    .eq('language', language)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      console.warn(`No initial test progress found for user ${userId} in language ${language}. Returning default.`);
      return { cur_lvl: 'initial_test_0', cur_word: null, cur_log: null };
    }
    console.error('Error fetching initial test progress:', error);
    throw new Error(error.message);
  }

  return data;
};

/**
 * 更新用戶的初始測試進度。
 * @param {string} userId - 用戶 ID。
 * @param {string} language - 練習語言。
 * @param {object} updates - 包含要更新的欄位的對象，例如 { cur_lvl, cur_word, cur_log }。
 * @returns {Promise<object>} - 更新後的數據。
 */
export const updateInitialTestProgress = async (userId, language, updates) => {
  if (!userId || !language || !updates) throw new Error('User ID, language, and updates are required.');

  const { data, error } = await supabase
    .from('user_status')
    .update(updates)
    .eq('user_id', userId)
    .eq('language', language)
    .select()
    .single();

  if (error) {
    console.error('Error updating initial test progress:', error);
    throw new Error(error.message);
  }

  return data;
};

// =================================================================
// ==   練習記錄 API (Records.jsx)                               ==
// =================================================================

/**
 * [舊版] 獲取指定用戶的所有練習記錄。
 * @param {string} userId - 用戶 ID。
 * @returns {Promise<Array>} - 練習記錄數組。
 */
export const getPracticeRecords = async (userId) => {
  if (!userId) throw new Error('User ID is required.');

  const { data, error } = await supabase
    .from('practice_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching practice records:', error);
    throw new Error(error.message);
  }
  return data;
};

/**
 * ✨ [新增] 獲取指定用戶和語言的音標錯誤摘要。
 * 直接從 user_progress_summary 表中查詢，並按錯誤數量排序。
 * @param {string} userId - 用戶 ID。
 * @param {string} language - 練習語言。
 * @returns {Promise<Array>} - 包含最多前 5 條音標錯誤記錄的陣列。
 */
export const getPhonemeSummary = async (userId, language) => {
  if (!userId || !language) throw new Error('User ID and language are required.');

  const { data, error } = await supabase
    .from('user_progress_summary')
    .select('phoneme, err_amount')
    .eq('user_id', userId)
    .eq('language', language)
    .order('err_amount', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error fetching phoneme summary:', error);
    throw new Error(error.message);
  }
  return data;
};

// =================================================================
// ==   日常練習 API (修正版)                                     ==
// =================================================================

/**
 * ✨ [新增] 獲取用戶最弱的音標。
 * @param {string} userId - 用戶 ID。
 * @param {string} language - 練習語言。
 * @returns {Promise<string>} - 最弱的音標字串，如果沒有則返回預設值 'i'。
 */
export const getWeakestPhoneme = async (userId, language) => {
  if (!userId || !language) return 'i'; // 返回預設值

  const { data, error } = await supabase
    .from('user_progress_summary')
    .select('phoneme')
    .eq('user_id', userId)
    .eq('language', language)
    .order('avg_err_rate', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return 'i'; // 如果出錯或沒找到，也返回預設值
  }
  return data.phoneme;
};

/**
 * ✨ [修正] 調用 Edge Function 來為用戶生成一個新的練習單字。
 * 現在它會發送 form-data。
 * @param {object} params - 包含 phoneme, difficulty_level, language 的對象。
 * @returns {Promise<object>} - 從 LLM 服務返回的包含 practice_word 的對象。
 */
export const generatePracticeWord = async ({ phoneme, difficulty_level, language }) => {
  if (!phoneme || !difficulty_level || !language) {
    throw new Error('Phoneme, difficulty level, and language are required.');
  }

  const formData = new FormData();
  formData.append('phoneme', phoneme);
  formData.append('difficulty_level', difficulty_level);
  formData.append('language', language);

  const { data, error } = await supabase.functions.invoke('generate-practice-word', {
    body: formData, // ✨ 直接發送 FormData
  });

  if (error) {
    console.error('Error generating practice word:', error);
    const errorMessage = error.context?.json?.()?.error || error.message;
    throw new Error(`Failed to generate a new word: ${errorMessage}`);
  }

  return data;
};

/**
 * ✨ [新增] 獲取指定用戶和語言的練習狀態。
 * @param {string} userId - 用戶 ID。
 * @param {string} language - 練習語言。
 * @returns {Promise<object>} - 包含 cur_lvl, cur_word, 和 cur_log 的 user_status 對象。
 */
export const getPracticeStatus = async (userId, language) => {
  if (!userId || !language) return null;

  const { data, error } = await supabase
    .from('user_status')
    .select('cur_lvl, cur_word, cur_log')
    .eq('user_id', userId)
    .eq('language', language)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { cur_lvl: 'Primary-School', cur_word: null, cur_log: null };
    }
    console.error('Error fetching practice status:', error);
    throw error;
  }

  return data;
};

/**
 * ✨ [新增] 管理員查詢導師申請列表。
 * @param {string|null} status - 過濾狀態 ('pending' | 'approved' | 'rejected')，預設抓全部。
 * @returns {Promise<Array>} - 導師申請陣列。
 */
export const getTutorApplications = async (status = null) => {
  let query = supabase
    .from('tutor_applications')
    .select('*')
    .order('applied_at', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching tutor applications:', error);
    throw new Error(error.message);
  }

  return data;
};

/**
 * ✨ [新增] 取得單一導師申請詳細資料。
 * @param {string} applicationId - 申請 ID。
 * @returns {Promise<object|null>} - 申請資料。
 */
export const getTutorApplicationById = async (applicationId) => {
  if (!applicationId) throw new Error('Application ID is required.');

  const { data, error } = await supabase
    .from('tutor_applications')
    .select('*')
    .eq('id', applicationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching tutor application:', error);
    throw new Error(error.message);
  }

  return data;
};

/**
 * ✨ [新增] 更新導師申請狀態（管理員審核）。
 * @param {string} applicationId - 申請 ID。
 * @param {object} options - 審核資料。
 * @param {string} options.status - 'approved' | 'rejected'。
 * @param {string} [options.adminNote] - 審核備註。
 * @param {string} [options.reviewerId] - 審核者（管理員）ID。
 * @returns {Promise<object>} - 更新後的申請紀錄。
 */
export const updateTutorApplicationStatus = async (
  applicationId,
  { status, adminNote = null, reviewerId = null }
) => {
  if (!applicationId) throw new Error('Application ID is required.');
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw new Error('Invalid status provided for tutor application.');
  }

  const updates = {
    status,
    admin_note: adminNote,
    reviewed_at: new Date().toISOString(),
  };

  if (reviewerId) {
    updates.reviewer_id = reviewerId;
  }

  const { data, error } = await supabase
    .from('tutor_applications')
    .update(updates)
    .eq('id', applicationId)
    .select()
    .single();

  if (error) {
    console.error('Error updating tutor application status:', error);
    throw new Error(error.message);
  }

  return data;
};

// =================================================================
// ==   好友系統 API (Friends System API)
// =================================================================

/**
 * 搜尋使用者 (用於新增好友)。
 * @param {string} searchTerm - 使用者名稱。
 * @param {string} currentUserId - 當前登入使用者的 ID，用於從搜尋結果中排除自己。
 * @returns {Promise<Array>} - 符合條件的使用者列表。
 */
export const searchUsers = async (searchTerm, currentUserId) => {
  if (!searchTerm.trim()) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, settings:user_settings(sug_lvl)')
    .ilike('username', `%${searchTerm}%`)
    .neq('id', currentUserId)
    .limit(10);

  if (error) {
    console.error('Error searching users:', error);
    throw error;
  }

  return data;
};


/**
 * 獲取與當前使用者相關的所有好友關係 (包括已接受和待處理的)。
 * @param {string} userId - 當前登入使用者的 ID。
 * @returns {Promise<Array>} - 友誼關係列表。
 */
export const getFriendships = async (userId) => {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      user_one_id,
      user_two_id,
      status,
      action_user_id,  
      user_one:profiles!friendships_user_one_id_fkey(
        id, 
        username,
        settings:user_settings(sug_lvl)
      ),
      user_two:profiles!friendships_user_two_id_fkey(
        id, 
        username,
        settings:user_settings(sug_lvl)
      )
    `)
    .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`);

  if (error) {
    console.error('Error fetching friendships:', error);
    throw error;
  }

  return data;
};

/**
 * 發送好友邀請。
 * @param {string} senderId - 發送者 ID。
 * @param {string} receiverId - 接收者 ID。
 * @returns {Promise<object>} - 新增的關係記錄。
 */
export const addFriend = async (senderId, receiverId) => {
  const [user1, user2] = [senderId, receiverId].sort((a, b) => a.localeCompare(b));

  const { data, error } = await supabase
    .from('friendships')
    .insert({
      user_one_id: user1,
      user_two_id: user2,
      status: 'pending',
      action_user_id: senderId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A friend request already exists between you and this user.');
    }
    console.error('Error adding friend:', error);
    throw error;
  }
  return data;
};

export const respondToFriendRequest = async (actionUserId, currentUserId, newStatus) => {
  const user1 = actionUserId < currentUserId ? actionUserId : currentUserId;
  const user2 = actionUserId < currentUserId ? currentUserId : actionUserId;

  if (newStatus === 'accepted') {
    const { data, error } = await supabase
      .from('friendships')
      .update({
        status: 'accepted',
        action_user_id: currentUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('user_one_id', user1)
      .eq('user_two_id', user2)
      .eq('status', 'pending')
      .select();

    console.log(`Attempting to update friendship. Conditions:
    user_one_id: ${user1}
    user_two_id: ${user2}
    status: 'pending'
  `);

    if (error) {
      console.error('Error accepting friend request:', error);
      throw error;
    }

    console.log('Supabase update result:', { data, error });

    if (data && data.length > 0) {
      console.log('Successfully updated record:', data[0]);
      return data[0];
    } else {
      console.warn('No matching record found to update. Data is empty.');
      return null;
    }
  } else {
    return removeFriendship(actionUserId, currentUserId);
  }
};

/**
 * 移除好友關係或取消邀請。
 * ✨ [核心修正] 使用 ID 排序來定位並刪除唯一的記錄。
 * @param {string} userId1 - 用戶1的 ID。
 * @param {string} userId2 - 用戶2的 ID。
 * @returns {Promise<object>} - 已刪除的記錄。
 */
export const removeFriendship = async (userId1, userId2) => {
  const userA = userId1 < userId2 ? userId1 : userId2;
  const userB = userId1 < userId2 ? userId2 : userId1;

  const { data, error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_one_id', userA)
    .eq('user_two_id', userB);

  if (error) {
    console.error('Error removing friendship:', error);
    throw error;
  }
  return data;
};

/**
 * ✨ 核心修正：不再直接 insert，而是呼叫後端的 RPC 函式來儲存訓練計畫
 * @param {object} planData - 包含 user_id, plan_data, 和 level_on_creation 的物件
 * @returns {Promise<void>}
 */
export const saveTrainingPlan = async ({ user_id, plan_data, sug_lvl }) => {
  if (!user_id || !plan_data || !sug_lvl) {
    throw new Error('User ID, plan data, and suggested level are required to save a training plan.');
  }

  const { error } = await supabase.rpc('create_user_training_plan', {
    p_sug_lvl: sug_lvl,
    p_plan_data: plan_data,
    p_user_id: user_id,
  });

  if (error) {
    console.error('Error saving training plan via RPC:', error);
    throw error;
  }
};

/**
 * ✨ [新增] 獲取指定使用者當前有效的訓練計畫。
 * 透過呼叫 Edge Function 來安全地繞過 RLS。
 * @param {string} userId - 使用者 ID。
 * @returns {Promise<object|null>} - 包含計畫詳情的物件，如果找不到則返回 null。
 */
export const getActiveTrainingPlan = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabase.functions.invoke('get-training-plan', {
    body: { userId: userId },
  });

  if (error) {
    console.error('Error invoking get-training-plan function:', error);
    throw error;
  }

  return data;
};

/**
 * 取得目前登入使用者
 */
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  return user;
}

/**
 * 提交導師申請
 */
export async function registerTutorApplication({
  fullName,
  headline,
  bio,
  yearsOfExperience,
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('You must be signed in to apply as a tutor.');
  }

  const { error } = await supabase.rpc('handle_new_tutor', {
    tutor_id: user.id,
    form_full_name: fullName,
    form_email: user.email ?? '', // 帶入登入者的 email
    headline,
    bio,
    years_of_ex: Number(yearsOfExperience) || 0,
  });

  if (error) throw error;
  return { success: true };
}

// =================================================================
// ==   教師與學生關係 API                                         ==
// =================================================================

/**
 * 獲取用戶的教師關係（我的教師和教師邀請）
 * @param {string} studentId - 學生 ID
 * @returns {Promise<Array>} - 教師關係數組
 */
export const getTutorRelationships = async (studentId) => {
  if (!studentId) return [];

  // 先獲取 tutor_students 記錄
  const { data: relationships, error: relError } = await supabase
    .from('tutor_students')
    .select('id, tutor_id, student_id, status, created_at')
    .eq('student_id', studentId);

  if (relError) {
    console.error('Error fetching tutor relationships:', relError);
    throw relError;
  }

  if (!relationships || relationships.length === 0) {
    return [];
  }

  // 為每個關係獲取教師資訊
  const enrichedData = await Promise.all(
    relationships.map(async (relationship) => {
      // 獲取教師基本資訊
      const { data: tutorData } = await supabase
        .from('tutors')
        .select('user_id, full_name, display_name, email')
        .eq('user_id', relationship.tutor_id)
        .single();

      if (!tutorData) {
        return { ...relationship, tutor: null };
      }

      // 獲取教師的 application 資訊
      const { data: appData } = await supabase
        .from('tutor_applications')
        .select('headline, bio, years_of_ex')
        .eq('user_id', relationship.tutor_id)
        .eq('status', 'approved')
        .single();

      return {
        ...relationship,
        tutor: {
          ...tutorData,
          headline: appData?.headline || 'Certified Tutor',
          bio: appData?.bio || '',
          years_of_experience: appData?.years_of_ex || 0,
        },
      };
    })
  );

  return enrichedData.filter(r => r.tutor !== null);
};

/**
 * 接受教師邀請
 * @param {string} relationshipId - tutor_students 記錄的 ID
 * @returns {Promise<object>} - 更新後的記錄
 */
export const acceptTutorInvite = async (relationshipId) => {
  const { data, error } = await supabase
    .from('tutor_students')
    .update({ status: 'accepted' })
    .eq('id', relationshipId)
    .select()
    .single();

  if (error) {
    console.error('Error accepting tutor invite:', error);
    throw error;
  }
  return data;
};

/**
 * 拒絕教師邀請或移除教師關係
 * @param {string} relationshipId - tutor_students 記錄的 ID
 * @returns {Promise<object>} - 刪除的記錄
 */
export const removeTutorRelationship = async (relationshipId) => {
  const { data, error } = await supabase
    .from('tutor_students')
    .delete()
    .eq('id', relationshipId);

  if (error) {
    console.error('Error removing tutor relationship:', error);
    throw error;
  }
  return data;
};