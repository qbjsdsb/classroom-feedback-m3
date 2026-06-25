// FeedbackResultDialog.jsx - 反馈结果展示与编辑组件
// 提取自原 /workspace/newclassroom/js/app.js renderFeedback / renderGroupFeedback / _showGroupStudent / copyFeedback / _persistFeedbackEdit
//
// 关键迁移点：
// 1. 编辑改为受控组件（TextField multiline），onChange 实时同步 state，onBlur 触发 store.updateFeedback
// 2. _currentFeedbackId 跟随小组学生切换更新：切换时通过 store.getFeedbackHistory(student.id)[0].id 重新查询
// 3. 姓名匹配使用共享工具 matchStudentByName（消除原项目 4 处重复实现）
// 4. closeModal 时 reset state，避免原项目的状态泄漏
// 5. unifyCommonModules 使用共享工具（pure function）

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Button, Box, Stack,
  Typography, TextField, Tabs, Tab, CircularProgress, Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  matchStudentByName, generateFeedbackTitle, getModuleIcon, resolveModuleWrap,
  unifyCommonModules, copyToClipboard, buildFeedbackText, getDateStr, getDisplayName,
} from '../utils/feedback';
import { UI } from '../utils/ui';

/**
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {'single'|'group'} props.mode - 模式
 * @param {Array<{module:string,content:string}>} [props.feedback] - 单学生模式的反馈
 * @param {Array<{studentName:string,feedback:Array}>} [props.feedbacks] - 小组模式的反馈数组
 * @param {Object} [props.student] - 单学生模式的学生对象
 * @param {string[]} [props.group] - 小组模式的学生ID数组
 * @param {Object} [props.subject] - 当前科目
 * @param {Object} props.store - store 实例
 * @param {Function} props.getStudentById - store.getStudentById
 * @param {Object} props.style - Storage.getStyle() 返回的风格
 * @param {Function} [props.onRegenerate] - 重新生成回调
 */
