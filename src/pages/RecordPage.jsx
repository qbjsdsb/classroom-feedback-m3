// RecordPage.jsx - 录音/反馈页（MUI 重写）
// 原 /workspace/newclassroom/js/pages/recordPage.js 迁移而来
// 使用 useRecorder Hook 管理录音引擎，MUI 组件渲染界面

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Stack, Typography, IconButton, Button, Fab, TextField, Chip, Card,
  CardContent, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider, Collapse,
  ToggleButtonGroup, ToggleButton, CircularProgress,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MicIcon from '@mui/icons-material/Mic';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { useRecorder } from '../hooks/useRecorder';
import { useData } from '../store/DataContext';
import { useSession } from '../store/SessionContext';
import { UI } from '../utils/ui';
import AiService from '../services/aiService';
import { matchStudentByName, truncateTranscriptForStore } from '../utils/feedback';
import FeedbackResultDialog from '../components/FeedbackResultDialog';

/**
 * 替换模板中的变量占位符
 * 支持：{学生姓名} {科目} {日期}
 */
function replaceTemplateVars(content, student, subject, style) {
  if (!content) return content;
  let result = content;
  // {学生姓名}
  if (student && result.includes('{学生姓名}')) {
    const name = style.nameShorten !== false && student.name.length >= 3
      ? student.name.slice(-2) : student.name;
    result = result.replaceAll('{学生姓名}', name);
  }
  // {科目}
  if (subject && result.includes('{科目}')) {
    result = result.replaceAll('{科目}', subject.name);
  }
  // {日期}
  if (result.includes('{日期}')) {
    const now = new Date();
    const dateStr = style.useCustomDate && style.customDate
      ? style.customDate
      : `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    result = result.replaceAll('{日期}', dateStr);
  }
  return result;
}

export default function RecordPage() {
  const navigate = useNavigate();
  const { store, Storage, ready, refresh, refreshCounter } = useData();
  const session = useSession();
  const recorder = useRecorder();
  const { currentStudent, currentGroup, currentSubject, setCurrentSubject } = session;

  // ========== 本地 UI state ==========
  const [quickRepliesExpanded, setQuickRepliesExpanded] = useState(true);
  const [studentTemplatesExpanded, setStudentTemplatesExpanded] = useState(true);
  const [subjectSwitcherOpen, setSubjectSwitcherOpen] = useState(false);
  const [promptPickerOpen, setPromptPickerOpen] = useState(false);
  const [addQuickReplyOpen, setAddQuickReplyOpen] = useState(false);
  const [selectedPromptTemplateId, setSelectedPromptTemplateId] = useState(null);
  const [generating, setGenerating] = useState(false);
  // 反馈结果展示
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState('single'); // 'single' | 'group'
  const [singleFeedback, setSingleFeedback] = useState(null); // 单学生模式反馈数组
  const [groupFeedbacks, setGroupFeedbacks] = useState(null); // 小组模式反馈数组
  // 添加快捷回复表单
  const [qrContent, setQrContent] = useState('');
  const [qrCategory, setQrCategory] = useState('表扬');
  const [qrCustomCat, setQrCustomCat] = useState('');
  const [qrUseCustom, setQrUseCustom] = useState(false);

  // ========== refs ==========
  const btnRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // ========== 绑定长按录音事件 ==========
  useEffect(() => {
    if (btnRef.current && ready) {
      recorder.bindLongPressEvents(btnRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ========== 录音时文本框自动滚动到底部 ==========
  useEffect(() => {
    if (recorder.isRecording && textareaRef.current && !recorder.displayText) return;
    const el = textareaRef.current;
    if (!el) return;
    // 仅在用户未手动编辑时自动滚动（避免打断用户滚动）
    el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.displayText, recorder.isRecording]);

  // ========== 计算标题信息 ==========
  const headerInfo = useMemo(() => {
    if (currentGroup && currentGroup.length > 0) {
      const names = currentGroup
        .map(id => store.getStudentById(id)?.name)
        .filter(Boolean)
        .join('、');
      return { text: `👥 ${names}`, isGroup: true };
    } else if (currentStudent) {
      return { text: `👤 ${currentStudent.name}`, isGroup: false };
    }
    return { text: '未选择学生', isGroup: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudent, currentGroup, refreshCounter]);

  // ========== 快捷回复数据 ==========
  const quickReplies = useMemo(() => {
    if (!ready) return [];
    return store.getQuickReplies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter]);

  const quickReplyCategories = useMemo(() => {
    return [...new Set(quickReplies.map(r => r.category))];
  }, [quickReplies]);

  // ========== 学生模板数据 ==========
  const studentTemplates = useMemo(() => {
    if (!ready || !currentStudent) return [];
    return store.getStudentTemplates(currentStudent.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, currentStudent, refreshCounter]);

  // ========== 科目列表 ==========
  const subjects = useMemo(() => {
    if (!ready) return [];
    return store.getSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter]);

  // ========== Prompt 模板列表 ==========
  const promptTemplates = useMemo(() => {
    if (!ready) return [];
    return store.getPromptTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter]);

  // ========== 当前选中的 Prompt 模板名称（用于按钮文案展示） ==========
  const selectedPromptTemplateName = useMemo(() => {
    if (!selectedPromptTemplateId) return '';
    const t = store.getPromptTemplateById(selectedPromptTemplateId);
    return t ? t.name : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPromptTemplateId, refreshCounter]);

  // ========== 操作：插入快捷回复 ==========
  const insertQuickReply = useCallback((content) => {
    recorder.insertText(content);
    UI.showToast('已插入');
  }, [recorder]);

  // ========== 操作：删除快捷回复（带撤销） ==========
  const deleteQuickReply = useCallback((replyId) => {
    const replies = store.getQuickReplies();
    const reply = replies.find(r => r.id === replyId);
    store.deleteQuickReply(replyId);
    refresh();
    if (reply) {
      UI.showUndoToast('已删除快捷回复', () => {
        store.restoreQuickReply(reply);
        refresh();
      });
    }
  }, [store, refresh]);

  // ========== 操作：保存快捷回复 ==========
  const handleSaveQuickReply = useCallback(() => {
    const content = qrContent.trim();
    if (!content) {
      UI.showToast('请输入回复内容');
      return;
    }
    const category = qrUseCustom ? (qrCustomCat.trim() || '自定义') : qrCategory;
    store.addQuickReply(content, category);
    setAddQuickReplyOpen(false);
    setQrContent('');
    setQrCustomCat('');
    setQrUseCustom(false);
    setQrCategory('表扬');
    refresh();
    UI.showToast('已添加快捷回复');
  }, [store, qrContent, qrCustomCat, qrUseCustom, qrCategory, refresh]);

  // ========== 操作：插入学生模板（变量替换后插入） ==========
  const insertStudentTemplate = useCallback((template) => {
    if (!currentStudent) return;
    const style = Storage.getStyle();
    const replaced = replaceTemplateVars(template.content, currentStudent, currentSubject, style);
    recorder.insertText(replaced);
    UI.showToast('已插入');
  }, [currentStudent, currentSubject, Storage, recorder]);

  // ========== 操作：删除学生模板（带撤销） ==========
  const deleteStudentTemplate = useCallback((templateId) => {
    if (!currentStudent) return;
    const templates = store.getStudentTemplates(currentStudent.id);
    const template = templates.find(t => t.id === templateId);
    store.deleteStudentTemplate(currentStudent.id, templateId);
    refresh();
    if (template) {
      UI.showUndoToast('已删除模板', () => {
        store.addStudentTemplate(currentStudent.id, template.content);
        refresh();
      });
    }
  }, [currentStudent, store, refresh]);

  // ========== 操作：保存为常用点评 ==========
  const saveAsTemplate = useCallback(() => {
    const content = recorder.displayText.trim();
    if (!content) {
      UI.showToast('请先输入内容');
      return;
    }
    if (!currentStudent) {
      UI.showToast('请先选择学生');
      return;
    }
    store.addStudentTemplate(currentStudent.id, content);
    refresh();
    UI.showToast('已保存为常用点评');
  }, [recorder.displayText, currentStudent, store, refresh]);

  // ========== 操作：插入学生姓名标记（小组模式） ==========
  const insertStudentName = useCallback((name) => {
    recorder.insertText(`@${name}：`);
    UI.showToast('已插入 @' + name);
  }, [recorder]);

  // ========== 操作：选择科目 ==========
  const selectSubject = useCallback((subjectId) => {
    const subject = store.getSubjectById(subjectId);
    if (subject) {
      setCurrentSubject(subject);
      setSubjectSwitcherOpen(false);
      UI.showToast('已切换到 ' + subject.name);
    }
  }, [store, setCurrentSubject]);

  // ========== 操作：选择 Prompt 模板 ==========
  const selectPromptTemplate = useCallback((templateId) => {
    const template = store.getPromptTemplateById(templateId);
    if (!template) return;
    setSelectedPromptTemplateId(templateId);
    setPromptPickerOpen(false);
    UI.showToast(`已应用模板「${template.name}」`);
  }, [store]);

  // ========== 操作：生成反馈（接入 AiService） ==========
  const generateFeedback = useCallback(async () => {
    // 防重复提交
    if (generating) return;

    const text = recorder.displayText.trim();
    if (!text) {
      UI.showToast('请先录音或输入课堂内容');
      return;
    }
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      UI.showToast('请先设置 API Key');
      navigate('/settings');
      return;
    }
    const modules = Storage.getModules().filter(m => m.enabled);
    if (modules.length === 0) {
      UI.showToast('请至少启用一个反馈模块');
      return;
    }

    setGenerating(true);
    UI.showLoading('正在分析课堂内容...');

    // 进度提示定时器（模拟原 recordPage.js 的进度切换逻辑）
    // 通过 UI.updateLoading 更新 Backdrop 文案，避免直接 DOM 操作
    let progressStage = 0;
    const progressTimer = setInterval(() => {
      progressStage = (progressStage + 1) % 3;
      const messages = ['正在分析课堂内容...', '正在生成反馈内容...', '即将完成，请稍候...'];
      UI.updateLoading(messages[progressStage]);
    }, 4000);

    try {
      const moduleNames = modules.map(m => m.name);
      const style = Storage.getStyle();
      // 如果选中了模板，临时屏蔽 customPrompt 避免与模板 prompt 重复
      // （不修改 Storage 中的值，生成后 customPrompt 仍然保留）
      const effectiveStyle = selectedPromptTemplateId
        ? { ...style, customPrompt: '' }
        : style;
      const subject = currentSubject;
      const subjectName = subject?.name || '';
      const storedTranscript = truncateTranscriptForStore(text);

      if (currentGroup && currentGroup.length > 0) {
        // ===== 小组模式 =====
        const studentNames = currentGroup
          .map(id => store.getStudentById(id)?.name)
          .filter(Boolean);
        if (studentNames.length === 0) {
          UI.showToast('未找到学生信息');
          return;
        }

        UI.updateLoading('正在为 ' + studentNames.length + ' 位学生生成反馈...');
        const feedbacks = await AiService.generateGroupFeedback(
          text, moduleNames, studentNames, subjectName, effectiveStyle,
          subject?.id, selectedPromptTemplateId
        );

        // 为每位学生保存到各自的历史记录
        const groupStudents = currentGroup.map(id => store.getStudentById(id)).filter(Boolean);
        for (const fb of feedbacks) {
          const matchedStudent = matchStudentByName(groupStudents, fb.studentName);
          if (matchedStudent) {
            store.addFeedback(matchedStudent.id, {
              subjectId: subject?.id,
              transcript: storedTranscript,
              feedback: fb.feedback
            });
          }
        }

        // 打开结果展示 Dialog
        setFeedbackMode('group');
        setGroupFeedbacks(feedbacks);
        setSingleFeedback(null);
        setFeedbackDialogOpen(true);
        refresh();
        // 清空转录文本（模拟原 clearTranscript）
        recorder.clearTranscript();
      } else if (currentStudent) {
        // ===== 单学生模式 =====
        const studentName = currentStudent.name;
        UI.updateLoading('正在生成反馈内容...');
        const feedback = await AiService.generateFeedback(
          text, moduleNames, studentName, subjectName, effectiveStyle,
          subject?.id, selectedPromptTemplateId
        );

        store.addFeedback(currentStudent.id, {
          subjectId: subject?.id,
          transcript: storedTranscript,
          feedback
        });

        // 打开结果展示 Dialog
        setFeedbackMode('single');
        setSingleFeedback(feedback);
        setGroupFeedbacks(null);
        setFeedbackDialogOpen(true);
        refresh();
        recorder.clearTranscript();
      } else {
        UI.showToast('请先选择学生');
        return;
      }
    } catch (err) {
      UI.showToast('生成失败：' + err.message);
    } finally {
      clearInterval(progressTimer);
      UI.hideLoading();
      setGenerating(false);
      // 清除本次使用的模板ID，避免下次生成时无意识地继续使用
      setSelectedPromptTemplateId(null);
    }
  }, [
    generating, recorder.displayText, recorder.clearTranscript, Storage, navigate,
    selectedPromptTemplateId, currentSubject, currentStudent, currentGroup, store, refresh,
  ]);

  // ========== 关闭反馈结果 Dialog 时清理状态 ==========
  const handleCloseFeedbackDialog = useCallback(() => {
    setFeedbackDialogOpen(false);
    // 延迟清理，避免动画期间 UI 闪烁
    setTimeout(() => {
      setSingleFeedback(null);
      setGroupFeedbacks(null);
    }, 200);
  }, []);

  // ========== 操作：导入录音文件 ==========
  const handleFileImport = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      recorder.importAudioFile(file);
    }
    e.target.value = '';
  }, [recorder]);

  // ========== 字数统计 ==========
  const wordCount = useMemo(() => {
    return recorder.displayText.replace(/\s/g, '').length;
  }, [recorder.displayText]);

  if (!ready || !recorder.ready) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ========== 顶部标题栏 ========== */}
      <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
        <IconButton onClick={() => navigate('/subject-select')} aria-label="返回科目选择">
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>{headerInfo.text}</Typography>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mt: 0.25, flexWrap: 'wrap', gap: 0.5, useFlexGap: true }}>
            <Chip
              size="small"
              label={currentSubject ? `📚 ${currentSubject.name}` : '📚 未选择科目'}
              onClick={() => setSubjectSwitcherOpen(true)}
              onDelete={() => setSubjectSwitcherOpen(true)}
              deleteIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
              variant="outlined"
              sx={{
                color: currentSubject?.color || 'text.secondary',
                borderColor: currentSubject?.color ? `${currentSubject.color}66` : 'divider',
                bgcolor: currentSubject?.color ? `${currentSubject.color}0F` : 'transparent',
                height: 24,
                fontWeight: 500,
              }}
            />
            <Chip
              size="small"
              label={selectedPromptTemplateName ? `📋 ${selectedPromptTemplateName}` : '📋 模板'}
              onClick={() => setPromptPickerOpen(true)}
              variant="outlined"
              color={selectedPromptTemplateName ? 'primary' : 'default'}
              sx={{ height: 24, fontWeight: 500 }}
            />
          </Stack>
        </Box>
        <IconButton onClick={() => navigate('/settings')} aria-label="打开设置">
          <SettingsIcon />
        </IconButton>
      </Stack>

      {/* ========== 课堂计时器 ========== */}
      <Box sx={{ textAlign: 'center', my: 2 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 300,
            fontVariantNumeric: 'tabular-nums',
            color: recorder.isRecording ? 'primary.main' : 'text.primary',
          }}
        >
          {recorder.classTimerText}
        </Typography>
        <Typography variant="caption" color="text.secondary">课堂时长</Typography>
      </Box>

      {/* ========== 录音区域 ========== */}
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Fab
              ref={btnRef}
              color={recorder.isRecording ? 'error' : 'primary'}
              sx={{
                width: 88,
                height: 88,
                boxShadow: recorder.longPressActive ? 6 : 1,
                transform: recorder.longPressActive ? 'scale(1.05)' : 'scale(1)',
                transition: 'all 0.2s',
              }}
              aria-label={recorder.isRecording ? '停止录音' : '开始录音'}
            >
              {recorder.isRecording ? <StopIcon /> : <MicIcon />}
            </Fab>
            {recorder.isPaused && (
              <Button variant="outlined" color="error" onClick={() => recorder.stop()}>
                完全停止
              </Button>
            )}
          </Stack>

          {/* 连接进度提示 */}
          {recorder.connectionStatus && (
            <Typography color="text.secondary" variant="body2">
              {recorder.connectionStatus}
            </Typography>
          )}
          {/* 录音计时器 */}
          {recorder.timerText && (
            <Typography variant="h6" color="primary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {recorder.timerText}
            </Typography>
          )}
          {/* 状态文案 */}
          {!recorder.isRecording && !recorder.connectionStatus && (
            <Typography color="text.secondary" variant="body2">
              {recorder.isPaused ? '已暂停，点击继续' : '点击开始录制课堂内容'}
            </Typography>
          )}
          {/* 长按提示 */}
          <Typography variant="caption" color="text.secondary">
            👆 长按录音，松手停止
          </Typography>
        </Box>

        {/* 导入录音文件 */}
        <Box sx={{ textAlign: 'center' }}>
          <Button
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ textTransform: 'none' }}
          >
            导入录音文件（语音转文字）
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileImport}
            style={{ display: 'none' }}
            aria-label="导入录音文件"
          />
          {recorder.importProgress.visible && (
            <Box sx={{ mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={recorder.importProgress.percent}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {recorder.importProgress.status}
              </Typography>
            </Box>
          )}
        </Box>
      </Stack>

      <Divider sx={{ my: 2 }} />

      {/* ========== 快捷回复库 ========== */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">⚡ 快捷回复</Typography>
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={() => setAddQuickReplyOpen(true)} aria-label="添加快捷回复">
              <AddIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setQuickRepliesExpanded(!quickRepliesExpanded)} aria-label="展开/收起快捷回复">
              {quickRepliesExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Stack>
        </Stack>
        <Collapse in={quickRepliesExpanded}>
          {quickReplies.length === 0 ? (
            <Typography variant="body2" color="text.secondary">暂无快捷回复，点击 + 添加</Typography>
          ) : (
            <Stack spacing={1.5}>
              {quickReplyCategories.map(cat => (
                <Box key={cat}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {cat}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, useFlexGap: true }}>
                    {quickReplies.filter(r => r.category === cat).map(r => {
                      const short = r.content.substring(0, 20) + (r.content.length > 20 ? '...' : '');
                      return (
                        <Chip
                          key={r.id}
                          label={short}
                          size="small"
                          onClick={() => insertQuickReply(r.content)}
                          onDelete={() => deleteQuickReply(r.id)}
                          deleteIcon={<DeleteIcon />}
                          sx={{ cursor: 'pointer' }}
                          title={r.content}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Collapse>
      </Box>

      {/* ========== 学生常用模板 ========== */}
      {currentStudent && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">📌 {currentStudent.name}的常用点评</Typography>
            <IconButton size="small" onClick={() => setStudentTemplatesExpanded(!studentTemplatesExpanded)} aria-label="展开/收起学生模板">
              {studentTemplatesExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Stack>
          <Collapse in={studentTemplatesExpanded}>
            {studentTemplates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                暂无常用点评，输入内容后点击"保存为常用点评"即可添加
              </Typography>
            ) : (
              <Stack spacing={1}>
                {studentTemplates.map(t => (
                  <Card key={t.id} variant="outlined">
                    <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                        <Box
                          sx={{ flexGrow: 1, cursor: 'pointer', minHeight: 32, display: 'flex', alignItems: 'center' }}
                          onClick={() => insertStudentTemplate(t)}
                        >
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {t.content}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => deleteStudentTemplate(t.id)}
                          aria-label="删除此常用点评"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
                <Typography variant="caption" color="text.secondary">
                  支持变量：{'{学生姓名}'} {'{科目}'} {'{日期}'}，插入时自动替换
                </Typography>
              </Stack>
            )}
          </Collapse>
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* ========== 文本框区域 ========== */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2">📝 课堂内容（可直接输入或编辑）</Typography>
          <Stack direction="row" spacing={1}>
            {currentStudent && (
              <Button size="small" startIcon={<BookmarkIcon />} onClick={saveAsTemplate} sx={{ textTransform: 'none' }}>
                保存为常用点评
              </Button>
            )}
            <Button size="small" color="error" onClick={() => recorder.clearTranscript()} sx={{ textTransform: 'none' }}>
              清空
            </Button>
          </Stack>
        </Stack>

        {/* 小组模式：姓名快速插入按钮 */}
        {currentGroup && currentGroup.length >= 2 && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1, useFlexGap: true }}>
            {currentGroup.map(id => {
              const s = store.getStudentById(id);
              return s ? (
                <Chip
                  key={id}
                  label={`@${s.name}`}
                  size="small"
                  variant="outlined"
                  onClick={() => insertStudentName(s.name)}
                />
              ) : null;
            })}
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              点击插入姓名标记，帮助AI区分
            </Typography>
          </Stack>
        )}

        <TextField
          inputRef={textareaRef}
          multiline
          minRows={6}
          fullWidth
          value={recorder.displayText}
          onChange={(e) => recorder.handleTextChange(e.target.value)}
          placeholder={'请在此输入本节课的课堂内容，例如：\n• 今天复习了二次函数\n• 学生掌握了配方法\n• 作业是练习册第15页\n\n建议使用电脑端浏览器操作，输入更方便…'}
          inputProps={{ 'aria-label': '课堂内容' }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          字数：{wordCount}
        </Typography>
      </Box>

      {/* ========== 生成反馈按钮 ========== */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
          onClick={generateFeedback}
          disabled={generating}
          sx={{ textTransform: 'none', borderRadius: 28, py: 1.2, fontSize: '1rem' }}
        >
          {generating ? '生成中...' : '✨ 生成反馈'}
        </Button>
        {currentStudent && (
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => navigate('/history')}
            sx={{ textTransform: 'none', borderRadius: 20 }}
          >
            查看历史反馈
          </Button>
        )}
      </Stack>

      {/* ========== 科目切换器（Drawer） ========== */}
      <Drawer
        anchor="bottom"
        open={subjectSwitcherOpen}
        onClose={() => setSubjectSwitcherOpen(false)}
        PaperProps={{ sx: { maxHeight: '50vh' } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>切换科目</Typography>
          <List>
            {subjects.map(s => (
              <ListItemButton
                key={s.id}
                onClick={() => selectSubject(s.id)}
                selected={s.id === currentSubject?.id}
              >
                <ListItemIcon>
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: s.color }} />
                </ListItemIcon>
                <ListItemText primary={s.name} />
                {s.id === currentSubject?.id && <CheckIcon color="primary" />}
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* ========== Prompt 模板选择器（Drawer） ========== */}
      <Drawer
        anchor="bottom"
        open={promptPickerOpen}
        onClose={() => setPromptPickerOpen(false)}
        PaperProps={{ sx: { maxHeight: '60vh' } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>选择 Prompt 模板</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            选择模板后将替换当前的自定义要求
          </Typography>
          {promptTemplates.length === 0 ? (
            <Typography variant="body2" color="text.secondary">暂无模板，请在设置中创建</Typography>
          ) : (
            <Box>
              {[...new Set(promptTemplates.map(t => t.category))].map(cat => (
                <Box key={cat} sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    {cat}
                  </Typography>
                  {promptTemplates.filter(t => t.category === cat).map(t => (
                    <Card
                      key={t.id}
                      variant="outlined"
                      sx={{ mb: 1, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}
                      onClick={() => selectPromptTemplate(t.id)}
                    >
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.name}</Typography>
                        {t.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {t.description}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Drawer>

      {/* ========== 添加快捷回复对话框 ========== */}
      <Dialog open={addQuickReplyOpen} onClose={() => setAddQuickReplyOpen(false)} fullWidth>
        <DialogTitle>添加快捷回复</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            multiline
            rows={3}
            fullWidth
            label="回复内容"
            placeholder="输入快捷回复内容，如：注意力集中，积极回答问题"
            value={qrContent}
            onChange={(e) => setQrContent(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <Typography variant="body2" sx={{ mb: 1 }}>分类</Typography>
          <ToggleButtonGroup
            value={qrUseCustom ? 'custom' : qrCategory}
            exclusive
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }}
            onChange={(_, val) => {
              if (!val) return;
              if (val === 'custom') {
                setQrUseCustom(true);
              } else {
                setQrUseCustom(false);
                setQrCategory(val);
              }
            }}
          >
            {['表扬', '建议', '作业', '自定义'].map(c => (
              <ToggleButton key={c} value={c} size="small">
                {c}
              </ToggleButton>
            ))}
            {quickReplyCategories.filter(c => !['表扬', '建议', '作业', '自定义'].includes(c)).map(c => (
              <ToggleButton key={c} value={c} size="small">
                {c}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          {qrUseCustom && (
            <TextField
              fullWidth
              size="small"
              placeholder="输入自定义分类名"
              value={qrCustomCat}
              onChange={(e) => setQrCustomCat(e.target.value)}
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddQuickReplyOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveQuickReply}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* ========== 反馈结果展示 Dialog ========== */}
      <FeedbackResultDialog
        open={feedbackDialogOpen}
        onClose={handleCloseFeedbackDialog}
        mode={feedbackMode}
        feedback={singleFeedback}
        feedbacks={groupFeedbacks}
        student={currentStudent}
        group={currentGroup}
        subject={currentSubject}
        store={store}
        getStudentById={store.getStudentById.bind(store)}
        style={Storage.getStyle()}
        onRegenerate={() => {
          // 重新生成：留在当前页，让用户重新输入后点"生成反馈"
          UI.showToast('请重新录音或输入内容后再次生成');
        }}
      />
    </Box>
  );
}
