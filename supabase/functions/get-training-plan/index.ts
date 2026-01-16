import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req ) => {
  // 處理 CORS 預檢請求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. 建立一個擁有 service_role 權限的 Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. 從請求中獲取 user_id
    const { userId } = await req.json();
    if (!userId) {
      throw new Error("User ID is required.");
    }

    // 3. 使用 service_role 權限查詢資料，繞過 RLS
    const { data, error } = await supabaseAdmin
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // 如果只是找不到記錄，返回 null 是正常的
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify(null), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      throw error; // 對於其他錯誤，則拋出
    }

    // 4. 成功返回查詢到的資料
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
