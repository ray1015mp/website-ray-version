// src/supabaseClient.js (The Final Unified Universe Edition)

import { createClient } from '@supabase/supabase-js'

// ✨✨✨ 決定性的、融合宇宙的、唯一的修正！✨✨✨
// 我們，要，從，我們的「本地宇宙」的「環境變量」中，讀取，地址和密鑰！
// 這些變量，是由 `npm start`，自動，為我們，注入的！

console.log('[supabaseClient] REACT_APP_SUPABASE_URL =', process.env.REACT_APP_SUPABASE_URL);
console.log('[supabaseClient] REACT_APP_SUPABASE_ANON_KEY 存在？', !!process.env.REACT_APP_SUPABASE_ANON_KEY);

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少 REACT_APP_SUPABASE_URL 或 REACT_APP_SUPABASE_ANON_KEY，請檢查 .env 設定。');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('[supabaseClient] 實際使用的 supabaseUrl =', supabaseUrl);








