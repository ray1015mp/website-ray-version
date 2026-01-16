// supabase/functions/approve-tutor/index.ts
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false
  }
});
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      error: "Method not allowed"
    }), {
      status: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
  try {
    /**
     * 解析前端傳入的審核參數：
     * applicationId  : 講師申請單 ID
     * applicantUserId: 申請人 (使用者) 的 UUID
     * tutorId        : 舊版 payload，為相容性保留（若有 applicantUserId 以它優先）
     * adminId        : 執行審核的管理員 UUID
     */ const { applicationId, applicantUserId, tutorId, adminId } = await req.json();
    const targetUserId = applicantUserId ?? tutorId;
    if (!applicationId || !targetUserId || !adminId) {
      return new Response(JSON.stringify({
        error: "Missing applicationId, applicantUserId/tutorId, or adminId."
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    // 取得目前 UTC 時間，供多個欄位使用
    const nowIso = new Date().toISOString();
    /**
     * 先抓取該筆申請單，確定狀態與必要資料
     * （避免重複審核或 user_id 與 payload 不一致）
     */ const { data: application, error: applicationError } = await supabaseAdmin.from("tutor_applications").select(`
          id,
          user_id,
          full_name,
          email,
          status,
          headline,
          bio,
          years_of_ex,
          applied_at
        `).eq("id", applicationId).single();
    if (applicationError) {
      throw new Error(`Failed to fetch tutor application: ${applicationError.message}`);
    }
    if (application.user_id !== targetUserId) {
      throw new Error("Tutor application user_id does not match provided applicantUserId.");
    }
    if ((application.status ?? "").toLowerCase() !== "pending") {
      throw new Error("Tutor application is not pending.");
    }
    /**
     * 確認 profiles 是否已存在此使用者
     * - 若存在：更新 role、姓名、信箱與 updated_at
     * - 若不存在：建立一筆新的 profile
     */ const { data: existingProfile, error: fetchProfileError } = await supabaseAdmin.from("profiles").select("id").eq("id", targetUserId).maybeSingle();
    if (fetchProfileError) {
      throw new Error(`Failed to fetch profile: ${fetchProfileError.message}`);
    }
    if (existingProfile) {
      const { error: updateProfileError } = await supabaseAdmin.from("profiles").update({
        username: application.full_name,
        role: "tutor"
      }).eq("id", targetUserId);
      if (updateProfileError) {
        throw new Error(`Failed to update profile: ${updateProfileError.message}`);
      }
    } else {
      const { error: insertProfileError } = await supabaseAdmin.from("profiles").insert({
        id: targetUserId,
        username: application.full_name,
        role: "tutor",
      });
      if (insertProfileError) {
        throw new Error(`Failed to insert profile: ${insertProfileError.message}`);
      }
    }
    /**
     * 建立或更新 tutors 表：
     * - 若已存在講師資料：更新姓名、顯示名稱、Email、狀態與 updated_at
     * - 若尚未建立：新增一筆 Active 狀態的講師資料
     */ const { data: existingTutor, error: fetchTutorError } = await supabaseAdmin.from("tutors").select("user_id").eq("user_id", targetUserId).maybeSingle();
    if (fetchTutorError) {
      throw new Error(`Failed to fetch tutor: ${fetchTutorError.message}`);
    }
    if (existingTutor) {
      const { error: updateTutorError } = await supabaseAdmin.from("tutors").update({
        full_name: application.full_name,
        display_name: application.full_name,
        email: application.email,
        status: "Active",
        updated_at: nowIso
      }).eq("user_id", targetUserId);
      if (updateTutorError) {
        throw new Error(`Failed to update tutor: ${updateTutorError.message}`);
      }
    } else {
      const { error: insertTutorError } = await supabaseAdmin.from("tutors").insert({
        user_id: targetUserId,
        full_name: application.full_name,
        display_name: application.full_name,
        email: application.email,
        status: "Active",
        certified_by: adminId,
        created_at: nowIso,
        updated_at: nowIso
      });
      if (insertTutorError) {
        throw new Error(`Failed to insert tutor: ${insertTutorError.message}`);
      }
    }
    /**
     * 更新申請單狀態為 approved，
     * 並記錄審核者與審核時間
     */ const { error: updateApplicationError } = await supabaseAdmin.from("tutor_applications").update({
      status: "approved",
      reviewed_at: nowIso,
      reviewer_id: adminId
    }).eq("id", applicationId);
    if (updateApplicationError) {
      throw new Error(`Failed to update tutor application: ${updateApplicationError.message}`);
    }

    return new Response(JSON.stringify({
      success: true
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      error: error.message ?? "Internal Server Error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
