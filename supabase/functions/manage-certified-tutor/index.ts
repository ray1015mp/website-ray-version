// supabase/functions/manage-certified-tutor/index.ts
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
    persistSession: false,
  },
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
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
    /**
     * Parse request body:
     * - action: 'suspend' | 'reinstate' | 'revoke'
     * - tutorId: the tutor's user_id
     * - adminId: the admin performing the action
     */
    const { action, tutorId, adminId } = await req.json();

    if (!action || !tutorId || !adminId) {
      return new Response(
        JSON.stringify({ error: "Missing action, tutorId, or adminId." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate action type
    const validActions = ["suspend", "reinstate", "revoke"];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ error: `Invalid action: ${action}. Must be one of: ${validActions.join(", ")}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get current tutor data
    const { data: tutor, error: tutorError } = await supabaseAdmin
      .from("tutors")
      .select("user_id, full_name, email, status")
      .eq("user_id", tutorId)
      .single();

    if (tutorError) {
      throw new Error(`Failed to fetch tutor: ${tutorError.message}`);
    }

    if (!tutor) {
      return new Response(
        JSON.stringify({ error: "Tutor not found." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const currentStatus = (tutor.status ?? "").toLowerCase();
    const nowIso = new Date().toISOString();

    // Determine new status based on action
    let newStatus: string;
    switch (action) {
      case "suspend":
        if (currentStatus === "suspended") {
          return new Response(
            JSON.stringify({ error: "Tutor is already suspended." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        if (currentStatus === "revoked") {
          return new Response(
            JSON.stringify({ error: "Cannot suspend a revoked tutor." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        newStatus = "suspended";
        break;

      case "reinstate":
        if (currentStatus !== "suspended") {
          return new Response(
            JSON.stringify({ error: "Only suspended tutors can be reinstated." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        newStatus = "active";
        break;

      case "revoke":
        if (currentStatus === "revoked") {
          return new Response(
            JSON.stringify({ error: "Tutor is already revoked." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        newStatus = "revoked";
        break;

      default:
        throw new Error("Invalid action");
    }

    // Update tutor status
    const { error: updateTutorError } = await supabaseAdmin
      .from("tutors")
      .update({
        status: newStatus,
        updated_at: nowIso,
      })
      .eq("user_id", tutorId);

    if (updateTutorError) {
      throw new Error(`Failed to update tutor status: ${updateTutorError.message}`);
    }

    // If revoked, also update the profile role back to 'student'
    if (action === "revoke") {
      const { error: updateProfileError } = await supabaseAdmin
        .from("profiles")
        .update({
          role: "student",
          updated_at: nowIso,
        })
        .eq("id", tutorId);

      if (updateProfileError) {
        console.error(`Failed to update profile role: ${updateProfileError.message}`);
        // Don't throw, as tutor status update was successful
      }
    }

    // Log the action (optional - for audit purposes)
    console.log(`[manage-certified-tutor] Action: ${action}, Tutor: ${tutorId}, Admin: ${adminId}, NewStatus: ${newStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Tutor ${action === "reinstate" ? "reinstated" : action + "d"} successfully.`,
        tutorId,
        newStatus,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[manage-certified-tutor] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
