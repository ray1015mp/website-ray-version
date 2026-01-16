// supabase/functions/generate-contextual-question/index.ts
import { serve } from "https://deno.land/std@0.181.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const poeApiKey = Deno.env.get("POE_API_KEY") ?? "";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// 10 個主題選項
const TOPICS = {
  en: [
    { id: "daily_life", name: "Daily Life", icon: "🏠" },
    { id: "school", name: "School", icon: "🏫" },
    { id: "family", name: "Family", icon: "👨‍👩‍👧‍👦" },
    { id: "food", name: "Food & Drinks", icon: "🍔" },
    { id: "weather", name: "Weather", icon: "🌤️" },
    { id: "animals", name: "Animals", icon: "🐾" },
    { id: "sports", name: "Sports & Games", icon: "⚽" },
    { id: "shopping", name: "Shopping", icon: "🛒" },
    { id: "health", name: "Health & Body", icon: "🏥" },
    { id: "transport", name: "Transportation", icon: "🚌" },
  ],
  zh: [
    { id: "daily_life", name: "日常生活", icon: "🏠" },
    { id: "school", name: "學校", icon: "🏫" },
    { id: "family", name: "家庭", icon: "👨‍👩‍👧‍👦" },
    { id: "food", name: "食物與飲料", icon: "🍔" },
    { id: "weather", name: "天氣", icon: "🌤️" },
    { id: "animals", name: "動物", icon: "🐾" },
    { id: "sports", name: "運動與遊戲", icon: "⚽" },
    { id: "shopping", name: "購物", icon: "🛒" },
    { id: "health", name: "健康與身體", icon: "🏥" },
    { id: "transport", name: "交通工具", icon: "🚌" },
  ],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // GET 請求：返回主題列表
  if (req.method === "GET") {
    const url = new URL(req.url);
    const language = url.searchParams.get("language") || "en";
    const topics = TOPICS[language as keyof typeof TOPICS] || TOPICS.en;
    
    return new Response(
      JSON.stringify({ topics }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // POST 請求：生成情境問答
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
    const { userId, topic, level, language } = await req.json();

    console.log("Generate contextual question request:", { userId, topic, level, language });

    if (!userId || !topic) {
      throw new Error("User ID and topic are required");
    }

    // 獲取主題名稱
    const topicList = TOPICS[language as keyof typeof TOPICS] || TOPICS.en;
    const topicInfo = topicList.find(t => t.id === topic);
    const topicName = topicInfo?.name || topic;

    // 使用 Poe AI 生成情境問答
    const question = await generateQuestionWithPoeAI({
      topic: topicName,
      level: level || "Primary-School",
      language: language || "en",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        question,
        topic: topicName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Generate question error:", error);
    return new Response(
      JSON.stringify({ error: error.message ?? "Internal Server Error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ===== 使用 Poe AI 生成情境問答 =====
async function generateQuestionWithPoeAI(params: {
  topic: string;
  level: string;
  language: string;
}) {
  const { topic, level, language } = params;
  const isChinese = language === "zh" || language === "zh-HK" || language === "zh-TW";

  // 根據難度調整複雜度
  const levelDescriptions: Record<string, string> = {
    "kindergarten": "very simple, 3-5 word sentences for 4-6 year olds",
    "Kindergarten": "very simple, 3-5 word sentences for 4-6 year olds",
    "primary-school": "simple, 5-10 word sentences for 7-12 year olds",
    "Primary-School": "simple, 5-10 word sentences for 7-12 year olds",
    "middle-school": "moderate complexity, 10-15 word sentences for teenagers",
    "Middle-School": "moderate complexity, 10-15 word sentences for teenagers",
    "adult": "natural conversation level for adults",
    "Adult": "natural conversation level for adults",
  };

  const levelDesc = levelDescriptions[level] || levelDescriptions["primary-school"];

  const prompt = `You are a speech therapy dialogue generator. Create a contextual dialogue question for pronunciation practice.

Topic: ${topic}
Difficulty Level: ${level} (${levelDesc})
Language: ${isChinese ? "Traditional Chinese" : "English"}

Generate a JSON object with:
1. "scenario": A brief description of the situation (1 sentence, ${isChinese ? "in Traditional Chinese" : "in English"})
2. "question": A question someone might ask in this scenario (${isChinese ? "in Traditional Chinese" : "in English"})
3. "expectedAnswer": The appropriate response/answer to practice saying (${isChinese ? "in Traditional Chinese" : "in English"})
4. "hint": A helpful hint for the student (${isChinese ? "in Traditional Chinese" : "in English"})
5. "keyPhrases": An array of 2-3 key phrases from the expected answer to focus on

The question and answer should be:
- Natural and commonly used in real life
- Appropriate for the difficulty level
- Focused on clear pronunciation practice
- Related to the topic

Return ONLY valid JSON, no markdown, no explanation.

Example format for English:
{"scenario":"You are at a restaurant ordering food.","question":"What would you like to drink?","expectedAnswer":"I would like a glass of orange juice, please.","hint":"Remember to say 'please' at the end!","keyPhrases":["glass of","orange juice","please"]}

Example format for Chinese:
{"scenario":"你在餐廳點餐。","question":"請問你想喝什麼？","expectedAnswer":"我想要一杯柳橙汁，謝謝。","hint":"記得說「謝謝」表示禮貌！","keyPhrases":["一杯","柳橙汁","謝謝"]}`;

  if (!poeApiKey) {
    return generateDefaultQuestion(params);
  }

  try {
    console.log("Calling Poe AI API for contextual question...");

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
        temperature: 0.8,
        max_tokens: 500,
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
      if (parsed.scenario && parsed.question && parsed.expectedAnswer) {
        console.log("Successfully generated question:", parsed);
        return parsed;
      }
    }
  } catch (error) {
    console.error("Poe AI error:", error);
  }

  return generateDefaultQuestion(params);
}

// ===== 生成預設問題 =====
function generateDefaultQuestion(params: {
  topic: string;
  level: string;
  language: string;
}) {
  const { topic, language } = params;
  const isChinese = language === "zh" || language === "zh-HK" || language === "zh-TW";

  // 預設問題庫
  const defaultQuestions = {
    en: {
      "Daily Life": {
        scenario: "You are greeting your neighbor in the morning.",
        question: "How are you today?",
        expectedAnswer: "I am doing well, thank you. How about you?",
        hint: "Speak clearly and with a friendly tone!",
        keyPhrases: ["doing well", "thank you", "How about you"],
      },
      "School": {
        scenario: "You are asking your teacher for help.",
        question: "Can I ask you a question?",
        expectedAnswer: "Excuse me, teacher. Can you help me with this problem?",
        hint: "Remember to be polite!",
        keyPhrases: ["Excuse me", "Can you help", "this problem"],
      },
      "default": {
        scenario: "You are introducing yourself to someone new.",
        question: "What is your name?",
        expectedAnswer: "Hello, my name is... Nice to meet you!",
        hint: "Speak slowly and clearly!",
        keyPhrases: ["Hello", "my name is", "Nice to meet you"],
      },
    },
    zh: {
      "日常生活": {
        scenario: "你早上遇到鄰居打招呼。",
        question: "你今天好嗎？",
        expectedAnswer: "我很好，謝謝你。你呢？",
        hint: "用友善的語氣說話！",
        keyPhrases: ["我很好", "謝謝你", "你呢"],
      },
      "學校": {
        scenario: "你想問老師一個問題。",
        question: "我可以問你一個問題嗎？",
        expectedAnswer: "老師，請問您可以幫我看看這個題目嗎？",
        hint: "記得要有禮貌！",
        keyPhrases: ["老師", "請問", "幫我"],
      },
      "default": {
        scenario: "你在向新朋友自我介紹。",
        question: "你叫什麼名字？",
        expectedAnswer: "你好，我叫...，很高興認識你！",
        hint: "說話要清楚！",
        keyPhrases: ["你好", "我叫", "很高興認識你"],
      },
    },
  };

  const langQuestions = isChinese ? defaultQuestions.zh : defaultQuestions.en;
  return langQuestions[topic as keyof typeof langQuestions] || langQuestions.default;
}
