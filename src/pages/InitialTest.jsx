// src/pages/InitialTest.jsx (Final Version with "Save and Force Reload" Logic)

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useReactMediaRecorder } from 'react-media-recorder';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from '../supabaseClient';
import { 
  postInitialTestResult, 
  markTestAsCompleted,
  getInitialTestProgress,
  updateInitialTestProgress,
  getPracticeRecords,
  saveTrainingPlan
} from '../api/supabaseAPI'; 
import ConfirmDialog from '../components/ConfirmDialog';
import initialWordData from '../data/initial-test-words.json'; 
import '../styles/Practice.css';
import '../styles/Layout.css';
import '../styles/InitialTest.css';

// --- 輔助函數 (保持不變) ---
const difficultyLevels = ['Kindergarten', 'Primary-School', 'Secondary-School', 'Adult'];
const totalCount = 20;

const getDifficultyLevel = (count) => {
  const difficultyIndex = Math.floor((count - 1) / 5);
  return difficultyLevels[difficultyIndex] || difficultyLevels[difficultyLevels.length - 1];
};

const getNextTestWord = (progressCount) => {
  const currentDifficulty = getDifficultyLevel(progressCount);
  const wordList = initialWordData[currentDifficulty] || []; 
  if (wordList.length === 0) return "Error: Word list empty for this level.";
  return wordList[Math.floor(Math.random() * wordList.length)];
};

const generateMonthlyPlan = (level) => {
  const weeklyFocus = {
    'Kindergarten': ["基礎單音", "簡單雙音", "常見字詞", "看圖說詞"],
    'Primary-School': ["短母音 vs 長母音", "子音辨別", "生活對話", "短句練習"],
    'Secondary-School': ["複雜母音 (diphthongs)", "多音節字", "語調與重音", "主題式字彙"],
    'Adult': ["進階音標 (r-controlled, etc.)", "流暢度訓練", "商業或學術詞彙", "自由對話模擬"]
  };
  const focus = weeklyFocus[level] || weeklyFocus['Primary-School'];
  return {
    weeks: [
      { week: 1, focus: focus[0], goal: "每週完成 3 次練習", completed: false },
      { week: 2, focus: focus[1], goal: "挑戰更高難度單字", completed: false },
      { week: 3, focus: focus[2], goal: "練習時長增加 20%", completed: false },
      { week: 4, focus: focus[3], goal: "總結錯誤，鞏固學習", completed: false }
    ]
  };
};

