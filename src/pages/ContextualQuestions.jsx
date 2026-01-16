// src/pages/ContextualQuestions.jsx
import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import Loader from '../components/Loader';
import '../styles/ContextualQuestions.css';

// 主題圖片映射
const TOPIC_IMAGES = {
  daily_life: '/images/topics/Daily_Life.png',
  school: '/images/topics/School.png',
  family: '/images/topics/Family.png',
  food: '/images/topics/Food&Drinks.png',
  weather: '/images/topics/Weather.png',
  animals: '/images/topics/Animals.png',
  sports: '/images/topics/Sports&Games.png',
  shopping: '/images/topics/Shopping.png',
  health: '/images/topics/Health&Body.png',
  transport: '/images/topics/Transportation.png',
};

// 10 個主題
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

// 獲取用戶設定
const getUserSettings = async (userId) => {
  const { data, error } = await supabase
    .from('user_settings')
    .select('sug_lvl, language')
    .eq('user_id', userId)
    .single();
  
  if (error) throw error;
  return data;
};

// 生成情境問題
const generateQuestion = async ({ userId, topic, level, language }) => {
  const { data, error } = await supabase.functions.invoke('generate-contextual-question', {
    body: { userId, topic, level, language },
  });
  
  if (error) throw error;
  return data;
};

