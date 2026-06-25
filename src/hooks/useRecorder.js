// useRecorder.js - 录音引擎的 React Hook 封装
// 用 useRef 持有引擎实例，用 useState 镜像引擎状态
// 引擎通过注入的 callbacks 通知状态变化，Hook 同步到 React state

import { useRef, useState, useEffect, useCallback } from 'react';
import { RecorderEngine } from '../services/recorderEngine';
import { UI } from '../utils/ui';
import { useData } from '../store/DataContext';
import { useSession } from '../store/SessionContext';

export function useRecorder() {
  const { Storage, ready } = useData();
  const session = useSession();

  // ========== 引用（持久化跨渲染，不触发重渲染） ==========
  const engineRef = useRef(null);
  // displayText 的 ref（避免闭包陈旧，引擎回调读取最新值）
  const displayTextRef = useRef('');
  // 用户正在编辑文本框的标志（避免引擎写入覆盖用户输入）
  const userEditingRef = useRef(false);
  // 草稿自动保存防抖定时器
  const draftSaveTimerRef = useRef(null);
  // 课堂计时器状态
  const classTimerRef = useRef({ startTime: null, elapsed: 0, isRunning: false, interval: null });
  // 最新会话信息（saveClassDuration 读取，避免闭包陈旧）
  const sessionRef = useRef({ currentStudent: null, currentGroup: null, currentSubject: null });

  // ========== React state（镜像引擎状态，触发重渲染） ==========
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [displayText, setDisplayText] = useState(''); // textarea 受控值
  const [timerText, setTimerText] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [longPressActive, setLongPressActive] = useState(false);
  const [whisperStatus, setWhisperStatus] = useState(null);
  const [importProgress, setImportProgress] = useState({ visible: false, percent: 0, status: '' });
  const [classTimerText, setClassTimerText] = useState('00:00');

  // ========== 会话信息 ref 同步 ==========
  useEffect(() => {
    sessionRef.current = {
      currentStudent: session.currentStudent,
      currentGroup: session.currentGroup,
      currentSubject: session.currentSubject,
    };
  }, [session.currentStudent, session.currentGroup, session.currentSubject]);

  // ========== displayText ref 同步（供引擎回调读取最新值） ==========
  useEffect(() => {
    displayTextRef.current = displayText;
  }, [displayText]);

  // ========== 课堂计时器逻辑（原 recordPage.js 迁移） ==========

  // 保存课堂时长到 localStorage（原 saveClassDuration + _saveDurationRecord）
  const saveClassDuration = useCallback((seconds) => {
    const { currentStudent, currentGroup, currentSubject } = sessionRef.current;
    const dateStr = new Date().toISOString().split('T')[0];
    const createdAt = new Date().toISOString();

    // 单学生模式
    if (currentStudent) {
      const record = {
        id: `dur_${Date.now()}`,
        studentId: currentStudent.id,
        subjectId: currentSubject?.id,
        duration: seconds,
        date: dateStr,
        createdAt,
      };
      saveDurationRecord(record);
      return;
    }

    // 小组模式：为每位学生保存相同的时长
    if (currentGroup && currentGroup.length > 0) {
      currentGroup.forEach((studentId) => {
        const record = {
          id: `dur_${Date.now()}_${studentId}`,
          studentId,
          subjectId: currentSubject?.id,
          duration: seconds,
          date: dateStr,
          createdAt,
        };
        saveDurationRecord(record);
      });
    }
  }, []);

  // 写入时长记录到 localStorage（原 _saveDurationRecord）
  function saveDurationRecord(record) {
    const MAX_DURATION_RECORDS = 100; // 限制最大记录数，避免 localStorage 无限增长
    const raw = localStorage.getItem('cf_class_durations') || '[]';
    let durations = [];
    try {
      durations = JSON.parse(raw);
    } catch {
      durations = [];
    }
    durations.push(record);
    // 仅保留最新的 N 条记录
    if (durations.length > MAX_DURATION_RECORDS) {
      durations = durations.slice(-MAX_DURATION_RECORDS);
    }
    try {
      localStorage.setItem('cf_class_durations', JSON.stringify(durations));
    } catch (e) {}
  }

  const startClassTimer = useCallback(() => {
    const t = classTimerRef.current;
    if (t.isRunning) return;
    t.isRunning = true;
    t.startTime = Date.now() - t.elapsed;
    t.interval = setInterval(() => {
      const total = Math.floor((Date.now() - t.startTime) / 1000);
      const m = Math.floor(total / 60).toString().padStart(2, '0');
      const s = (total % 60).toString().padStart(2, '0');
      setClassTimerText(`${m}:${s}`);
    }, 1000);
  }, []);

  const pauseClassTimer = useCallback(() => {
    const t = classTimerRef.current;
    if (!t.isRunning) return;
    t.isRunning = false;
    t.elapsed = Date.now() - t.startTime;
    clearInterval(t.interval);
  }, []);

  const stopClassTimer = useCallback(() => {
    const t = classTimerRef.current;
    // 停止前先更新 elapsed，确保包含当前运行的时间
    if (t.isRunning) {
      t.elapsed = Date.now() - t.startTime;
    }
    t.isRunning = false;
    if (t.interval) {
      clearInterval(t.interval);
      t.interval = null;
    }
    const totalSec = Math.floor(t.elapsed / 1000);
    if (totalSec > 0) {
      saveClassDuration(totalSec);
    }
    t.elapsed = 0;
    t.startTime = null;
    setClassTimerText('00:00');
  }, [saveClassDuration]);

  // ========== 初始化引擎（只一次，ready 后创建） ==========
  if (!engineRef.current && ready) {
    engineRef.current = new RecorderEngine({
      onUpdateTranscript: ({ displayText: text }) => {
        // 用户正在编辑时不覆盖（避免双向写入冲突）
        if (!userEditingRef.current) {
          setDisplayText(text);
        }
      },
      onStateChange: (recording, paused) => {
        setIsRecording(recording);
        setIsPaused(paused);
      },
      onTimerUpdate: (text) => setTimerText(text),
      onConnectionStatus: (status) => setConnectionStatus(status),
      onLongPressVisual: (active) => setLongPressActive(active),
      onWhisperStatus: (status) => setWhisperStatus(status),
      onImportProgress: ({ visible, percent, status }) =>
        setImportProgress({ visible, percent, status }),
      showToast: (msg, dur) => UI.showToast(msg, dur),
      showConfirm: (msg, cb) => UI.showConfirm(msg, cb),
      showUndoToast: (msg, undoCb) => UI.showUndoToast(msg, undoCb),
      startClassTimer: () => startClassTimer(),
      stopClassTimer: () => stopClassTimer(),
      pauseClassTimer: () => pauseClassTimer(),
      getSpeechConfig: () => (ready ? Storage.getSpeechConfig() : { provider: 'browser' }),
      getCurrentTranscript: () => displayTextRef.current,
      setCurrentTranscript: (text) => setDisplayText(text),
      saveDraftTranscript: (text) => {
        try {
          localStorage.setItem('cf_draft_transcript', text);
        } catch (e) {}
      },
      getProviderName: (p) => (p === 'whisper' ? '本地AI识别' : '浏览器识别'),
    });
  }

  // ========== 卸载时清理课堂计时器 ==========
  useEffect(() => {
    return () => {
      const t = classTimerRef.current;
      if (t.interval) {
        clearInterval(t.interval);
        t.interval = null;
      }
      if (draftSaveTimerRef.current) {
        clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, []);

  // ========== 恢复草稿（ready 后从 localStorage 读取） ==========
  useEffect(() => {
    if (!ready) return;
    try {
      const draft = localStorage.getItem('cf_draft_transcript') || '';
      setDisplayText(draft);
      if (engineRef.current) engineRef.current.accumulatedText = draft;
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ========== 暴露给组件的 API ==========
  const start = useCallback(() => engineRef.current?.start(), []);
  const stop = useCallback(() => engineRef.current?.stop(), []);
  const toggle = useCallback(() => engineRef.current?.toggle(), []);
  const pause = useCallback(() => engineRef.current?.pause(), []);
  const resume = useCallback(() => engineRef.current?.resume(), []);

  const clearTranscript = useCallback(() => {
    setDisplayText('');
    if (engineRef.current) {
      engineRef.current.accumulatedText = '';
      engineRef.current.finalTranscript = '';
      engineRef.current.interimTranscript = '';
    }
    // 清空时立即保存，不走防抖
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    try {
      localStorage.removeItem('cf_draft_transcript');
    } catch (e) {}
    // 重置用户编辑标志
    userEditingRef.current = false;
  }, []);

  const importAudioFile = useCallback(
    (file) => engineRef.current?.importAudioFile(file),
    []
  );

  const bindLongPressEvents = useCallback(
    (btn) => engineRef.current?.bindLongPressEvents(btn),
    []
  );

  // 用户编辑文本框（受控输入）
  const handleTextChange = useCallback((text) => {
    userEditingRef.current = true;
    setDisplayText(text);
    if (engineRef.current) {
      // 用户编辑时把内容同步回引擎，避免恢复录音时丢失编辑
      engineRef.current.accumulatedText = text;
      engineRef.current.finalTranscript = '';
      engineRef.current.interimTranscript = '';
    }
    // 防抖保存草稿（500ms）
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem('cf_draft_transcript', text);
      } catch (e) {}
      userEditingRef.current = false;
    }, 500);
  }, []);

  // 在文本框当前位置插入内容（快捷回复/学生模板/姓名标记用）
  const insertText = useCallback((content) => {
    const current = displayTextRef.current;
    const separator = current && !current.endsWith('\n') ? '\n' : '';
    const newText = current + separator + content + '\n';
    setDisplayText(newText);
    if (engineRef.current) {
      engineRef.current.accumulatedText = newText;
      engineRef.current.finalTranscript = '';
      engineRef.current.interimTranscript = '';
    }
    // 防抖保存草稿
    if (draftSaveTimerRef.current) {
      clearTimeout(draftSaveTimerRef.current);
    }
    draftSaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem('cf_draft_transcript', newText);
      } catch (e) {}
      userEditingRef.current = false;
    }, 500);
  }, []);

  return {
    ready,
    isRecording,
    isPaused,
    displayText,
    timerText,
    connectionStatus,
    longPressActive,
    whisperStatus,
    importProgress,
    // 课堂计时器
    classTimerText,
    // 引擎 API
    start,
    stop,
    toggle,
    pause,
    resume,
    clearTranscript,
    importAudioFile,
    bindLongPressEvents,
    handleTextChange,
    insertText,
    // 引擎引用（供日志查看等高级功能）
    engine: engineRef.current,
  };
}

export default useRecorder;
