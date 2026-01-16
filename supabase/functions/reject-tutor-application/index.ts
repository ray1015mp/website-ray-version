// supabase/functions/reject-tutor-application/index.ts
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const { applicationId, applicantUserId, adminId } = await req.json();

    console.log("Reject request received:", { applicationId, applicantUserId, adminId });

    if (!applicationId || !adminId) {
      return new Response(
        JSON.stringify({ error: "Missing applicationId or adminId." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const nowIso = new Date().toISOString();

    // 1. 檢查申請單存在同埋狀態係 pending
    const { data: application, error: fetchError } = await supabaseAdmin
      .from("tutor_applications")
      .select("id, user_id, status")
      .eq("id", applicationId)
      .single();

    if (fetchError) {
      console.error("Fetch application error:", fetchError);
      throw new Error(`Failed to fetch application: ${fetchError.message}`);
    }

    if (!application) {
      throw new Error("Application not found.");
    }

    if ((application.status ?? "").toLowerCase() !== "pending") {
      throw new Error(`Application is not pending. Current status: ${application.status}`);
    }

    // 2. 更新申請單狀態為 rejected
    const { error: updateError } = await supabaseAdmin
      .from("tutor_applications")
      .update({
        status: "rejected",
        reviewed_at: nowIso,
        reviewer_id: adminId,
      })
      .eq("id", applicationId);

    if (updateError) {
      console.error("Update application error:", updateError);
      throw new Error(`Failed to reject application: ${updateError.message}`);
    }

    // 3. (可選) 更新 profile 嘅 role 返去 user
    if (applicantUserId) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ role: "user" })
        .eq("id", applicantUserId);

      if (profileError) {
        console.warn("Failed to update profile role:", profileError);
        // 唔好 throw，因為主要操作已經完成
      }
    }

    console.log("Application rejected successfully");

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Reject function error:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Internal Server Error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});