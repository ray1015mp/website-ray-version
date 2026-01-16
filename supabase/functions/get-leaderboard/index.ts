// supabase/functions/get-leaderboard/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // 為了方便開發 ，暫時設為 *
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, username');

    if (profilesError) throw profilesError;

    const { data: practiceData, error: practiceError } = await supabaseAdmin
      .from('practice_sessions')
      .select('user_id, error_rate');

    if (practiceError) throw practiceError;

    const userStats: { [key: string]: any } = {};

    profiles.forEach(profile => {
      userStats[profile.id] = {
        id: profile.id,
        username: profile.username,
        practice_count: 0,
        total_error_rate: 0,
      };
    });

    practiceData.forEach(session => {
      if (userStats[session.user_id]) {
        userStats[session.user_id].practice_count += 1;
        userStats[session.user_id].total_error_rate += session.error_rate || 0;
      }
    });

    const leaderboard = Object.values(userStats)
      .map(user => {
        const average_accuracy = user.practice_count > 0
          ? (1 - (user.total_error_rate / user.practice_count)) * 100
          : 0;
        
        return {
          id: user.id,
          username: user.username,
          practice_count: user.practice_count,
          average_accuracy: parseFloat(average_accuracy.toFixed(2)),
        };
      })
      .filter(user => user.practice_count > 0);

    return new Response(JSON.stringify(leaderboard), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
