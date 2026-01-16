// src/api/submitTutorApplication.js
import { supabase } from '../supabaseClient';

/**
 * Handles the tutor application flow:
 * 1. Check if user already exists (to prevent foreign key error)
 * 2. Supabase Auth signUp (anon key only)
 * 3. RPC `handle_new_tutor` to store the application
 * 4. Sign the user out and return success signal
 */
export async function submitTutorApplication(formData) {
  const {
    email,
    password,
    fullName,
    headline,
    bio,
    yearsOfEx
  } = formData;

  // --- Step 0: Check if user already exists (to prevent foreign key error on existing users) ---
// 我們只在成功登入時才拋出錯誤，以避免誤判不存在的 Email。
const { data: signInData } = await supabase.auth.signInWithPassword({
    email,
    password
});

// 如果 signInData.user 存在，表示 Email 已經被註冊，我們阻止申請。
if (signInData.user) {
    // 移除 await supabase.auth.signOut();
    // 保持使用者登入狀態，並拋出錯誤
    throw new Error('此 Email 已經被註冊為其他帳號（例如學生）。請使用其他 Email 或先刪除舊帳號。');
}
  
  // Step 1: create auth user with pending tutor role metadata
  console.log('[submitTutorApplication] sending signUp request for', email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: 'tutor_pending'
      }
    }
  });

   if (signUpError) {
     console.error('[submitTutorApplication] signUpError =', signUpError);
     
     // 檢查是否是「使用者已註冊」的標準錯誤
     if (signUpError.message.includes('already exists') || signUpError.message.includes('User already registered')) {
         throw new Error('此 Email 已經註冊，請直接登入或使用其他 Email。');
     }
     
    throw new Error(signUpError.message || '無法註冊使用者。');
  }
  
  const tutorId = signUpData.user?.id;
  if (!tutorId) {
    throw new Error('Missing user id after sign up.');
  }

  console.log('[submitTutorApplication] signUpData.user.id =', signUpData.user?.id);
  console.log('[submitTutorApplication] calling handle_new_tutor for', tutorId);

  // Step 2: call the RPC to persist the application details
  const { error: rpcError } = await supabase.rpc('handle_new_tutor', {
    tutor_id: tutorId,
    form_full_name: fullName,
    form_email: email,
    headline: headline || null,
    bio: bio || null,
    years_of_ex: yearsOfEx !== undefined && yearsOfEx !== null
      ? Number(yearsOfEx)
      : null
  });

  if (rpcError) {
    console.error('[submitTutorApplication] rpcError =', rpcError);
    
    // 捕捉 23505 錯誤碼，表示唯一約束衝突 (重複提交)
    if (rpcError.code === '23505') {
      throw new Error('您已提交過申請，如需更新資料請聯絡客服。');
    }

    if (rpcError.message.includes('profiles_id_fkey')) {
        // 這意味著 Email 已經存在，且 signUp 沒有拋出錯誤，導致 RPC 失敗。
        throw new Error('此 Email 已經被註冊為其他帳號。請使用其他 Email 或先刪除舊帳號。');
    }
    
    throw new Error(rpcError.message || 'Unable to submit tutor application.');
  }

  // Step 3: sign out the user and return success signal
  await supabase.auth.signOut();
  return { success: true };
}