// =================================================================
// ==   InitialTest 組件
// =================================================================
export default function InitialTest({ onTestComplete, practiceLanguage }) {
  const { t } = useTranslation();
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;
  
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [mediaError, setMediaError] = useState(null);
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const { status, startRecording, stopRecording, clearBlobUrl } = useReactMediaRecorder({ 
    audio: true,
    blobPropertyBag: { type: 'audio/wav' },
    onStop: (blobUrl, blob) => {
      analyzeRecording({ 
        audioBlob: blob, 
        word: currentWord, 
        lang: practiceLanguage 
      });
    }
  });

  const queryKey = ['initialTestProgress', userId, practiceLanguage];

  const { data: testProgress, isLoading: isLoadingProgress, isError } = useQuery({
    queryKey: queryKey,
    queryFn: () => getInitialTestProgress(userId, practiceLanguage),
    enabled: !!userId && !!practiceLanguage,
    staleTime: Infinity,
    refetchOnWindowFocus: false, 
  });

  const progressCount = useMemo(() => {
    if (!testProgress?.cur_lvl || !testProgress.cur_lvl.startsWith('initial_test_')) return 1;
    return parseInt(testProgress.cur_lvl.split('_')[2], 10) || 1;
  }, [testProgress]);

  const currentWord = useMemo(() => testProgress?.cur_word, [testProgress]);
  const hasDiagnosisLog = useMemo(() => !!testProgress?.cur_log, [testProgress]);

  const { mutate: updateTestState, isPending: isUpdatingState } = useMutation({
    mutationFn: async (updates) => {
      await updateInitialTestProgress(userId, practiceLanguage, updates);
    },
    onMutate: async (newUpdates) => {
      await queryClient.cancelQueries({ queryKey: queryKey });
      const previousState = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, old => ({ ...old, ...newUpdates }));
      return { previousState };
    },
    onError: (err, newUpdates, context) => {
      queryClient.setQueryData(queryKey, context.previousState);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey });
    },
  });

  const { mutate: finishTestAndReload, isPending: isFinishing } = useMutation({
    mutationFn: async ({ isSkip = false }) => {
      const sessionData = {
        user_id: userId,
        language: practiceLanguage,
        target_word: currentWord,
        error_rate: isSkip ? 1.0 : (testProgress?.cur_log?.match(/Found (\d+) error/)?.[1] || 0) / (testProgress?.cur_log?.match(/in a (\d+)-phoneme/)?.[1] || 1),
        full_log: isSkip ? JSON.stringify({ status: 'skipped' }) : testProgress?.cur_log,
        diffi_level: 'initial_test'
      };

      
      await postInitialTestResult(sessionData);

      const records = await getPracticeRecords(userId);
      const initialTestRecords = records.filter(rec => rec.diffi_level === 'initial_test').slice(0, 20);
      
      let avgErrorRate = 0;
      if (initialTestRecords.length > 0) {
        const totalErrorRate = initialTestRecords.reduce((sum, rec) => {
          const rate = (rec.error_rate || 0) > 1 ? 1 : (rec.error_rate || 0);
          return sum + rate;
        }, 0);
        avgErrorRate = (totalErrorRate / initialTestRecords.length) * 100;
      }

      let sug_lvl = 'Kindergarten';
      if (avgErrorRate < 25) sug_lvl = 'Adult';
      else if (avgErrorRate < 50) sug_lvl = 'Secondary-School';
      else if (avgErrorRate < 75) sug_lvl = 'Primary-School';

      const planDetails = generateMonthlyPlan(sug_lvl);
     
      await Promise.all([
      markTestAsCompleted(userId, practiceLanguage, sug_lvl),
      updateInitialTestProgress(userId, practiceLanguage, { cur_lvl: sug_lvl, cur_word: null }),

      // 以新的方式呼叫 saveTrainingPlan
      saveTrainingPlan({
        user_id: userId,
        plan_data: planDetails,
        sug_lvl: sug_lvl,
        generated_at: new Date().toISOString(),
        is_active: true,
      }),
    ]);
  },
  onSuccess: () => {
    window.location.reload();
  },
  onError: (error) => {
    console.error("Failed to finish test and save data:", error);
    alert("An error occurred while finishing the test. Please try again.");
  },
});

  const { mutate: advanceToNextWord, isPending: isAdvancing } = useMutation({
    mutationFn: async ({ isSkip = false }) => {
      const sessionData = {
        user_id: userId,
        language: practiceLanguage,
        target_word: currentWord,
        error_rate: isSkip ? 1.0 : (testProgress?.cur_log?.match(/Found (\d+) error/)?.[1] || 0) / (testProgress?.cur_log?.match(/in a (\d+)-phoneme/)?.[1] || 1),
        full_log: isSkip ? JSON.stringify({ status: 'skipped' }) : testProgress?.cur_log,
        diffi_level: 'initial_test'
      };
      await postInitialTestResult(sessionData);
      
      const newProgressCount = progressCount + 1;
      const nextWord = getNextTestWord(newProgressCount);
      const updates = {
        cur_lvl: `initial_test_${newProgressCount}`,
        cur_word: nextWord,
        cur_log: null,
      };
      await updateInitialTestProgress(userId, practiceLanguage, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKey });
      clearBlobUrl();
    },
    onError: (error) => console.error("Failed to advance to next word:", error),
  });

  const { mutate: analyzeRecording, isPending: isAnalyzingRecording } = useMutation({
    mutationFn: async ({ audioBlob, word, lang }) => {
      if (!audioBlob || !word || !lang || audioBlob.size === 0) throw new Error(`[FRONTEND CHECK FAILED] Cannot analyze.`);
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('target_word', word);
      formData.append('language', lang);
      const { data, error } = await supabase.functions.invoke('analyze-speech', { body: formData });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const errorJson = await error.context.json();
          throw new Error(`Analysis failed: ${errorJson.error || error.message}`);
        }
        throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKey }); },
    onError: (error) => { console.error("Analysis mutation failed:", error); alert(error.message); clearBlobUrl(); },
  });

  useEffect(() => {
    if (testProgress && !testProgress.cur_word && !isUpdatingState && !isAdvancing && !isFinishing) {
      const firstWord = getNextTestWord(1);
      updateTestState({ cur_lvl: 'initial_test_1', cur_word: firstWord });
    }
  }, [testProgress, isUpdatingState, isAdvancing, isFinishing, updateTestState]);

  useEffect(() => {
    let intervalId;
    if (isRecording) {
      intervalId = setInterval(() => setTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(intervalId);
  }, [isRecording]);

  useEffect(() => {
    if (status === 'recording') setIsRecording(true);
    if (status === 'error') {
      setMediaError('Could not access the microphone. Please check your browser permissions.');
      setIsRecording(false);
    }
    if (status === 'stopped') {
      setIsRecording(false);
      setTimer(0);
    }
  }, [status]);

  const formatTime = (seconds) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      setMediaError(null);
      clearBlobUrl();
      setTimer(0);
      startRecording();
    }
  };

  const handleTryAnother = () => {
    if (isUpdatingState) return;
    const currentDifficulty = getDifficultyLevel(progressCount);
    const wordList = initialWordData[currentDifficulty] || [];
    if (wordList.length <= 1) return;
    let newWord;
    do {
      newWord = wordList[Math.floor(Math.random() * wordList.length)];
    } while (newWord === currentWord);
    updateTestState({ cur_word: newWord });
  };

  const handleNextWord = () => {
    if (isAdvancing || isFinishing) return;
    if (progressCount >= totalCount) {
      finishTestAndReload({ isSkip: false });
    } else {
      advanceToNextWord({ isSkip: false });
    }
  };

  const handleSkipOrEnd = () => {
    if (isAdvancing || isFinishing) return;
    setDialogState({
      isOpen: true,
      title: progressCount >= totalCount ? 'End Test' : 'Skip Word',
      message: progressCount >= totalCount ? 'Are you sure you want to skip the last word and finish the test?' : 'Are you sure you want to skip this word?',
      onConfirm: () => {
        if (progressCount >= totalCount) {
          finishTestAndReload({ isSkip: true });
        } else {
          advanceToNextWord({ isSkip: true });
        }
      },
    });
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  };

  const isProcessing = isAnalyzingRecording || isAdvancing || isFinishing;

  if (isLoadingProgress) { return <main className="main-content width-practice"><div className="spinner"></div> Loading test...</main>; }
  if (isError) { return <main className="main-content width-practice"><p>Error loading test data. Please try again.</p></main>; }

  return (
    <>
      <main className="main-content width-practice">
        <div className="difficulty-section">
          <h3 className="section-title">{t('initialTest.title')} ({progressCount} / {totalCount})</h3>
        </div>
        <div className="practice-area">
          <p className="practice-text">{currentWord || '...'}</p>
          
          {!hasDiagnosisLog && (
            <div className="practice-controls">
              <button 
                className="practice-btn" 
                onClick={handleSkipOrEnd} 
                disabled={isProcessing || isRecording}
              >
                {progressCount >= totalCount 
                  ? t('initialTest.skipAndEnd', 'Skip and End') 
                  : t('initialTest.skip', 'Skip')
                }
              </button>
              
              {progressCount < totalCount && (
                <button 
                  className="practice-btn primary" 
                  onClick={handleTryAnother} 
                  disabled={isProcessing || isRecording}
                >
                  {isUpdatingState ? t('initialTest.coolingDown', 'Cooling Down...') : t('initialTest.tryAnother')}
                </button>
              )}
            </div>
          )}
        </div>

        {mediaError && <div className="media-error-alert">{mediaError}</div>}
        {status === 'acquiring_media' && <div className="media-info-alert">Please allow microphone access in your browser...</div>}

        {hasDiagnosisLog && (
          <div className="diagnosis-container" style={{ display: 'block' }}>
            <pre>{testProgress.cur_log}</pre>
            <div className="next-btn-wrapper">
              <button className="practice-btn primary" onClick={handleNextWord} disabled={isProcessing}>
                {isProcessing 
                  ? 'Saving...' 
                  : progressCount >= totalCount 
                    ? t('initialTest.finishTest', 'Finish Test & Get Plan!') 
                    : `${t('practicePage.next')} →`
                }
              </button>
            </div>
          </div>
        )}
      </main>
      
      <div className="audio-controls">
        <button className={`record-btn ${isRecording ? 'recording' : ''}`} onClick={handleRecordToggle} disabled={isProcessing || hasDiagnosisLog || status === 'acquiring_media'}>
          {isRecording ? (
            <div className="record-timer">{formatTime(timer)}</div>
          ) : (
            <div className="record-btn-content">
              <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14q-1.25 0-2.125-.875T9 11V5q0-1.25.875-2.125T12 2q1.25 0 2.125.875T15 5v6q0 1.25-.875 2.125T12 14Zm-1 7v-3.075q-2.6-.35-4.3-2.325T5 11H7q0 2.075 1.463 3.537T12 16q2.075 0 3.538-1.463T17 11h2q0 2.6-1.7 4.6T13 18.075V21h-2Z"/></svg>
              <span className="record-btn-text">{t('practicePage.record'  )}</span>
            </div>
          )}
        </button>
      </div>
      
      {isAnalyzingRecording && (
        <div id="custom-alert-overlay" className="visible">
          <div className="alert-box"><div className="spinner"></div><span className="alert-text">{t('practicePage.analyzing')}</span></div>
        </div>
      )}
      
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        onConfirm={() => {
          dialogState.onConfirm();
          closeDialog();
        }}
        onCancel={closeDialog}
      />
    </>
  );
}