// 保存練習記錄
const saveContextualSession = async (sessionData) => {
  const { data, error } = await supabase
    .from('contextual_question_sessions')
    .insert(sessionData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

// 分析語音
const analyzeSpeech = async ({ audioBlob, expectedText, language }) => {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('expected_text', expectedText);
  formData.append('language', language || 'en');

  const { data, error } = await supabase.functions.invoke('analyze-speech', {
    body: formData,
  });

  if (error) throw error;
  return data;
};

export default function ContextualQuestions() {
  const { t, i18n } = useTranslation();
  const session = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [selectedTopic, setSelectedTopic] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [showHint, setShowHint] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 獲取用戶設定
  const { data: userSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['userSettings', userId],
    queryFn: () => getUserSettings(userId),
    enabled: !!userId,
  });

  const language = userSettings?.language || i18n.language || 'en';
  const level = userSettings?.sug_lvl || 'Primary-School';
  const topics = TOPICS[language] || TOPICS.en;

  // 生成問題 mutation
  const generateMutation = useMutation({
    mutationFn: generateQuestion,
    onSuccess: (data) => {
      setCurrentQuestion(data.question);
      setAnalysisResult(null);
      setShowHint(false);
    },
  });

  // 保存記錄 mutation
  const saveMutation = useMutation({
    mutationFn: saveContextualSession,
    onSuccess: () => {
      queryClient.invalidateQueries(['contextualHistory']);
    },
  });

  // 選擇主題
  const handleSelectTopic = (topicId) => {
    setSelectedTopic(topicId);
    setCurrentQuestion(null);
    setAnalysisResult(null);
  };

  // 開始練習
  const handleStartPractice = () => {
    generateMutation.mutate({
      userId,
      topic: selectedTopic,
      level,
      language,
    });
  };

  // 開始錄音
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        // 分析語音
        try {
          const result = await analyzeSpeech({
            audioBlob,
            expectedText: currentQuestion?.expectedAnswer,
            language,
          });
          
          setAnalysisResult(result);

          // 保存記錄
          saveMutation.mutate({
            user_id: userId,
            topic: selectedTopic,
            difficulty_level: level,
            question: currentQuestion?.question,
            user_answer: result?.transcription || '',
            correct_answer: currentQuestion?.expectedAnswer,
            is_correct: result?.accuracy >= 0.8,
            error_phonemes: result?.errorPhonemes || [],
            error_rate: result?.errorRate || 0,
            feedback: result?.feedback || '',
          });
        } catch (err) {
          console.error('Speech analysis error:', err);
          setAnalysisResult({ error: err.message });
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Recording error:', err);
      alert(t('contextual.microphoneError', 'Unable to access microphone'));
    }
  }, [currentQuestion, language, userId, selectedTopic, level, saveMutation, t]);

  // 停止錄音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // 下一題
  const handleNextQuestion = () => {
    generateMutation.mutate({
      userId,
      topic: selectedTopic,
      level,
      language,
    });
  };

  // 返回主題選擇
  const handleBackToTopics = () => {
    setSelectedTopic(null);
    setCurrentQuestion(null);
    setAnalysisResult(null);
  };

  if (isLoadingSettings) {
    return <div className="main-content"><Loader /></div>;
  }

  // 主題選擇視圖
  if (!selectedTopic) {
    return (
      <div className="main-content contextual-page">
        <div className="contextual-header">
          <h1>{t('contextual.title', 'Contextual Practice')}</h1>
          <p>{t('contextual.subtitle', 'Practice everyday conversations to improve your pronunciation')}</p>
          <div className="level-badge">
            {t('contextual.yourLevel', 'Your Level')}: <strong>{level?.replace(/-/g, ' ')}</strong>
          </div>
        </div>

        <div className="topics-grid">
          {topics.map((topic) => (
            <button
              key={topic.id}
              className="topic-card"
              onClick={() => handleSelectTopic(topic.id)}
            >
              <img 
                src={TOPIC_IMAGES[topic.id]} 
                alt={topic.name} 
                className="topic-image" 
              />
              <span className="topic-name">{topic.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 練習視圖
  const currentTopicInfo = topics.find(t => t.id === selectedTopic);
  const topicBgImage = TOPIC_IMAGES[selectedTopic];

  return (
    <div 
      className="main-content contextual-page contextual-practice-page"
      style={{
        '--topic-bg-image': `url(${topicBgImage})`,
      }}
    >
      <div className="topic-bg-overlay"></div>
      <div className="contextual-content">
        <div className="contextual-header">
          <button className="back-button" onClick={handleBackToTopics}>
            ← {t('contextual.backToTopics', 'Back to Topics')}
          </button>
          <h1>
            <img src={topicBgImage} alt={currentTopicInfo?.name} className="topic-header-image" />
            {currentTopicInfo?.name}
          </h1>
        </div>

      {!currentQuestion && !generateMutation.isPending && (
        <div className="start-practice-section">
          <p>{t('contextual.readyToStart', 'Ready to practice conversations about this topic?')}</p>
          <button className="start-button" onClick={handleStartPractice}>
            {t('contextual.startPractice', 'Start Practice')}
          </button>
        </div>
      )}

      {generateMutation.isPending && (
        <div className="loading-section">
          <Loader />
          <p>{t('contextual.generatingQuestion', 'Generating question...')}</p>
        </div>
      )}

      {currentQuestion && (
        <div className="question-section">
          <div className="scenario-card">
            <div className="scenario-label">{t('contextual.scenario', 'Scenario')}</div>
            <p className="scenario-text">{currentQuestion.scenario}</p>
          </div>

          <div className="question-card">
            <div className="question-label">{t('contextual.someonAsks', 'Someone asks you:')}</div>
            <p className="question-text">"{currentQuestion.question}"</p>
          </div>

          <div className="answer-card">
            <div className="answer-label">{t('contextual.sayThis', 'Say this:')}</div>
            <p className="expected-answer">"{currentQuestion.expectedAnswer}"</p>
            
            {currentQuestion.keyPhrases && (
              <div className="key-phrases">
                <span className="key-label">{t('contextual.keyPhrases', 'Key phrases')}:</span>
                {currentQuestion.keyPhrases.map((phrase, idx) => (
                  <span key={idx} className="key-phrase">{phrase}</span>
                ))}
              </div>
            )}

            <button 
              className="hint-toggle"
              onClick={() => setShowHint(!showHint)}
            >
              {showHint ? t('contextual.hideHint', 'Hide Hint') : t('contextual.showHint', 'Show Hint')}
            </button>
            
            {showHint && (
              <p className="hint-text">💡 {currentQuestion.hint}</p>
            )}
          </div>

          <div className="recording-section">
            <button
              className={`record-button ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={generateMutation.isPending}
            >
              {isRecording ? (
                <>
                  <span className="record-icon">⏹️</span>
                  {t('contextual.stopRecording', 'Stop Recording')}
                </>
              ) : (
                <>
                  <span className="record-icon">🎤</span>
                  {t('contextual.startRecording', 'Start Recording')}
                </>
              )}
            </button>
          </div>

          {analysisResult && !analysisResult.error && (
            <div className="result-section">
              <div className={`accuracy-badge ${analysisResult.accuracy >= 0.8 ? 'good' : 'needs-work'}`}>
                {t('contextual.accuracy', 'Accuracy')}: {Math.round((analysisResult.accuracy || 0) * 100)}%
              </div>
              
              {analysisResult.transcription && (
                <div className="transcription">
                  <span className="label">{t('contextual.youSaid', 'You said')}:</span>
                  <p>"{analysisResult.transcription}"</p>
                </div>
              )}

              {analysisResult.feedback && (
                <div className="feedback">
                  <p>{analysisResult.feedback}</p>
                </div>
              )}
            </div>
          )}

          {analysisResult?.error && (
            <div className="error-message">
              {t('contextual.analysisError', 'Could not analyze speech. Please try again.')}
            </div>
          )}

          <div className="action-buttons">
            <button className="try-again-button" onClick={startRecording} disabled={isRecording}>
              {t('contextual.tryAgain', 'Try Again')}
            </button>
            <button className="next-button" onClick={handleNextQuestion} disabled={generateMutation.isPending}>
              {t('contextual.nextQuestion', 'Next Question')}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
