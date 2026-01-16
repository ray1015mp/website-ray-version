// supabase/functions/analyze-speech/index.ts (Final, Absolutely Corrected Version)

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ==============================================================================
// 核心資源與輔助函數 (這部分完全沒有變更 )
// ==============================================================================

const CMUDICT_PHONEMES: string[] = [
    'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h',
    'tʃ', 'dʒ', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j', 'i', 'ɪ', 'ɛ', 'æ', 'u',
    'ʊ', 'ɑ', 'ʌ', 'ə', 'aɪ', 'aʊ', 'ɔɪ', 'eɪ', 'oʊ', 'ɝ'
];
const SORTED_CMUDICT_PHONEMES = [...CMUDICT_PHONEMES].sort((a, b ) => b.length - a.length);

function cleanIpaString(ipaString: string): string {
    if (!ipaString) return '';
    return ipaString.replace(/ɡ/g, 'g').replace(/ɫ/g, 'l').replace(/ɹ/g, 'r')
                    .replace(/[ˈˌː]/g, "").replace(/[\/\[\]()]/g, '').trim();
}

function segmentIpa(ipaString: string): string[] {
    const phonemes: string[] = [];
    const cleanedIpa = cleanIpaString(ipaString);
    let i = 0;
    while (i < cleanedIpa.length) {
        const match = SORTED_CMUDICT_PHONEMES.find(p => cleanedIpa.startsWith(p, i));
        if (match) {
            phonemes.push(match);
            i += match.length;
        } else { i += 1; }
    }
    return phonemes;
}

interface AlignmentError {
    type: 'Substitution' | 'Deletion' | 'Insertion';
    target: string | null;
    actual: string | null;
}

function alignAndFindErrors(targetPhonemes: string[], actualPhonemes: string[]): {
    errors: AlignmentError[], errorCount: number, alignedTarget: string[], alignedActual: string[]
} {
    const substitutionCost = 1, indelCost = 1;
    const n = targetPhonemes.length, m = actualPhonemes.length;
    type DP_Cell = { cost: number, dir: 'diag' | 'left' | 'up' | '' };
    const dp: DP_Cell[][] = Array(n + 1).fill(null).map(() => Array(m + 1).fill({ cost: 0, dir: '' }));
    for (let i = 1; i <= n; i++) dp[i][0] = { cost: i * indelCost, dir: 'up' };
    for (let j = 1; j <= m; j++) dp[0][j] = { cost: j * indelCost, dir: 'left' };
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = targetPhonemes[i - 1] === actualPhonemes[j - 1] ? 0 : substitutionCost;
            const scores: DP_Cell[] = [
                { cost: dp[i - 1][j - 1].cost + cost, dir: 'diag' as const },
                { cost: dp[i][j - 1].cost + indelCost, dir: 'left' as const },
                { cost: dp[i - 1][j].cost + indelCost, dir: 'up' as const }
            ];
            dp[i][j] = scores.reduce((min, s) => s.cost < min.cost ? s : min, scores[0]);
        }
    }
    const errors: AlignmentError[] = [];
    const alignedTarget: string[] = [];
    const alignedActual: string[] = [];
    let i = n, j = m;
    while (i > 0 || j > 0) {
        const direction = dp[i][j].dir;
        if (direction === 'diag') {
            const targetPhoneme = targetPhonemes[i - 1];
            const actualPhoneme = actualPhonemes[j - 1];
            alignedTarget.push(targetPhoneme); alignedActual.push(actualPhoneme);
            if (targetPhoneme !== actualPhoneme) errors.push({ type: 'Substitution', target: targetPhoneme, actual: actualPhoneme });
            i--; j--;
        } else if (direction === 'up') {
            alignedTarget.push(targetPhonemes[i - 1]); alignedActual.push('-');
            errors.push({ type: 'Deletion', target: targetPhonemes[i - 1], actual: null });
            i--;
        } else {
            alignedTarget.push('-'); alignedActual.push(actualPhonemes[j - 1]);
            errors.push({ type: 'Insertion', target: null, actual: actualPhonemes[j - 1] });
            j--;
        }
    }
    return { errors: errors.reverse(), errorCount: errors.length, alignedTarget: alignedTarget.reverse(), alignedActual: alignedActual.reverse() };
}

function getErrorPhonemes(errors: AlignmentError[]): string[] {
    const errorPhonemes = errors
        .filter(err => (err.type === 'Substitution' || err.type === 'Deletion') && err.target)
        .map(err => err.target!);
    return [...new Set(errorPhonemes)].sort();
}

function getDynamicErrorThreshold(phonemeCount: number): number {
    if (phonemeCount <= 2) return phonemeCount + 1;
    if (phonemeCount >= 3 && phonemeCount <= 5) return 2;
    if (phonemeCount >= 6) return 3;
    return 3;
}

function areErrorsOnlyInsertion(errors: AlignmentError[]): boolean {
    if (errors.length === 0) return false;
    return errors.every(err => err.type === 'Insertion');
}

