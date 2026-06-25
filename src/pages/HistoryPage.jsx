// HistoryPage.jsx - 历史反馈页（MUI 重写）
// 原 /workspace/newclassroom/js/pages/historyPage.js 迁移而来
//
// 功能：列表（按日期分组）/ 科目筛选 / 日期筛选 / 查看详情 / 复制 / 删除（撤销）
//      / 导出全部 + 近期 / 生成学习总结

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Stack, Typography, Button, IconButton, Chip, Card, CardContent,
  Divider, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogActions, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import SummarizeIcon from '@mui/icons-material/Summarize';
import { useData } from '../store/DataContext';
import { useSession } from '../store/SessionContext';
import { UI } from '../utils/ui';
import AiService from '../services/aiService';
import {
  generateFeedbackTitle, getModuleIcon,
  copyToClipboard, buildFeedbackText,
} from '../utils/feedback';

const DATE_FILTERS = [
  { value: 'all', label: '全部' },
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: '90d', label: '近90天' },
];

/**
 * 把反馈按日期分组（今天/昨天/M月D日）
 */
function groupByDate(history) {
  const groups = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = fmtKey(today);
  const yesterdayKey = fmtKey(yesterday);

  history.forEach(item => {
    const date = new Date(item.createdAt);
    const dateKey = fmtKey(date);
    let label;
    if (dateKey === todayKey) label = '今天';
    else if (dateKey === yesterdayKey) label = '昨天';
    else label = `${date.getMonth() + 1}月${date.getDate()}日`;
    if (!groups[dateKey]) {
      groups[dateKey] = { label, date: dateKey, items: [] };
    }
    groups[dateKey].items.push(item);
  });

  return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const { store, Storage, ready, refresh, refreshCounter } = useData();
  const session = useSession();
  const { currentStudent } = session;

  // ========== 筛选 state ==========
  const [subjectFilter, setSubjectFilter] = useState(null);
  const [dateFilter, setDateFilter] = useState('all');

  // 学生切换时重置筛选（模拟原 _lastStudentId 逻辑）
  const lastStudentIdRef = useRef(null);
  useEffect(() => {
    if (currentStudent && currentStudent.id !== lastStudentIdRef.current) {
      lastStudentIdRef.current = currentStudent.id;
      setSubjectFilter(null);
      setDateFilter('all');
    }
  }, [currentStudent]);

  // ========== 详情 Dialog ==========
  const [detailItem, setDetailItem] = useState(null);

  // ========== 学习总结 ==========
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryStudentName, setSummaryStudentName] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // ========== 数据计算 ==========
  const allHistory = useMemo(() => {
    if (!ready || !currentStudent) return [];
    return store.getFeedbackHistory(currentStudent.id, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, currentStudent, refreshCounter]);

  const subjects = useMemo(() => {
    if (!ready) return [];
    return store.getSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter]);

  const subjectMap = useMemo(() => {
    const m = {};
    subjects.forEach(s => { m[s.id] = s; });
    return m;
  }, [subjects]);

  const filteredHistory = useMemo(() => {
    let result = allHistory;
    // 科目筛选
    if (subjectFilter) {
      result = result.filter(item => item.subjectId === subjectFilter);
    }
    // 日期筛选
    if (dateFilter !== 'all') {
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[dateFilter] || 0;
      if (days > 0) {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        result = result.filter(item => new Date(item.createdAt).getTime() >= cutoff);
      }
    }
    return result;
  }, [allHistory, subjectFilter, dateFilter]);

  const groupedHistory = useMemo(() => groupByDate(filteredHistory), [filteredHistory]);

  // 每个科目的反馈数量（用于筛选栏显示）
  const subjectCounts = useMemo(() => {
    const m = {};
    allHistory.forEach(item => {
      if (item.subjectId) {
        m[item.subjectId] = (m[item.subjectId] || 0) + 1;
      }
    });
    return m;
  }, [allHistory]);

  // ========== 操作：查看详情 ==========
  const openDetail = useCallback((item) => setDetailItem(item), []);
  const closeDetail = useCallback(() => setDetailItem(null), []);

  // ========== 操作：复制单条反馈 ==========
  const handleCopyFeedback = useCallback(async (item) => {
    if (!currentStudent) return;
    const style = Storage.getStyle();
    const subject = item.subjectId ? subjects.find(s => s.id === item.subjectId) : null;
    const title = generateFeedbackTitle({
      student: currentStudent,
      group: null,
      subject,
      getStudentById: store.getStudentById.bind(store),
      style,
    });
    const text = buildFeedbackText(item.feedback || [], title);
    const ok = await copyToClipboard(text);
    if (ok) UI.showToast('已复制到剪贴板');
    else UI.showToast('复制失败，请手动复制');
  }, [currentStudent, subjects, Storage, store]);

  // ========== 操作：删除（带撤销） ==========
  const handleDelete = useCallback((feedbackId) => {
    if (!currentStudent) return;
    UI.showConfirm('确定删除这条反馈记录？', () => {
      const snapshot = store.softDeleteFeedback(currentStudent.id, feedbackId);
      refresh();
      if (snapshot) {
        UI.showUndoToast('已删除反馈', () => {
          store.restoreFeedback(snapshot);
          refresh();
        });
      }
    });
  }, [currentStudent, store, refresh]);

  // ========== 操作：导出 ==========
  const doExport = useCallback((items, filename) => {
    if (!items || items.length === 0) {
      UI.showToast('没有可导出的反馈');
      return;
    }
    let text = `课堂反馈记录\n================\n\n`;
    items.forEach(item => {
      const subject = subjectMap[item.subjectId];
      const date = new Date(item.createdAt);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      text += `【${dateStr}】${subject ? subject.name : '未分类'}\n`;
      text += '─'.repeat(30) + '\n';
      (item.feedback || []).forEach(f => {
        text += `【${f.module}】\n${f.content}\n\n`;
      });
      text += '\n';
    });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast(`已导出 ${items.length} 条反馈`);
  }, [subjectMap]);

  const exportAll = useCallback(() => {
    if (!currentStudent) return;
    doExport(allHistory, `${currentStudent.name}_全部反馈`);
  }, [currentStudent, allHistory, doExport]);

  const exportRecent = useCallback(() => {
    if (!currentStudent) return;
    doExport(allHistory.slice(0, 10), `${currentStudent.name}_近期反馈`);
  }, [currentStudent, allHistory, doExport]);

  // ========== 操作：生成学习总结 ==========
  const generateSummary = useCallback(async () => {
    if (!currentStudent) return;
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      UI.showToast('请先设置 API Key');
      navigate('/settings');
      return;
    }
    const history = store.getFeedbackHistory(currentStudent.id, 20);
    if (history.length === 0) {
      UI.showToast('暂无历史反馈，无法生成总结');
      return;
    }

    setGeneratingSummary(true);
    UI.showLoading('正在分析学习情况，请稍候...');
    try {
      const MAX_SUMMARY_LENGTH = 8000;
      let feedbackSummary = '';
      let totalLength = 0;

      for (let i = 0; i < Math.min(history.length, 15); i++) {
        const item = history[i];
        const subject = store.getSubjectById(item.subjectId);
        const date = new Date(item.createdAt);
        const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
        const content = (item.feedback || []).map(f => {
          return `${f.module}：${f.content.substring(0, 60)}`;
        }).join('\n');
        const entry = `第${i + 1}次课（${dateStr} ${subject ? subject.name : '未分类'}）：\n${content}`;

        if (totalLength + entry.length > MAX_SUMMARY_LENGTH) {
          feedbackSummary += '\n\n...（更多历史记录已省略）';
          break;
        }
        feedbackSummary += (i > 0 ? '\n\n' : '') + entry;
        totalLength += entry.length + 2;
      }

      const prompt = `你是一位专业的教育培训老师，需要根据学生的课堂反馈历史，生成一份学习总结报告。

## 学生信息
- 姓名：${currentStudent.name}
- 反馈次数：${history.length}次

## 历史反馈记录
${feedbackSummary}

## 生成要求
请生成一份结构化的学习总结，包含以下内容：
1. 整体学习情况概述（2-3句话）
2. 主要进步点（列举2-3点）
3. 需要加强的方面（列举2-3点）
4. 后续学习建议（具体可行）

语气要求：
- 客观中肯，既有肯定也有建议
- 不要编造未提及的内容
- 总字数控制在300-500字

## 输出格式
请按以下格式输出：

【整体情况】
（内容）

【主要进步】
（内容）

【需要加强】
（内容）

【后续建议】
（内容）`;

      const content = await AiService.chatCompletion([
        { role: 'system', content: '你是一位经验丰富的教育培训老师，擅长分析学生学习情况并给出专业建议。' },
        { role: 'user', content: prompt }
      ], { temperature: 0.7, maxTokens: 1500 });

      const summary = parseSummary(content);
      setSummaryData(summary);
      setSummaryStudentName(currentStudent.name);
      setSummaryOpen(true);
    } catch (err) {
      UI.showToast('生成总结失败：' + err.message);
    } finally {
      UI.hideLoading();
      setGeneratingSummary(false);
    }
  }, [currentStudent, Storage, store, navigate]);

  // ========== 操作：复制总结 ==========
  const handleCopySummary = useCallback(async () => {
    if (!summaryData) return;
    const text = summaryData.map(s => `【${s.title}】\n${s.content}`).join('\n\n');
    const fullText = `${summaryStudentName} 的学习总结\n\n${text}`;
    const ok = await copyToClipboard(fullText);
    if (ok) UI.showToast('已复制到剪贴板');
    else UI.showToast('复制失败，请手动复制');
  }, [summaryData, summaryStudentName]);

  // ========== 加载中 ==========
  if (!ready) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // ========== 未选学生 ==========
  if (!currentStudent) {
    return (
      <Box>
        <Stack direction="row" sx={{ alignItems: 'center', mb: 2 }}>
          <IconButton onClick={() => navigate('/record')} aria-label="返回">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 500 }}>历史反馈</Typography>
        </Stack>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <AssessmentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">请先选择学生</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      {/* ========== 顶部标题栏 ========== */}
      <Stack direction="row" sx={{ alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate('/record')} aria-label="返回课堂录音">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 500 }} noWrap>
          {currentStudent.name} 的历史反馈
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          共 {allHistory.length} 条
        </Typography>
      </Stack>

      {/* ========== 筛选栏 ========== */}
      {allHistory.length > 0 && (
        <Box sx={{ mb: 2 }}>
          {/* 科目筛选 */}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1, useFlexGap: true }}>
            <Chip
              label="全部"
              size="small"
              color={!subjectFilter ? 'primary' : 'default'}
              variant={!subjectFilter ? 'filled' : 'outlined'}
              onClick={() => setSubjectFilter(null)}
            />
            {subjects.filter(s => subjectCounts[s.id] > 0).map(s => (
              <Chip
                key={s.id}
                label={`${s.name} (${subjectCounts[s.id]})`}
                size="small"
                color={subjectFilter === s.id ? 'primary' : 'default'}
                variant={subjectFilter === s.id ? 'filled' : 'outlined'}
                onClick={() => setSubjectFilter(s.id)}
                sx={{ borderColor: s.color }}
              />
            ))}
          </Stack>
          {/* 日期筛选 */}
          <ToggleButtonGroup
            value={dateFilter}
            exclusive
            size="small"
            onChange={(_, val) => val && setDateFilter(val)}
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            {DATE_FILTERS.map(f => (
              <ToggleButton key={f.value} value={f.value} size="small">
                {f.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}

      {/* ========== 操作栏 ========== */}
      {allHistory.length > 0 && (
        <Stack spacing={1} sx={{ mb: 2 }}>
          <Button
            variant="contained"
            startIcon={generatingSummary ? <CircularProgress size={18} color="inherit" /> : <SummarizeIcon />}
            onClick={generateSummary}
            disabled={generatingSummary}
            sx={{ textTransform: 'none', borderRadius: 20, py: 1 }}
          >
            {generatingSummary ? '生成中...' : '生成学习总结'}
          </Button>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={exportAll}
              sx={{ flex: 1, textTransform: 'none', borderRadius: 20 }}
            >
              导出全部
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={exportRecent}
              sx={{ flex: 1, textTransform: 'none', borderRadius: 20 }}
            >
              导出近期
            </Button>
          </Stack>
        </Stack>
      )}

      {/* ========== 反馈列表 ========== */}
      {filteredHistory.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <AssessmentIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            {subjectFilter ? '该科目暂无历史反馈' : '暂无历史反馈'}
          </Typography>
          {subjectFilter ? (
            <Button size="small" onClick={() => setSubjectFilter(null)} sx={{ mt: 1 }}>
              查看全部反馈
            </Button>
          ) : (
            <Button size="small" onClick={() => navigate('/record')} sx={{ mt: 1 }}>
              去生成第一条反馈
            </Button>
          )}
        </Box>
      ) : (
        <Stack spacing={2}>
          {groupedHistory.map(group => (
            <Box key={group.date}>
              <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>{group.label}</Typography>
                <Typography variant="caption" color="text.secondary">{group.items.length}条</Typography>
              </Stack>
              <Divider sx={{ mb: 1 }} />
              <Stack spacing={1.5}>
                {group.items.map(item => {
                  const subject = subjectMap[item.subjectId];
                  const date = new Date(item.createdAt);
                  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                  const rawContent = item.feedback && item.feedback[0] ? item.feedback[0].content : '';
                  const summary = rawContent
                    ? (rawContent.length > 60 ? rawContent.substring(0, 60) + '...' : rawContent)
                    : '无内容';
                  return (
                    <Card
                      key={item.id}
                      variant="outlined"
                      sx={{
                        borderLeft: 3,
                        borderColor: subject?.color || 'primary.main',
                      }}
                    >
                      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography variant="caption" sx={{ color: subject?.color || 'text.secondary', fontWeight: 500 }}>
                            {subject ? subject.name : '未分类'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">{dateStr}</Typography>
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{
                            mb: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {summary}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Button
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={() => openDetail(item)}
                            sx={{ textTransform: 'none' }}
                          >
                            查看
                          </Button>
                          <Button
                            size="small"
                            startIcon={<ContentCopyIcon />}
                            onClick={() => handleCopyFeedback(item)}
                            sx={{ textTransform: 'none' }}
                          >
                            复制
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={() => handleDelete(item.id)}
                            sx={{ textTransform: 'none' }}
                          >
                            删除
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      {/* ========== 详情 Dialog ========== */}
      <Dialog open={!!detailItem} onClose={closeDetail} fullWidth maxWidth="sm">
        {detailItem && (
          <>
            <DialogTitle sx={{ pb: 0.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {(() => {
                  const subject = subjectMap[detailItem.subjectId];
                  return subject ? subject.name : '未分类';
                })()}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 'normal', mt: 0.25 }}>
                {(() => {
                  const date = new Date(detailItem.createdAt);
                  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
                })()}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                {(detailItem.feedback || []).map((f, i) => (
                  <Box key={i}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 0.5 }}>
                      {getModuleIcon(f.module)} 【{f.module}】
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {f.content}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={closeDetail}>关闭</Button>
              <Button
                variant="contained"
                startIcon={<ContentCopyIcon />}
                onClick={() => {
                  handleCopyFeedback(detailItem);
                }}
                sx={{ textTransform: 'none' }}
              >
                复制此反馈
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ========== 学习总结 Dialog ========== */}
      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{summaryStudentName} 的学习总结</DialogTitle>
        <DialogContent dividers>
          {summaryData && (
            <Stack spacing={2}>
              {summaryData.map((s, i) => (
                <Box key={i}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 500, mb: 0.5 }}>
                    【{s.title}】
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {s.content}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)}>关闭</Button>
          <Button
            variant="contained"
            startIcon={<ContentCopyIcon />}
            onClick={handleCopySummary}
            sx={{ textTransform: 'none' }}
          >
            复制总结
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/**
 * 解析 AI 返回的学习总结内容
 * 已知 section：整体情况 / 主要进步 / 需要加强 / 后续建议
 */
function parseSummary(content) {
  const KNOWN_SECTIONS = ['整体情况', '主要进步', '需要加强', '后续建议'];
  const sections = [];
  const lines = content.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const match = line.match(/【(.+)】/);
    if (match && KNOWN_SECTIONS.includes(match[1].trim())) {
      if (currentSection) {
        sections.push({
          title: currentSection,
          content: currentContent.join('\n').trim()
        });
      }
      currentSection = match[1].trim();
      currentContent = [];
    } else if (currentSection && line.trim()) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections.push({
      title: currentSection,
      content: currentContent.join('\n').trim()
    });
  }

  return sections;
}