export default function FeedbackResultDialog(props) {
  const {
    open, onClose, mode = 'single',
    feedback: singleFeedbackProp,
    feedbacks: groupFeedbacksProp,
    student, group, subject,
    store, getStudentById, style,
    onRegenerate,
  } = props;

  // ========== 内部 state ==========
  // 单学生模式：feedback 数组的可编辑副本
  const [singleFeedback, setSingleFeedback] = useState([]);
  // 小组模式：unify 后的 feedbacks 副本（每位学生含 studentName + feedback 数组）
  const [groupData, setGroupData] = useState([]);
  // 小组当前学生索引
  const [groupIndex, setGroupIndex] = useState(0);
  // 当前反馈ID（用于持久化；小组模式随学生切换更新）
  const [currentFeedbackId, setCurrentFeedbackId] = useState(null);
  // 复制按钮反馈状态
  const [copying, setCopying] = useState(false);
  // 防止 blur 在复制期间误触发保存提示
  const isCopyingRef = useRef(false);

  // ========== 打开时初始化 state ==========
  useEffect(() => {
    if (!open) return;

    if (mode === 'group' && groupFeedbacksProp && groupFeedbacksProp.length > 0) {
      // 统一公共模块并深拷贝（传入 style 以读取 commonModules 和 groupAddressTerm）
      const unified = unifyCommonModules(groupFeedbacksProp, style);
      // 深拷贝确保编辑不影响外部 props
      const cloned = unified.map(fb => ({
        studentName: fb.studentName,
        feedback: fb.feedback.map(item => ({ ...item })),
      }));
      setGroupData(cloned);
      setGroupIndex(0);
      setSingleFeedback([]);
      // 初始化第一个学生的 currentFeedbackId
      initFeedbackIdForGroupIndex(0, cloned);
    } else if (mode === 'single' && singleFeedbackProp) {
      const cloned = singleFeedbackProp.map(item => ({ ...item }));
      setSingleFeedback(cloned);
      setGroupData([]);
      setGroupIndex(0);
      // 单学生模式：currentFeedbackId 由外部通过 props.student 的最新历史记录获取
      // 但这里没有直接传入 feedbackId，因此从 store.getFeedbackHistory 查询最新一条
      if (student && store) {
        const history = store.getFeedbackHistory(student.id);
        if (history && history.length > 0) {
          setCurrentFeedbackId(history[0].id);
        } else {
          setCurrentFeedbackId(null);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, singleFeedbackProp, groupFeedbacksProp, student]);

  // ========== 小组模式：根据学生索引初始化 currentFeedbackId ==========
  // 模拟原 _showGroupStudent 中的 "this._currentFeedbackId = history[0].id" 行为
  const initFeedbackIdForGroupIndex = useCallback((index, data) => {
    if (!group || !store || !data || !data[index]) {
      setCurrentFeedbackId(null);
      return;
    }
    const studentName = data[index].studentName;
    const groupStudents = group.map(id => getStudentById(id)).filter(Boolean);
    const matchedStudent = matchStudentByName(groupStudents, studentName);
    if (matchedStudent) {
      const history = store.getFeedbackHistory(matchedStudent.id);
      if (history && history.length > 0) {
        setCurrentFeedbackId(history[0].id);
        return;
      }
    }
    setCurrentFeedbackId(null);
  }, [group, store, getStudentById]);

  // ========== 小组模式：切换学生 ==========
  const handleGroupTabChange = useCallback((_, newIndex) => {
    setGroupIndex(newIndex);
    initFeedbackIdForGroupIndex(newIndex, groupData);
  }, [groupData, initFeedbackIdForGroupIndex]);

  // 上一页/下一页
  const handlePrevStudent = useCallback(() => {
    if (groupIndex > 0) handleGroupTabChange(null, groupIndex - 1);
  }, [groupIndex, handleGroupTabChange]);
  const handleNextStudent = useCallback(() => {
    if (groupIndex < groupData.length - 1) handleGroupTabChange(null, groupIndex + 1);
  }, [groupIndex, groupData, handleGroupTabChange]);

  // ========== 当前展示的反馈数组（单学生 or 小组当前学生） ==========
  const currentFeedback = useMemo(() => {
    if (mode === 'group') {
      return groupData[groupIndex]?.feedback || [];
    }
    return singleFeedback;
  }, [mode, groupData, groupIndex, singleFeedback]);

  // ========== 当前学生对象（用于持久化与标题） ==========
  const currentStudentObj = useMemo(() => {
    if (mode === 'single') return student;
    if (mode === 'group' && group && groupData[groupIndex]) {
      const studentName = groupData[groupIndex].studentName;
      const groupStudents = group.map(id => getStudentById(id)).filter(Boolean);
      return matchStudentByName(groupStudents, studentName);
    }
    return null;
  }, [mode, student, group, groupData, groupIndex, getStudentById]);

  // ========== 当前标题 ==========
  const currentTitle = useMemo(() => {
    if (mode === 'group') {
      // 小组模式：使用当前学生单独的标题（仅含该学生姓名）
      if (!groupData[groupIndex]) return '';
      const studentName = groupData[groupIndex].studentName;
      // 临时构造一个单学生模式的标题
      const matchedStudent = currentStudentObj;
      return generateFeedbackTitle({
        student: matchedStudent,
        group: null,
        subject,
        getStudentById,
        style,
      });
    }
    // 单学生模式
    return generateFeedbackTitle({
      student,
      group: null,
      subject,
      getStudentById,
      style,
    });
  }, [mode, groupData, groupIndex, currentStudentObj, student, subject, getStudentById, style]);

  // ========== 编辑单个模块内容 ==========
  const handleModuleChange = useCallback((index, newContent) => {
    if (mode === 'group') {
      setGroupData(prev => {
        const next = [...prev];
        if (next[groupIndex]) {
          next[groupIndex] = {
            ...next[groupIndex],
            feedback: next[groupIndex].feedback.map((item, i) =>
              i === index ? { ...item, content: newContent } : item
            ),
          };
        }
        return next;
      });
    } else {
      setSingleFeedback(prev => prev.map((item, i) =>
        i === index ? { ...item, content: newContent } : item
      ));
    }
  }, [mode, groupIndex]);

  // ========== 持久化保存（onBlur 触发） ==========
  // 模拟原 _persistFeedbackEdit：整体覆盖 store.updateFeedback(studentId, feedbackId, feedback)
  const persistEdit = useCallback(() => {
    // 复制期间不弹保存提示
    if (isCopyingRef.current) return;

    if (!currentStudentObj || !currentFeedbackId || !store) return;

    // 获取当前最新的反馈数组（从 state 中读取）
    let latestFeedback;
    if (mode === 'group') {
      latestFeedback = groupData[groupIndex]?.feedback;
    } else {
      latestFeedback = singleFeedback;
    }
    if (!latestFeedback) return;

    const ok = store.updateFeedback(currentStudentObj.id, currentFeedbackId, latestFeedback);
    if (ok) {
      UI.showToast('已保存修改', 1500);
    }
  }, [currentStudentObj, currentFeedbackId, store, mode, groupData, groupIndex, singleFeedback]);

  // ========== 复制反馈 ==========
  const handleCopy = useCallback(async () => {
    if (!currentFeedback || currentFeedback.length === 0) return;

    // 标记正在复制，避免 blur 误触发保存提示
    isCopyingRef.current = true;
    setCopying(true);

    // 构造开场白/结尾占位符上下文（缺失字段替换为空字符串）
    const studentName = currentStudentObj ? getDisplayName(currentStudentObj.name, style) : '';
    const ctx = {
      student: studentName,
      subject: subject ? subject.name : '',
      teacher: (style && style.teacherName) || '',
      date: getDateStr(style),
      institution: (style && style.institutionName) || '',
      // 家长称呼占位符：简单回退为"家长"
      parent: '家长',
    };
    const text = buildFeedbackText(currentFeedback, currentTitle, style, ctx);
    const ok = await copyToClipboard(text);
    if (ok) {
      UI.showToast('已复制到剪贴板');
    } else {
      UI.showToast('复制失败，请手动复制');
    }

    // 延迟重置标志位，避免 blur 在复制完成后误触发
    setTimeout(() => {
      isCopyingRef.current = false;
      setCopying(false);
    }, 300);
  }, [currentFeedback, currentTitle, style, currentStudentObj, subject]);

  // ========== 重新生成 ==========
  const handleRegenerate = useCallback(() => {
    if (onRegenerate) onRegenerate();
    onClose();
  }, [onRegenerate, onClose]);

  // ========== 关闭时清理 state（修复原项目状态泄漏） ==========
  const handleClose = useCallback(() => {
    // 延迟清理，避免动画期间状态突变导致 UI 闪烁
    onClose();
    setTimeout(() => {
      setSingleFeedback([]);
      setGroupData([]);
      setGroupIndex(0);
      setCurrentFeedbackId(null);
      isCopyingRef.current = false;
    }, 200);
  }, [onClose]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      maxWidth={false}
    >
      <DialogTitle>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap>{currentTitle || '课堂反馈'}</Typography>
            {mode === 'group' && groupData[groupIndex] && (
              <Typography variant="caption" color="text.secondary">
                学生：{groupData[groupIndex].studentName}
              </Typography>
            )}
          </Box>
          <IconButton onClick={handleClose} aria-label="关闭">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {/* ========== 小组模式：学生切换 Tab ========== */}
        {mode === 'group' && groupData.length > 1 && (
          <>
            <Tabs
              value={groupIndex}
              onChange={handleGroupTabChange}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
            >
              {groupData.map((fb, i) => (
                <Tab key={i} label={fb.studentName} />
              ))}
            </Tabs>
          </>
        )}

        {/* ========== 反馈模块列表（可编辑） ========== */}
        <Stack spacing={2}>
          {currentFeedback.map((item, index) => {
            const wrap = resolveModuleWrap(style?.moduleWrap);
            return (
            <Paper key={index} variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>
                <Box component="span" sx={{ mr: 0.5 }} aria-hidden>
                  {getModuleIcon(item.module)}
                </Box>
                {wrap.open}{item.module}{wrap.close}
              </Typography>
              <TextField
                multiline
                fullWidth
                minRows={2}
                value={item.content}
                onChange={(e) => handleModuleChange(index, e.target.value)}
                onBlur={persistEdit}
                variant="outlined"
                placeholder="（此模块暂无内容）"
                inputProps={{ 'aria-label': `编辑 ${item.module} 模块内容` }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                编辑后失焦自动保存
              </Typography>
            </Paper>
            );
          })}
          {currentFeedback.length === 0 && (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              暂无反馈内容
            </Typography>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        {/* 小组模式：底部翻页按钮 */}
        {mode === 'group' && groupData.length > 1 && (
          <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mr: 'auto' }}>
            <IconButton onClick={handlePrevStudent} disabled={groupIndex === 0} aria-label="上一个学生">
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {groupIndex + 1} / {groupData.length}
            </Typography>
            <IconButton
              onClick={handleNextStudent}
              disabled={groupIndex === groupData.length - 1}
              aria-label="下一个学生"
            >
              <ChevronRightIcon />
            </IconButton>
          </Stack>
        )}

        {onRegenerate && (
          <Button
            onClick={handleRegenerate}
            startIcon={<RefreshIcon />}
            color="secondary"
            sx={{ textTransform: 'none' }}
          >
            重新生成
          </Button>
        )}
        <Button
          onClick={handleCopy}
          startIcon={copying ? <CircularProgress size={16} /> : <ContentCopyIcon />}
          variant="contained"
          disabled={copying}
          sx={{ textTransform: 'none' }}
        >
          {copying ? '复制中...' : '复制反馈'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
