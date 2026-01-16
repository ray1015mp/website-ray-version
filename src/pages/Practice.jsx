// src/pages/Practice.jsx (Final Corrected Version, with the bug fixed)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useReactMediaRecorder } from 'react-media-recorder';
import { FunctionsHttpError } from '@supabase/supabase-js';

// API Imports
import { supabase } from '../supabaseClient';
import { 
  updateInitialTestProgress as updateUserStatus,
  getWeakestPhoneme,
  generatePracticeWord,
  postInitialTestResult as postPracticeSession
} from '../api/supabaseAPI';

import '../styles/Practice.css';
import '../styles/Layout.css';

// DiagnosisOutput Component (Unchanged)
const DiagnosisOutput = ({ logText }) => {
  if (!logText) return null;
  return <pre>{logText}</pre>;
};

// =================================================================
// ==   Practice Component (Final Corrected Version)              ==
// =================================================================

export default function Practice({ practiceLanguage, userStatus }) {
  const { t } = useTranslation();
  const session = useSession();
  const supabaseClient = useSupabaseClient();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  // --- Your Original States (Preserved) ---
  const [currentDifficulty, setCurrentDifficulty] = useState(
    userStatus?.cur_lvl || 'Primary-School'
  );
  const [currentWord, setCurrentWord] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [diagnosis, setDiagnosis] = useState(userStatus?.cur_log || null);
  const [generatedWords, setGeneratedWords] = useState([]);

  // --- All your mutations (Unchanged) ---
  const { mutate: triggerWordGeneration, isPending: isGeneratingWord } = useMutation({
    mutationFn: async () => {
      const phoneme = await getWeakestPhoneme(userId, practiceLanguage);
      const params = {
        phoneme: phoneme,
        difficulty_level: currentDifficulty.toLowerCase().replace(/-/g, '_'),
        language: practiceLanguage,
      };
      const result = await generatePracticeWord(params);
      const newWord = result.practice_word;
      if (!newWord) throw new Error("Generation service did not return a word.");
      await updateUserStatus(userId, practiceLanguage, { cur_word: newWord });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', userId] }),
    onError: (error) => alert(`Error generating word: ${error.message}`),
  });

  const { mutate: updateDifficulty } = useMutation({
    mutationFn: (newLevel) => 
      updateUserStatus(userId, practiceLanguage, { cur_lvl: newLevel }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', userId] }),
    onError: (error) => console.error("Failed to update difficulty level:", error)
  });

  const { mutate: diagnoseSpeech, isPending: isAnalyzing } = useMutation({
    mutationFn: async (audioBlob) => {
      if (!audioBlob || !currentWord) throw new Error("Missing audio or word for analysis.");
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('target_word', currentWord);
      formData.append('language', practiceLanguage);
      const { error } = await supabaseClient.functions.invoke('analyze-speech', { body: formData });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const errorJson = await error.context.json();
          throw new Error(`Analysis failed: ${errorJson.error || error.message}`);
        }
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', userId] }),
    onError: (error) => alert(error.message),
  });

  const { mutate: advanceToNextStep, isPending: isAdvancing } = useMutation({
    mutationFn: async () => { // 不再需要傳入 recommendedWord
      if (!diagnosis) return;
      const errorMatch = diagnosis.match(/Found (\d+) error\(s\) in a (\d+)-phoneme word/);
      const errorCount = errorMatch ? parseInt(errorMatch[1], 10) : 0;
      const phonemeCount = errorMatch ? parseInt(errorMatch[2], 10) || 1 : 1;
      const phonemeStats = {};
      const alignedTargetText = diagnosis.match(/Target: \[ (.*) \]/)?.[1];
      const alignedUserText = diagnosis.match(/User  : \[ (.*) \]/)?.[1];
      if (alignedTargetText && alignedUserText) {
        const targetPhonemes = alignedTargetText.trim().split(/\s+/);
        const userPhonemes = alignedUserText.trim().split(/\s+/);
        if (targetPhonemes.length === userPhonemes.length) {
          for (let i = 0; i < targetPhonemes.length; i++) {
            const targetPhoneme = targetPhonemes[i];
            if (targetPhoneme !== '-') {
              if (!phonemeStats[targetPhoneme]) phonemeStats[targetPhoneme] = { total_atmp: 0, err_amount: 0 };
              phonemeStats[targetPhoneme].total_atmp += 1;
              if (targetPhoneme !== userPhonemes[i]) phonemeStats[targetPhoneme].err_amount += 1;
            }
          }
        }
      }
      if (Object.keys(phonemeStats).length > 0) {
        await supabase.rpc('update_phoneme_summary_from_stats', { p_user_id: userId, p_language: practiceLanguage, p_stats: phonemeStats });
      }
      
      // 【核心修正】: 確保 diffi_level 使用的是最新的 userStatus.cur_lvl
      await postPracticeSession({
        user_id: userId, 
        language: practiceLanguage, 
        target_word: currentWord,
        diffi_level: userStatus.cur_lvl, // 直接從 props 獲取，保證準確性
        error_rate: errorCount / phonemeCount, 
        full_log: diagnosis,
      });

      const recommendedWordMatch = diagnosis.match(/Recommended Practice Word: "([^"]+)"/);
      const nextWord = recommendedWordMatch ? recommendedWordMatch[1] : null;
      await updateUserStatus(userId, practiceLanguage, { cur_word: nextWord, cur_log: null, cur_err: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    }
  });

  // --- Your useEffects (Unchanged) ---
  useEffect(() => {
    if (userStatus) {
        setCurrentWord(userStatus.cur_word || '');
        setDiagnosis(userStatus.cur_log || null);
        setCurrentDifficulty(userStatus.cur_lvl || 'Primary-School');
    }
    if (userStatus && !userStatus.cur_word && !isGeneratingWord) {
      triggerWordGeneration();
    }
  }, [userStatus, isGeneratingWord, triggerWordGeneration]);

  // --- Media Recorder Hook (Unchanged) ---
  const { status: recorderStatus, startRecording, stopRecording, clearBlobUrl } = useReactMediaRecorder({ 
    audio: true, blobPropertyBag: { type: 'audio/wav' }, 
    onStop: (blobUrl, blob) => diagnoseSpeech(blob)
  });

  useEffect(() => {
    let intervalId;
    if (isRecording) intervalId = setInterval(() => setTimer(prev => prev + 1), 1000);
    return () => clearInterval(intervalId);
  }, [isRecording]);

  // --- Event Handlers (handleRecordToggle is now fixed) ---
  const handleDifficultyChange = (level) => {
    setCurrentDifficulty(level);
    updateDifficulty(level);
  };

  // ✨✨✨【核心修正】: 恢復 `handleRecordToggle` 的正確邏輯 ✨✨✨
  const handleRecordToggle = useCallback(() => {
    if (isRecording) {
      setIsRecording(false); // 立即更新 UI
      stopRecording();      // 調用 hook 的停止函數
    } else {
      // 在開始錄音前，先執行異步的數據庫清理
      updateUserStatus(userId, practiceLanguage, { cur_log: null, cur_err: null }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['user', userId] });
      });
      // 同步更新 UI 狀態，確保按鈕立即變化
      setDiagnosis(null);
      setTimer(0);
      setIsRecording(true); // 關鍵：立即將 isRecording 設為 true
      startRecording();     // 調用 hook 的開始函數
    }
  }, [isRecording, stopRecording, startRecording, userId, practiceLanguage, queryClient]);

  const handleTryAgain = () => {
    setDiagnosis(null);
    updateUserStatus(userId, practiceLanguage, { cur_log: null, cur_err: null }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['user', userId] });
    });
  };

  const handleTryAnother = useCallback(() => {
    if (isGeneratingWord || diagnosis) return;
    triggerWordGeneration();
  }, [triggerWordGeneration, isGeneratingWord, diagnosis]);

  const handleNext = useCallback(() => {
    if (isAdvancing) return;
    // 不再需要傳遞參數
    advanceToNextStep();
  }, [isAdvancing, advanceToNextStep]);

  // --- Your other variables (Unchanged) ---
  const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const difficultyLevels = [
    { id: 'Kindergarten', label: 'kindergarten' },
    { id: 'Primary-School', label: 'primary_school' },
    { id: 'Secondary-School', label: 'middle_school' },
    { id: 'Adult', label: 'adult' }
  ];
  const isPostAnalysis = diagnosis !== null;
  const isProcessing = isGeneratingWord || isAnalyzing || isAdvancing;
  const interactionState = useMemo(() => {
    if (!diagnosis) return { type: 'PRACTICING' };
    if (diagnosis.includes("Recommended Practice Word:")) return { type: 'HAS_RECOMMENDATION', buttonText: 'Next' };
    if (diagnosis.includes("Let's try this word again") || diagnosis.includes("Only insertion errors")) return { type: 'TRY_AGAIN', buttonText: 'Try Again' };
    return { type: 'NEXT_WORD', buttonText: 'Next Word' };
  }, [diagnosis]);

  return (
    <>
      {/* --- Your JSX (Unchanged) --- */}
      <main className="main-content width-practice">
        <div className="difficulty-section">
          <h3 className="section-title">{t('practicePage.difficultyLevel')}</h3>
          <div className="difficulty-selector">
            {difficultyLevels.map(level => (
              <button 
                key={level.id} 
                className={currentDifficulty === level.id ? 'active' : ''} 
                onClick={() => handleDifficultyChange(level.id)}
                disabled={isProcessing || isPostAnalysis}
              >
                {t(`practicePage.levels.${level.label}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="practice-area">
          <p className="practice-text">
            {isGeneratingWord ? 'Generating word...' : (currentWord || '...')}
          </p>
          <div className="practice-controls">
            <button className="practice-btn" onClick={handleTryAgain} disabled={!isPostAnalysis || isAnalyzing}>
              {t('practicePage.tryAgain')}
            </button>
            <button 
              className="practice-btn primary" 
              onClick={handleTryAnother} 
              disabled={isPostAnalysis || isAnalyzing || isRecording || isGeneratingWord}
            >
              {t('practicePage.tryAnother')}
            </button>
          </div>
        </div>

        {isPostAnalysis && (
          <div className="diagnosis-container" style={{ display: 'block' }}>
            <DiagnosisOutput logText={diagnosis} />
            <div className="next-btn-wrapper">
              {interactionState.type === 'TRY_AGAIN' ? (
                  <button className="practice-btn primary" onClick={handleTryAgain} disabled={isProcessing}>
                      {interactionState.buttonText}
                  </button>
              ) : (
                  <button className="practice-btn primary" onClick={handleNext} disabled={isProcessing}>
                      {isAdvancing ? 'Saving...' : `${interactionState.buttonText} →`}
                  </button>
              )}
            </div>
          </div>
        )}
      </main>

      <div className="audio-controls">
        <button id="record-btn" className={`record-btn ${isRecording ? 'recording' : ''}`} onClick={handleRecordToggle} disabled={isAnalyzing || isPostAnalysis}>
          {isRecording ? (
            <div className="record-timer">{formatTime(timer)}</div>
          ) : (
            <div className="record-btn-content">
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14q-1.25 0-2.125-.875T9 11V5q0-1.25.875-2.125T12 2q1.25 0 2.125.875T15 5v6q0 1.25-.875 2.125T12 14Zm-1 7v-3.075q-2.6-.35-4.3-2.325T5 11H7q0 2.075 1.463 3.537T12 16q2.075 0 3.538-1.463T17 11h2q0 2.6-1.7 4.6T13 18.075V21h-2Z"/></svg>
              <span className="record-btn-text">{t('practicePage.record'    )}</span>
            </div>
          )}
        </button>
      </div>

      {(isGeneratingWord || isAnalyzing) && (
        <div id="custom-alert-overlay" className="visible">
          <div className="alert-box">
            <div className="spinner"></div>
            <span className="alert-text">{isGeneratingWord ? 'Generating...' : t('practicePage.analyzing')}</span>
          </div>
        </div>
      )}
    </>
  );
}