// ==============================================================================
// 主服務函數 (最終、絕對正確版)
// ==============================================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    // 1. 解析請求 (不變)
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const targetWord = formData.get('target_word') as string;
    const language = formData.get('language') as string;

    if (!(audioFile instanceof File) || !targetWord || !language) {
      throw new Error('Missing file, target_word, or language parameter.');
    }

    // 2. 初始化 Supabase 客戶端並調用 ASR (不變)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const urlKey = `ASR_URL_${language.toUpperCase()}`;
    const { data: urlData, error: urlError } = await supabaseAdmin.from('secure_storage').select('key_value').eq('key_name', urlKey).single();
    if (urlError || !urlData) throw new Error(`Could not find ASR URL for language '${language}'.`);
    const asrServerUrl = urlData.key_value;

    const apiKeyKey = 'ASR_API_KEY';
    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin.from('secure_storage').select('key_value').eq('key_name', apiKeyKey).single();
    if (apiKeyError || !apiKeyData) throw new Error('Could not find ASR API Key.');
    const apiKey = apiKeyData.key_value;

    const asrRequestData = new FormData();
    asrRequestData.append('file', audioFile);
    asrRequestData.append('target_word', targetWord);
    const headers = { 'Authorization': `Bearer ${apiKey}` };

    const asrResponse = await fetch(asrServerUrl, { method: 'POST', headers, body: asrRequestData });
    if (!asrResponse.ok) {
      const errorBody = await asrResponse.text();
      throw new Error(`ASR server returned an error: ${asrResponse.status} ${errorBody}`);
    }
    // ✨✨✨【核心修正 1】: asrResult 現在是我們唯一的數據源 ✨✨✨
    const asrResult = await asrResponse.json();

    // 3. 執行發音分析 (不變)
    const targetPhonemes = segmentIpa(asrResult.target_ipa);
    const userPhonemes = segmentIpa(asrResult.asr_ipa);
    const { errors, errorCount, alignedTarget, alignedActual } = alignAndFindErrors(targetPhonemes, userPhonemes);
    const errorPhonemes = getErrorPhonemes(errors);

    // 4. 獲取用戶 ID (不變)
    const authHeader = req.headers.get('Authorization')!;
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
        throw new Error("User not found or invalid token.");
    }
    const userId = user.id;

    // 5. 根據您的 `if/else` 方案決定日誌內容
    const { data: userStatus, error: userStatusError } = await supabaseAdmin
        .from('user_status')
        .select('cur_lvl')
        .eq('user_id', userId)
        .eq('language', language)
        .single();

    if (userStatusError) {
        console.error(`Could not fetch user level for ${userId}:`, userStatusError.message);
    }
    const currentLevel = userStatus?.cur_lvl || 'Primary-School';
    const isInitialTest = currentLevel.startsWith('initial_test_');

    let fullLogText = '';
    const errorSummaryForDb = errorPhonemes.join(', ');

    const allPhonemes = [...alignedTarget, ...alignedActual];
    const maxLen = allPhonemes.length > 0 ? Math.max(...allPhonemes.map(p => p.length)) : 1;
    const formatPhoneme = (p: string) => p.padEnd(maxLen, ' ');
    const targetLine = alignedTarget.map(formatPhoneme).join(' ');
    const userLine = alignedActual.map(formatPhoneme).join(' ');

    const baseLog = `【Diagnosis Layer】
  - Target: '${asrResult.target_word}', Possible IPAs: ['${asrResult.target_ipa || ''}']
  - User Input: ${asrResult.asr_ipa}
【Phoneme Alignment】
  Target: [ ${targetLine} ]
  User  : [ ${userLine} ]
  - Diagnosis Complete: Found ${errorCount} error(s) in a ${targetPhonemes.length}-phoneme word.
  - Detected Errors: [${errorPhonemes.map(p => `'${p}'`).join(', ')}]`;

    if (isInitialTest) {
        fullLogText = baseLog;
    } else {
        let decisionLog = `\n【Decision & Generation Layer】\n`;
        const phonemeCount = targetPhonemes.length;
        const allowedErrors = getDynamicErrorThreshold(phonemeCount);

        if (errorCount > allowedErrors) {
            decisionLog += `  - Decision: The number of errors (${errorCount}) is too high for a word of this length (threshold: ${allowedErrors}). Let's try this word again.`;
        } else if (errorCount === 0) {
            decisionLog += "  - Decision: Perfect pronunciation! No practice needed.";
        } else if (areErrorsOnlyInsertion(errors)) {
            decisionLog += "  - Decision: Only insertion errors. Your pronunciation is very accurate! You just added some extra sounds. Try to match the target word's syllables exactly.";
        } else {
            const trainablePhonemes = getErrorPhonemes(errors);
            decisionLog += `  - Decision: Initiating practice generation for [${trainablePhonemes.map(p => `'${p}'`).join(', ')}].`;
            
            // ✨✨✨【核心修正 2】: 直接使用 asrResult 中的 suggest_word ✨✨✨
            const suggestWord = asrResult.suggest_word;

            if (suggestWord) {
                decisionLog += `\n      ➡️  Recommended Practice Word: "${suggestWord}"`;
            } else {
                decisionLog += `\n      ➡️  Could not generate a practice word for [${trainablePhonemes.map(p => `'${p}'`).join(', ')}] at this difficulty.`;
            }
        }
        fullLogText = baseLog.replace('【Phoneme Alignment】', `  - Difficulty Level: ${currentLevel}\n【Phoneme Alignment】`) + decisionLog;
    }

    // 6. 更新 user_status 表 (不變)
    const { error: updateError } = await supabaseAdmin
      .from('user_status')
      .update({
        cur_err: errorSummaryForDb,
        cur_log: fullLogText,
      })
      .eq('user_id', userId)
      .eq('language', language);

    if (updateError) {
      console.error(`Failed to update user_status for user ${userId}:`, updateError);
    }

    // 7. 返回響應 (只返回最基礎的分析結果，不包含建議單詞)
    const clientResponse = {
        target_word: asrResult.target_word,
        possible_ipa: asrResult.possible_ipa,
        user_ipa: asrResult.asr_ipa,
        aligned_target: alignedTarget,
        aligned_user: alignedActual,
        error_count: errorCount,
        phoneme_count: targetPhonemes.length,
        error_summary: errorPhonemes
    };

    return new Response(
      JSON.stringify(clientResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge Function Internal Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
