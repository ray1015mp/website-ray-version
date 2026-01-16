// supabase/functions/regenerate-training-plan/index.ts
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const poeApiKey = Deno.env.get("POE_API_KEY") ?? "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

serve(async (req) => {
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
    const { studentId, tutorId, instructions } = await req.json();

    console.log("Regenerate plan request:", { studentId, tutorId, instructions });

    if (!studentId) {
      throw new Error("Student ID is required");
    }

    // 1. 獲取學生資料
    const { data: studentProfile } = await supabaseAdmin
      .from("profiles")
      .select("username")
      .eq("id", studentId)
      .single();

    // 2. 獲取學生嘅 settings
    const { data: studentSettings } = await supabaseAdmin
      .from("user_settings")
      .select("sug_lvl, language")
      .eq("user_id", studentId)
      .single();

    // 3. 獲取學生嘅練習記錄
    const { data: practiceRecords } = await supabaseAdmin
      .from("practice_sessions")
      .select("target_word, error_rate, diffi_level, created_at")
      .eq("user_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20);

    // 4. 獲取學生嘅常見錯誤
    const { data: phonemeSummary } = await supabaseAdmin
      .from("user_progress_summary")
      .select("phoneme, err_amount, avg_err_rate")
      .eq("user_id", studentId)
      .order("err_amount", { ascending: false })
      .limit(5);

    // 5. 生成新計劃
    let newPlanData;

    if (poeApiKey) {
      newPlanData = await generatePlanWithPoeAI({
        studentName: studentProfile?.username || "Student",
        level: studentSettings?.sug_lvl || "Primary-School",
        language: studentSettings?.language || "en",
        practiceRecords: practiceRecords || [],
        weakPhonemes: phonemeSummary || [],
        tutorInstructions: instructions,
      });
    } else {
      newPlanData = generateDefaultPlan({
        level: studentSettings?.sug_lvl || "Primary-School",
        language: studentSettings?.language || "en",
        weakPhonemes: phonemeSummary || [],
        instructions: instructions,
      });
    }

    // 6. 將舊計劃設為 inactive
    await supabaseAdmin
      .from("training_plans")
      .update({ is_active: false })
      .eq("user_id", studentId)
      .eq("is_active", true);

    // 7. 插入新計劃
    const { data: newPlan, error: insertError } = await supabaseAdmin
      .from("training_plans")
      .insert({
        user_id: studentId,
        sug_lvl: studentSettings?.sug_lvl || "Primary-School",
        plan_data: newPlanData,
        is_active: true,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save new plan: ${insertError.message}`);
    }

    console.log("New plan created:", newPlan);

    return new Response(
      JSON.stringify({ 
        success: true, 
        plan: newPlan,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Regenerate plan error:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Internal Server Error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ===== 使用 Poe AI 生成計劃 =====
async function generatePlanWithPoeAI(params: {
  studentName: string;
  level: string;
  language: string;
  practiceRecords: any[];
  weakPhonemes: any[];
  tutorInstructions: string;
}) {
  const poeApiKey = Deno.env.get("POE_API_KEY");
  
  if (!poeApiKey) {
    return generateDefaultPlan({
      level: params.level,
      language: params.language,
      weakPhonemes: params.weakPhonemes,
      instructions: params.tutorInstructions,
    });
  }

  const weakPhonemesText = params.weakPhonemes
    .map(p => `${p.phoneme} (errors: ${p.err_amount}, avg error rate: ${p.avg_err_rate}%)`)
    .join(", ");

  // 格式化練習記錄詳情
  const practiceRecordsText = params.practiceRecords.length > 0
    ? params.practiceRecords
        .slice(0, 10) // 只取最近 10 筆避免 token 過多
        .map(r => `- "${r.target_word}" (difficulty: ${r.diffi_level}, error rate: ${Math.round(r.error_rate * 100)}%)`)
        .join("\n")
    : "No practice records yet";

  // 根據語言選擇 prompt
  const isChineseStudent = params.language === "zh" || params.language === "zh-HK" || params.language === "zh-TW";

  const prompt = `You are a speech therapy training plan generator. Create a personalized 4-week training plan for a student based on their practice history.

Student Information:
- Name: ${params.studentName}
- Level: ${params.level}
- Language: ${params.language}
- Total Practice Sessions: ${params.practiceRecords.length}

Weak Phonemes (most frequent errors):
${weakPhonemesText || "None identified yet"}

Recent Practice Records:
${practiceRecordsText}

${params.tutorInstructions ? `Tutor's Special Instructions: ${params.tutorInstructions}` : ""}

Based on this student's practice history and weak areas, generate a personalized JSON training plan. Focus on their weak phonemes and gradually increase difficulty.

Generate a JSON object with a "weeks" array containing exactly 4 weeks. Each week should have:
- "week": Week number (1-4)
- "focus": Main focus area for the week (${isChineseStudent ? "in Traditional Chinese" : "in English"})
- "goal": Specific goal for this week (${isChineseStudent ? "in Traditional Chinese" : "in English"})
- "completed": false (always false for new plans)

Return ONLY valid JSON, no markdown, no explanation.

Example format:
{"weeks":[{"week":1,"focus":"基礎單音","goal":"每週完成 3 次練習","completed":false},{"week":2,"focus":"簡單雙音","goal":"挑戰更高難度單字","completed":false},{"week":3,"focus":"常見字詞","goal":"練習時長增加 20%","completed":false},{"week":4,"focus":"看圖說詞","goal":"總結錯誤，鞏固學習","completed":false}]}`;

  try {
    console.log("Calling Poe AI API...");

    const response = await fetch("https://api.poe.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${poeApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: "You are a helpful speech therapy assistant. Always respond with valid JSON only. No markdown, no code blocks, just pure JSON." 
          },
          { 
            role: "user", 
            content: prompt 
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Poe API error:", errorText);
      throw new Error(`Poe API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      let cleanContent = content.trim();
      
      // 移除 markdown code blocks
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();

      const parsed = JSON.parse(cleanContent);
      
      // 驗證格式
      if (parsed.weeks && Array.isArray(parsed.weeks) && parsed.weeks.length >= 4) {
        console.log("Successfully parsed plan:", parsed);
        return parsed;
      }
    }
  } catch (error) {
    console.error("Poe AI error:", error);
  }

  return generateDefaultPlan({
    level: params.level,
    language: params.language,
    weakPhonemes: params.weakPhonemes,
    instructions: params.tutorInstructions,
  });
}

// ===== 生成預設計劃 =====
function generateDefaultPlan(params: {
  level: string;
  language: string;
  weakPhonemes: any[];
  instructions: string;
}) {
  const { level, language, weakPhonemes } = params;
  const isChinese = language === "zh" || language === "zh-HK" || language === "zh-TW";

  const plans: Record<string, any> = {
    "Kindergarten": {
      weeks: [
        { week: 1, focus: isChinese ? "基礎發音" : "Basic Sounds", goal: isChinese ? "每週完成 3 次練習" : "Complete 3 practice sessions", completed: false },
        { week: 2, focus: isChinese ? "簡單詞彙" : "Simple Words", goal: isChinese ? "學習 10 個新詞彙" : "Learn 10 new words", completed: false },
        { week: 3, focus: isChinese ? "圖片配對" : "Picture Matching", goal: isChinese ? "完成配對遊戲" : "Complete matching games", completed: false },
        { week: 4, focus: isChinese ? "複習鞏固" : "Review", goal: isChinese ? "總結學習成果" : "Summarize learning", completed: false },
      ]
    },
    "Primary-School": {
      weeks: [
        { week: 1, focus: isChinese ? "短母音 vs 長母音" : "Short vs Long Vowels", goal: isChinese ? "每週完成 3 次練習" : "Complete 3 practice sessions", completed: false },
        { week: 2, focus: isChinese ? "子音辨別" : "Consonant Distinction", goal: isChinese ? "挑戰更高難度單字" : "Challenge harder words", completed: false },
        { week: 3, focus: isChinese ? "生活對話" : "Daily Conversation", goal: isChinese ? "練習時長增加 20%" : "Increase practice time by 20%", completed: false },
        { week: 4, focus: isChinese ? "短句練習" : "Sentence Practice", goal: isChinese ? "總結錯誤，鞏固學習" : "Review errors and consolidate", completed: false },
      ]
    },
    "Secondary-School": {
      weeks: [
        { week: 1, focus: isChinese ? "進階發音" : "Advanced Pronunciation", goal: isChinese ? "掌握複雜音節" : "Master complex syllables", completed: false },
        { week: 2, focus: isChinese ? "連讀技巧" : "Linking Sounds", goal: isChinese ? "練習自然連讀" : "Practice natural linking", completed: false },
        { week: 3, focus: isChinese ? "語調練習" : "Intonation", goal: isChinese ? "改善語調表達" : "Improve intonation", completed: false },
        { week: 4, focus: isChinese ? "演講練習" : "Presentation", goal: isChinese ? "完成一次短講" : "Complete a short speech", completed: false },
      ]
    },
    "Adult": {
      weeks: [
        { week: 1, focus: isChinese ? "口音矯正" : "Accent Reduction", goal: isChinese ? "識別口音問題" : "Identify accent issues", completed: false },
        { week: 2, focus: isChinese ? "專業詞彙" : "Professional Terms", goal: isChinese ? "練習工作用語" : "Practice work vocabulary", completed: false },
        { week: 3, focus: isChinese ? "流暢度訓練" : "Fluency Training", goal: isChinese ? "提升說話流暢度" : "Improve speaking fluency", completed: false },
        { week: 4, focus: isChinese ? "實戰演練" : "Real Practice", goal: isChinese ? "模擬真實對話" : "Simulate real conversations", completed: false },
      ]
    },
  };

  let plan = plans[level] || plans["Primary-School"];
  
  // 如果有弱音素，調整第一週
  if (weakPhonemes && weakPhonemes.length > 0) {
    const topWeakPhoneme = weakPhonemes[0].phoneme;
    plan = JSON.parse(JSON.stringify(plan)); // Deep copy
    plan.weeks[0] = {
      week: 1,
      focus: isChinese ? `重點練習 /${topWeakPhoneme}/` : `Focus on /${topWeakPhoneme}/`,
      goal: isChinese ? `改善 /${topWeakPhoneme}/ 發音` : `Improve /${topWeakPhoneme}/ pronunciation`,
      completed: false,
    };
  }

  return plan;
}