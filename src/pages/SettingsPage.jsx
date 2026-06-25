// SettingsPage.jsx - 系统设置页（MUI 重写）
// 原 /workspace/newclassroom/js/pages/settingsPage.js 迁移而来
//
// 功能分组（用 Card 分区）：
// 1. API Key 设置（含显示/隐藏、验证、高级设置 API 基础地址）
// 2. 语音识别设置（浏览器内置 / 本地AI Whisper + 预加载按钮）
// 3. 反馈风格设置（语气、分点、Emoji+位置、姓名截取、严格输入、家长协助、自定义日期、按模块字数）
// 4. 科目管理（添加/删除/改颜色）
// 5. Prompt 模板库（新建/编辑/复制/删除/应用到科目）
// 6. 临时备注 + 科目专属设置
// 7. 反馈模块设置（启用/禁用/排序/删除/添加自定义+描述）
// 8. 界面主题（亮/暗切换由 ThemeContext 处理，此处提供入口）
// 9. 录音日志（查看/导出/清空）
// 10. 数据管理（导出/导入/清空）

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Stack, Typography, Button, IconButton, TextField, MenuItem, Select,
  Card, CardContent, CardHeader, Switch, FormControlLabel, Checkbox,
  ToggleButtonGroup, ToggleButton, Slider, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, Chip, CircularProgress, Alert, Collapse, InputAdornment,
  FormControl, InputLabel, FilledInput, ListItem, ListItemIcon, ListItemText,
  List, ListItemSecondaryAction, Paper, Menu, MenuItem as MuiMenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import DescriptionIcon from '@mui/icons-material/Description';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PaletteIcon from '@mui/icons-material/Palette';
import KeyIcon from '@mui/icons-material/Key';
import MicIcon from '@mui/icons-material/Mic';
import StyleIcon from '@mui/icons-material/Style';
import SchoolIcon from '@mui/icons-material/School';
import ListAltIcon from '@mui/icons-material/ListAlt';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SubjectIcon from '@mui/icons-material/Subject';
import AssessmentIcon from '@mui/icons-material/Assessment';
import StorageIcon from '@mui/icons-material/Storage';
import { useData } from '../store/DataContext';
import { useThemeMode } from '../contexts/ThemeContext';
import { UI } from '../utils/ui';
import AiService from '../services/aiService';
import { getRecorderEngine } from '../services/recorderHolder';
import { exportData, importData } from '../utils/dataTransfer';
import { generateFeedbackTitle, getModuleIcon } from '../utils/feedback';

// 智能分析：可推断项的中文标签映射（用于改动反馈卡片展示）
const ANALYSIS_LABELS = {
  tone: '语气风格',
  useEmoji: '使用 Emoji',
  emojiPosition: 'Emoji 位置',
  useBulletPoints: '分点输出',
  nameShorten: '姓名缩写',
  includeParentHelp: '包含家长协助',
  strictInput: '严格遵循输入',
  titleTemplate: '标题模板',
  titleDateFormat: '日期格式',
  institutionName: '机构名',
  teacherName: '老师名',
  moduleWrap: '模块包裹符号',
  moduleSeparator: '模块分隔符',
  commonModules: '公共模块',
  groupAddressTerm: '集体称谓',
  useOpening: '启用开场白',
  feedbackOpening: '开场白',
  useClosing: '启用结尾话术',
  feedbackClosing: '结尾话术',
  studentAddress: '学生称呼',
  parentAddress: '家长称呼',
  useAttachmentHint: '附件提示',
  attachmentHint: '附件提示文本',
  customPrompt: '整体备注',
  modules: '模块列表',
};

// 把字段值映射成可读文本（用于改动反馈卡片）
const TONE_LABELS = {
  friendly: '亲切', formal: '正式', concise: '简洁',
  detailed: '详细', humorous: '幽默', encouraging: '鼓励',
};
const WRAP_LABELS = {
  '【】': '【】', '[]': '[]', '（）': '（）', '·': '·', none: '无',
};
const SEP_LABELS = {
  '\n\n': '空行', '\n': '单换行', '\n---\n': '横线', '\n\n---\n\n': '空行+横线',
};
const DATE_FMT_LABELS = {
  'M.D': 'M.D', 'MM-DD': 'MM-DD', 'X月X日': 'X月X日', 'YYYY-MM-DD': 'YYYY-MM-DD',
};

function formatValue(key, val) {
  if (val === null || val === undefined || val === '') return '（空）';
  switch (key) {
    case 'tone': return TONE_LABELS[val] || String(val);
    case 'useEmoji':
    case 'useBulletPoints':
    case 'includeParentHelp':
    case 'strictInput':
      return val ? '是' : '否';
    case 'nameShorten': return val ? '缩写' : '不缩写';
    case 'moduleWrap': return WRAP_LABELS[val] || String(val);
    case 'moduleSeparator': return SEP_LABELS[val] || JSON.stringify(val);
    case 'titleDateFormat': return DATE_FMT_LABELS[val] || String(val);
    case 'modules':
      return Array.isArray(val) ? `${val.length} 个模块` : String(val);
    default: return String(val);
  }
}

// 语气风格选项
const TONE_OPTIONS = [
  { value: 'friendly', label: '亲切', icon: '😊' },
  { value: 'formal', label: '正式', icon: '👔' },
  { value: 'concise', label: '简洁', icon: '⚡' },
  { value: 'detailed', label: '详细', icon: '📝' },
  { value: 'humorous', label: '幽默', icon: '😄' },
  { value: 'encouraging', label: '鼓励', icon: '💪' },
];

// Emoji 位置选项
const EMOJI_POSITION_OPTIONS = [
  { value: 'content', label: '融入内容' },
  { value: 'title', label: '标题后' },
  { value: 'end', label: '模块末尾' },
];

// Prompt 模板分类
const PROMPT_CATEGORIES = ['反馈风格', '家长沟通', '问题导向', '学科特色'];

// 科目颜色候选
const SUBJECT_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

// 日期格式选项
const DATE_FORMAT_OPTIONS = [
  { value: 'M.D', label: 'M.D（如 6.25）' },
  { value: 'MM-DD', label: 'MM-DD（如 06-25）' },
  { value: 'X月X日', label: 'X月X日（如 6月25日）' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD（如 2026-06-25）' },
];

// 标题模板默认值（与 DEFAULT_STYLE.titleTemplate 保持一致）
const DEFAULT_TITLE_TEMPLATE = '{日期}{姓名}{科目}{试听}课堂反馈';

// 模块名包裹符号选项
const MODULE_WRAP_OPTIONS = [
  { value: '【】', label: '【】中文方头括号' },
  { value: '[]', label: '[] 英文方括号' },
  { value: '（）', label: '（）中文圆括号' },
  { value: '·', label: '· 间隔号（仅前缀）' },
  { value: 'none', label: '无包裹符号' },
];

// 模块间分隔符选项
const MODULE_SEPARATOR_OPTIONS = [
  { value: '\n\n', label: '空行分隔' },
  { value: '\n', label: '单换行' },
  { value: '\n---\n', label: '横线分隔' },
  { value: '\n\n---\n\n', label: '空行+横线+空行' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { store, Storage, ready, refresh, refreshCounter } = useData();
  const { mode, toggleMode } = useThemeMode();

  // ========== 本地 state（从 Storage 加载） ==========
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState(null); // null=未验证, true=有效, false=无效
  const [apiKeyValidating, setApiKeyValidating] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiModel, setApiModel] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [speechProvider, setSpeechProvider] = useState('browser');

  const [style, setStyle] = useState(() => Storage?.getStyle() || {});
  const [modules, setModules] = useState([]);
  const [moduleLengths, setModuleLengths] = useState({});

  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState('');
  // 批次2：当前展开编辑的模块索引（null 表示都收起）
  const [expandedModuleIndex, setExpandedModuleIndex] = useState(null);

  // 智能分析：多样本列表 + 分析状态 + 改动反馈 Alert
  const [samples, setSamples] = useState([]);          // 已添加的样本数组
  const [sampleInput, setSampleInput] = useState('');  // 当前输入框内容
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const analysisAbortRef = useRef(null);
  // 改动反馈 Alert
  const [analysisChanges, setAnalysisChanges] = useState(null);  // [{key,label,oldValue,newValue}] 或 null
  const [analysisSnapshot, setAnalysisSnapshot] = useState(null); // 应用前快照，用于撤销
  const [analysisAlertVisible, setAnalysisAlertVisible] = useState(false);
  const [analysisAlertExpanded, setAnalysisAlertExpanded] = useState(false);
  const analysisAlertTimerRef = useRef(null);

  // 挂载时从 Storage 初始化所有 state
  useEffect(() => {
    if (!ready || !Storage) return;
    const savedKey = Storage.getApiKey() || '';
    setApiKey(savedKey);
    setApiBaseUrl(Storage.getApiBaseUrl() || '');
    setApiModel(Storage.getApiModel() || '');
    const s = Storage.getStyle();
    setStyle(s);
    setModuleLengths(s.moduleLengths || {});
    setModules(Storage.getModules());
    setSpeechProvider(Storage.getSpeechConfig().provider || 'browser');
    setCustomPrompt(s.customPrompt || '');
    setUseCustomDate(!!s.useCustomDate);
    setCustomDate(s.customDate || '');
    // 初始化时若有已保存的 API Key，自动验证（直接读 Storage，避免闭包陈旧）
    if (savedKey) {
      validateApiKey(savedKey);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // ========== API Key 验证 ==========
  // 接受可选参数：传入需要验证的 key（避免闭包陈旧），不传则用当前 state
  const validateApiKey = useCallback(async (keyToValidate) => {
    const key = (keyToValidate !== undefined ? keyToValidate : apiKey).trim();
    if (!key) {
      setApiKeyValid(null);
      return;
    }
    setApiKeyValidating(true);
    try {
      const ok = await AiService.validateApiKey(key);
      setApiKeyValid(ok);
    } catch {
      setApiKeyValid(false);
    } finally {
      setApiKeyValidating(false);
    }
  }, [apiKey]);

  // 首次加载时已在上面的 init effect 中触发验证，此处不再重复

  // ========== 保存所有设置 ==========
  const handleSave = useCallback(async () => {
    const trimmedKey = apiKey.trim();
    const prevKey = Storage.getApiKey() || '';
    const keyChanged = trimmedKey !== prevKey;

    // API Key
    Storage.setApiKey(trimmedKey);
    Storage.setApiBaseUrl(apiBaseUrl.trim());
    Storage.setApiModel(apiModel.trim());

    // 风格设置
    const newStyle = {
      ...style,
      customPrompt: customPrompt.trim(),
      useCustomDate,
      customDate,
      moduleLengths,
      language: 'zh',
    };
    Storage.saveStyle(newStyle);
    setStyle(newStyle);

    // 模块（含描述）
    Storage.saveModules(modules);

    // 语音识别配置
    Storage.saveSpeechConfig({ provider: speechProvider });

    UI.showToast('设置已保存');
    refresh();

    // 仅当 API Key 变化时重新验证
    if (keyChanged) {
      validateApiKey(trimmedKey);
    }
  }, [apiKey, apiBaseUrl, apiModel, style, customPrompt, useCustomDate, customDate, moduleLengths, modules, speechProvider, Storage, refresh, validateApiKey]);

  // ========== 科目管理 ==========
  const subjects = useMemo(() => {
    if (!ready) return [];
    return store.getSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter]);

  const handleAddSubject = useCallback(() => {
    const name = window.prompt('请输入科目名称：');
    if (name && name.trim()) {
      const randomColor = SUBJECT_COLORS[Math.floor(Math.random() * SUBJECT_COLORS.length)];
      store.addSubject(name.trim(), randomColor);
      refresh();
      UI.showToast('科目已添加');
    }
  }, [store, refresh]);

  const handleDeleteSubject = useCallback((id) => {
    UI.showConfirm('确定删除这个科目？相关学生关联也将被移除。', () => {
      store.deleteSubject(id);
      refresh();
      UI.showToast('科目已删除');
    });
  }, [store, refresh]);

  const handleSubjectColorChange = useCallback((id, color) => {
    store.updateSubject(id, { color });
    refresh();
  }, [store, refresh]);

  // ========== 反馈模块管理 ==========
  const handleToggleModule = useCallback((index) => {
    Storage.toggleModule(index);
    setModules(Storage.getModules());
  }, [Storage]);

  const handleMoveModule = useCallback((index, direction) => {
    Storage.swapModule(index, direction);
    setModules(Storage.getModules());
  }, [Storage]);

  const handleDeleteModule = useCallback((index) => {
    UI.showConfirm('确定删除这个模块？', () => {
      const removedName = modules[index]?.name;
      Storage.deleteModule(index);
      setModules(Storage.getModules());
      // 同步清理 moduleLengths 中的孤儿条目，避免 style.moduleLengths 残留脏数据
      if (removedName) {
        setModuleLengths(prev => {
          if (!prev[removedName]) return prev;
          const next = { ...prev };
          delete next[removedName];
          return next;
        });
      }
      UI.showToast('模块已删除');
    });
  }, [modules, Storage]);

  const handleAddModule = useCallback(() => {
    const name = window.prompt('请输入模块名称：');
    if (name && name.trim()) {
      Storage.addModule(name.trim());
      setModules(Storage.getModules());
      UI.showToast('模块已添加');
    }
  }, [Storage]);

  const handleModuleDescChange = useCallback((index, desc) => {
    const newModules = [...modules];
    if (newModules[index] && newModules[index].custom) {
      newModules[index] = { ...newModules[index], description: desc };
      Storage.saveModules(newModules);
      setModules(newModules);
    }
  }, [modules, Storage]);

  // 批次2：模块字段通用更新（支持 icon/prompt/description，对所有模块开放，不限 custom）
  const handleModuleFieldChange = useCallback((index, field, value) => {
    const newModules = [...modules];
    if (!newModules[index]) return;
    newModules[index] = { ...newModules[index], [field]: value };
    Storage.saveModules(newModules);
    setModules(newModules);
  }, [modules, Storage]);

  // 批次2：模块重命名（同步迁移 moduleLengths 的键，保留字数配置）
  const handleModuleRename = useCallback((index, newName) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const newModules = [...modules];
    if (!newModules[index]) return;
    const oldName = newModules[index].name;
    if (trimmed === oldName) return;
    // 防止与其他模块重名
    if (newModules.some((m, i) => i !== index && m.name === trimmed)) {
      UI.showToast('已存在同名模块');
      return;
    }
    newModules[index] = { ...newModules[index], name: trimmed };
    Storage.saveModules(newModules);
    setModules(newModules);
    // 同步迁移 moduleLengths 的键
    setModuleLengths(prev => {
      if (!prev[oldName]) return prev;
      const next = { ...prev };
      next[trimmed] = next[oldName];
      delete next[oldName];
      return next;
    });
  }, [modules, Storage]);

  // ========== 智能分析：添加/删除/清空样本 ==========
  const handleAddSample = useCallback(() => {
    const text = sampleInput.trim();
    if (!text) {
      UI.showToast('请先粘贴一段反馈样本');
      return;
    }
    setSamples(prev => [...prev, text]);
    setSampleInput('');
  }, [sampleInput]);

  const handleRemoveSample = useCallback((idx) => {
    setSamples(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleClearSamples = useCallback(() => {
    if (samples.length === 0) return;
    UI.showConfirm(`确定清空全部 ${samples.length} 条样本？`, () => {
      setSamples([]);
      UI.showToast('已清空样本列表');
    });
  }, [samples.length]);

  // ========== 智能分析：调用 AI 分析多样本并自动应用 ==========
  const handleStartAnalysis = useCallback(async () => {
    if (samples.length === 0) {
      UI.showToast('请先添加至少一段反馈样本');
      return;
    }
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      UI.showToast('请先设置 API Key');
      return;
    }

    // 应用前快照（用于撤销）
    const snapshot = {
      style: { ...style },
      modules: modules.map(m => ({ ...m })),
      moduleLengths: { ...moduleLengths },
      customPrompt,
    };

    setAnalysisError(null);
    setAnalyzing(true);
    setAnalysisChanges(null);
    setAnalysisAlertVisible(false);
    const abortController = new AbortController();
    analysisAbortRef.current = abortController;

    try {
      const result = await AiService.analyzeFeedbackStyle(samples, { signal: abortController.signal });
      // 自动应用：把所有"可推断"字段（非 null/非空）直接覆盖到 style/modules
      // 同时收集"被改动的项"用于反馈卡片
      const changes = [];
      const oldStyle = { ...style };
      const oldModules = modules;
      const oldModuleLengths = { ...moduleLengths };
      const newStyle = { ...oldStyle };
      let newCustomPrompt = customPrompt;

      const inferable = (v) => v !== null && v !== undefined && v !== '';

      const styleKeys = [
        'tone', 'useEmoji', 'emojiPosition', 'useBulletPoints',
        'nameShorten', 'includeParentHelp', 'strictInput',
        'titleTemplate', 'titleDateFormat', 'institutionName', 'teacherName',
        'moduleWrap', 'moduleSeparator',
        'commonModules', 'groupAddressTerm',
        'useOpening', 'feedbackOpening', 'useClosing', 'feedbackClosing',
        'studentAddress', 'parentAddress',
        'useAttachmentHint', 'attachmentHint',
      ];
      for (const key of styleKeys) {
        if (inferable(result[key])) {
          const oldVal = oldStyle[key];
          const newVal = result[key];
          // 比较是否真的变化（考虑 undefined 与默认值等价的情况）
          if (String(oldVal ?? '') !== String(newVal)) {
            changes.push({
              key,
              label: ANALYSIS_LABELS[key] || key,
              oldValue: formatValue(key, oldVal),
              newValue: formatValue(key, newVal),
            });
            newStyle[key] = newVal;
          }
        }
      }

      // customPrompt 单独处理（同时同步 local state）
      if (inferable(result.customPrompt)) {
        if ((oldStyle.customPrompt || '') !== result.customPrompt) {
          changes.push({
            key: 'customPrompt',
            label: ANALYSIS_LABELS.customPrompt,
            oldValue: formatValue('customPrompt', oldStyle.customPrompt),
            newValue: formatValue('customPrompt', result.customPrompt),
          });
          newStyle.customPrompt = result.customPrompt;
          newCustomPrompt = result.customPrompt;
        }
      }

      // 模块：替换模式（保留 enabled/custom，否则按 AI 推断）
      let newModules = oldModules;
      let newLengths = { ...oldModuleLengths };
      if (Array.isArray(result.modules) && result.modules.length > 0) {
        newModules = result.modules.map(im => {
          const existing = oldModules.find(m => m.name === im.name);
          const built = {
            name: im.name,
            enabled: existing ? existing.enabled : true,
            custom: existing ? existing.custom : true,
            description: existing ? existing.description : '',
          };
          if (im.icon) built.icon = im.icon;
          else if (existing && existing.icon) built.icon = existing.icon;
          if (im.prompt) built.prompt = im.prompt;
          else if (existing && existing.prompt) built.prompt = existing.prompt;
          return built;
        });
        // 同步 moduleLengths
        for (const im of result.modules) {
          if (typeof im.minLength === 'number' && typeof im.maxLength === 'number') {
            newLengths[im.name] = { min: im.minLength, max: im.maxLength };
          }
        }
        // 模块整体作为一项改动
        const oldNames = oldModules.map(m => m.name).join('、') || '（空）';
        const newNames = newModules.map(m => m.name).join('、') || '（空）';
        if (oldNames !== newNames) {
          changes.push({
            key: 'modules',
            label: ANALYSIS_LABELS.modules,
            oldValue: `${oldModules.length} 个：${oldNames}`,
            newValue: `${newModules.length} 个：${newNames}`,
          });
        }
        newStyle.moduleLengths = newLengths;
      }

      // 持久化
      Storage.saveStyle(newStyle);
      Storage.saveModules(newModules);
      setStyle(newStyle);
      setModules(newModules);
      setModuleLengths(newLengths);
      setCustomPrompt(newCustomPrompt);

      // 显示改动反馈 Alert
      setAnalysisSnapshot(snapshot);
      setAnalysisChanges(changes);
      setAnalysisAlertVisible(true);
      setAnalysisAlertExpanded(false);

      // 30 秒后自动消失
      if (analysisAlertTimerRef.current) clearTimeout(analysisAlertTimerRef.current);
      analysisAlertTimerRef.current = setTimeout(() => {
        setAnalysisAlertVisible(false);
        analysisAlertTimerRef.current = null;
      }, 30000);

      UI.showToast(changes.length > 0
        ? `AI 已自动调节 ${changes.length} 项设置`
        : 'AI 分析完成，无配置需要调整');
    } catch (err) {
      if (err.name === 'AbortError') return;
      setAnalysisError(err.message || '分析失败');
      UI.showToast(`分析失败：${err.message || '未知错误'}`);
    } finally {
      setAnalyzing(false);
      analysisAbortRef.current = null;
    }
  }, [samples, style, modules, moduleLengths, customPrompt, Storage]);

  // ========== 智能分析：撤销上次自动应用 ==========
  const handleUndoAnalysis = useCallback(() => {
    if (!analysisSnapshot) return;
    const snap = analysisSnapshot;
    Storage.saveStyle(snap.style);
    Storage.saveModules(snap.modules);
    setStyle(snap.style);
    setModules(snap.modules);
    setModuleLengths(snap.moduleLengths);
    setCustomPrompt(snap.customPrompt);
    setAnalysisAlertVisible(false);
    setAnalysisChanges(null);
    setAnalysisSnapshot(null);
    if (analysisAlertTimerRef.current) {
      clearTimeout(analysisAlertTimerRef.current);
      analysisAlertTimerRef.current = null;
    }
    UI.showToast('已撤销 AI 自动调节');
  }, [analysisSnapshot, Storage]);

  // 关闭 Alert
  const handleCloseAnalysisAlert = useCallback(() => {
    setAnalysisAlertVisible(false);
    if (analysisAlertTimerRef.current) {
      clearTimeout(analysisAlertTimerRef.current);
      analysisAlertTimerRef.current = null;
    }
  }, []);

  // 卸载时中止进行中的分析请求 + 清理 Alert 定时器
  useEffect(() => {
    return () => {
      if (analysisAbortRef.current) {
        analysisAbortRef.current.abort();
        analysisAbortRef.current = null;
      }
      if (analysisAlertTimerRef.current) {
        clearTimeout(analysisAlertTimerRef.current);
        analysisAlertTimerRef.current = null;
      }
    };
  }, []);

  // ========== 模块字数限制 ==========
  const handleModuleLengthChange = useCallback((moduleName, field, value) => {
    setModuleLengths(prev => ({
      ...prev,
      [moduleName]: { ...prev[moduleName], [field]: value },
    }));
  }, []);

  // ========== Prompt 模板管理 ==========
  const promptTemplates = useMemo(() => {
    if (!ready) return [];
    return store.getPromptTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter]);

  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', category: PROMPT_CATEGORIES[0], prompt: '' });

  const openNewTemplateForm = useCallback(() => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', description: '', category: PROMPT_CATEGORIES[0], prompt: '' });
    setTemplateFormOpen(true);
  }, []);

  const openEditTemplateForm = useCallback((template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || '',
      category: template.category,
      prompt: template.prompt,
    });
    setTemplateFormOpen(true);
  }, []);

  const handleSaveTemplate = useCallback(() => {
    const { name, description, category, prompt } = templateForm;
    if (!name.trim()) {
      UI.showToast('请输入模板名称');
      return;
    }
    if (!prompt.trim()) {
      UI.showToast('请输入 Prompt 内容');
      return;
    }
    if (editingTemplate) {
      store.updatePromptTemplate(editingTemplate.id, { name: name.trim(), description: description.trim(), category, prompt: prompt.trim() });
      UI.showToast('模板已更新');
    } else {
      store.addPromptTemplate({ name: name.trim(), description: description.trim(), category, prompt: prompt.trim() });
      UI.showToast('模板已创建');
    }
    setTemplateFormOpen(false);
    refresh();
  }, [templateForm, editingTemplate, store, refresh]);

  const handleCopyTemplate = useCallback((template) => {
    store.addPromptTemplate({
      name: template.name + '（副本）',
      description: template.description,
      category: template.category,
      prompt: template.prompt,
      modules: template.modules,
    });
    UI.showToast('模板已复制');
    refresh();
  }, [store, refresh]);

  const handleDeleteTemplate = useCallback((templateId) => {
    UI.showConfirm('确定删除这个模板？', () => {
      const result = store.deletePromptTemplate(templateId);
      if (result) {
        UI.showToast('模板已删除');
      } else {
        UI.showToast('预置模板不可删除');
      }
      refresh();
    });
  }, [store, refresh]);

  // ========== 科目专属模板 ==========
  const [subjectTemplateEditorOpen, setSubjectTemplateEditorOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectTemplatePrompt, setSubjectTemplatePrompt] = useState('');

  // ========== Prompt 模板"应用到科目"菜单 ==========
  const [applyMenuAnchor, setApplyMenuAnchor] = useState(null);
  const [applyMenuTemplateId, setApplyMenuTemplateId] = useState(null);

  const openSubjectTemplateEditor = useCallback((subjectId) => {
    const subject = store.getSubjectById(subjectId);
    if (!subject) return;
    const existing = store.getSubjectTemplate(subjectId);
    setEditingSubject(subject);
    setSubjectTemplatePrompt(existing && existing.prompt ? existing.prompt : '');
    setSubjectTemplateEditorOpen(true);
  }, [store]);

  const handleSaveSubjectTemplate = useCallback(() => {
    if (!editingSubject) return;
    const prompt = subjectTemplatePrompt.trim();
    if (prompt) {
      store.setSubjectTemplate(editingSubject.id, { prompt, updatedAt: new Date().toISOString() });
      UI.showToast('科目模板已保存');
    } else {
      store.deleteSubjectTemplate(editingSubject.id);
      UI.showToast('科目模板已清空');
    }
    setSubjectTemplateEditorOpen(false);
    refresh();
  }, [editingSubject, subjectTemplatePrompt, store, refresh]);

  const handleApplyTemplateToSubject = useCallback((templateId, subjectId) => {
    const template = store.getPromptTemplateById(templateId);
    if (!template) return;
    const existing = store.getSubjectTemplate(subjectId);
    const existingPrompt = existing && existing.prompt ? existing.prompt : '';
    const newPrompt = existingPrompt ? existingPrompt + '\n\n' + template.prompt : template.prompt;
    store.setSubjectTemplate(subjectId, { prompt: newPrompt, updatedAt: new Date().toISOString() });
    UI.showToast(`已将「${template.name}」应用到科目`);
    refresh();
  }, [store, refresh]);

  // 打开"应用到科目"菜单（绑定到模板卡片上的按钮）
  const openApplyToSubjectMenu = useCallback((event, templateId) => {
    setApplyMenuAnchor(event.currentTarget);
    setApplyMenuTemplateId(templateId);
  }, []);

  const closeApplyToSubjectMenu = useCallback(() => {
    setApplyMenuAnchor(null);
    setApplyMenuTemplateId(null);
  }, []);

  const handleApplyToSubjectFromMenu = useCallback((subjectId) => {
    if (applyMenuTemplateId) {
      handleApplyTemplateToSubject(applyMenuTemplateId, subjectId);
    }
    closeApplyToSubjectMenu();
  }, [applyMenuTemplateId, handleApplyTemplateToSubject, closeApplyToSubjectMenu]);

  // ========== 数据导入导出 ==========
  const fileInputRef = useRef(null);

  const handleExport = useCallback(() => {
    exportData();
    // 触发刷新，让 backupStatus 重新计算（exportData 内部已 setLastBackupTime）
    refresh();
  }, [refresh]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    importData(file).catch(() => {});
    e.target.value = '';
  }, []);

  const handleClearAll = useCallback(() => {
    UI.showConfirm('确定清空所有数据？此操作不可恢复！', () => {
      Storage.reset();
      setTimeout(() => location.reload(), 500);
    });
  }, [Storage]);

  // ========== 录音日志 ==========
  const [logPanelOpen, setLogPanelOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('all');

  const handleViewLogs = useCallback(() => {
    const engine = getRecorderEngine();
    if (!engine) {
      UI.showToast('录音模块未加载，请先访问录音页面');
      return;
    }
    setLogs(engine.getLogs());
    setLogFilter('all');
    setLogPanelOpen(true);
  }, []);

  const handleExportLogs = useCallback(() => {
    const engine = getRecorderEngine();
    if (!engine) {
      UI.showToast('录音模块未加载');
      return;
    }
    const text = engine.exportLogs();
    if (text === '暂无录音日志') {
      UI.showToast('暂无日志可导出');
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recorder-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    UI.showToast('日志已导出');
  }, []);

  const handleClearLogs = useCallback(() => {
    UI.showConfirm('确定清空所有录音日志？', () => {
      const engine = getRecorderEngine();
      if (engine) {
        engine.clearLogs();
        setLogs([]);
        UI.showToast('录音日志已清空');
      }
    });
  }, []);

  // 日志面板内：复制到剪贴板
  const handleCopyLogs = useCallback(() => {
    const engine = getRecorderEngine();
    if (!engine) return;
    const text = engine.exportLogs();
    if (text === '暂无录音日志') {
      UI.showToast('暂无日志可复制');
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => UI.showToast('日志已复制到剪贴板'),
        () => UI.showToast('复制失败，请改用导出')
      );
    } else {
      // 降级：用 textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        UI.showToast('日志已复制到剪贴板');
      } catch {
        UI.showToast('复制失败，请改用导出');
      } finally {
        document.body.removeChild(ta);
      }
    }
  }, []);

  // 日志面板内：刷新
  const handleRefreshLogs = useCallback(() => {
    const engine = getRecorderEngine();
    if (!engine) return;
    setLogs(engine.getLogs());
    UI.showToast('日志已刷新');
  }, []);

  const filteredLogs = useMemo(() => {
    const filtered = logFilter === 'all' ? logs : logs.filter(e => e.level === logFilter);
    return [...filtered].reverse(); // 倒序，最新在顶部
  }, [logs, logFilter]);

  // ========== Whisper 预加载 ==========
  const handlePreloadWhisper = useCallback(() => {
    const engine = getRecorderEngine();
    if (!engine) {
      UI.showToast('录音模块未加载，请先访问录音页面');
      return;
    }
    if (engine.preloadWhisper) {
      engine.preloadWhisper();
    } else {
      UI.showToast('当前引擎不支持预加载');
    }
  }, []);

  // ========== 备份状态 ==========
  const backupStatus = useMemo(() => {
    if (!Storage) return null;
    const last = Storage.getLastBackupTime();
    if (!last) {
      return { type: 'warning', text: '尚未备份过数据，建议立即导出备份' };
    }
    const daysSince = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
    const dateStr = new Date(last).toLocaleDateString('zh-CN');
    if (daysSince >= 7) {
      return { type: 'warning', text: `距上次备份已 ${daysSince} 天（${dateStr}），建议导出备份` };
    }
    return { type: 'success', text: `上次备份：${dateStr}` };
    // 依赖 refreshCounter：导出后 exportData 调用 setLastBackupTime，需要 refresh 触发重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Storage, refreshCounter]);

  if (!ready) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* ========== 顶部标题栏 ========== */}
      <Stack direction="row" sx={{ alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate('/students')} aria-label="返回">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 500 }}>系统设置</Typography>
      </Stack>

      {/* ========== 顶部：AI 改动反馈 Alert（应用后出现，30秒自动消失） ========== */}
      {analysisAlertVisible && analysisChanges && (
        <Alert
          severity="success"
          icon={<AutoAwesomeIcon />}
          sx={{ mb: 2, alignItems: 'flex-start' }}
          action={
            <Stack direction="row" spacing={0.5} sx={{ mt: -0.5 }}>
              <Button
                size="small"
                color="inherit"
                onClick={handleUndoAnalysis}
                sx={{ textTransform: 'none' }}
              >
                撤销
              </Button>
              <IconButton size="small" color="inherit" onClick={handleCloseAnalysisAlert} aria-label="关闭">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            AI 已自动调节 {analysisChanges.length} 项设置
          </Typography>
          <Box
            component="span"
            sx={{ cursor: 'pointer', color: 'primary.main', textDecoration: 'underline', ml: 0.5 }}
            onClick={() => setAnalysisAlertExpanded(!analysisAlertExpanded)}
          >
            {analysisAlertExpanded ? '收起详情' : '查看详情'}
          </Box>
          {analysisAlertExpanded && (
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {analysisChanges.map((c, i) => (
                <Paper key={i} variant="outlined" sx={{ p: 0.75, bgcolor: 'background.paper' }}>
                  <Typography variant="caption" sx={{ fontWeight: 500, display: 'block' }}>
                    {c.label}
                  </Typography>
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5, useFlexGap: true }}>
                    <Chip size="small" variant="outlined" label={`原: ${c.oldValue}`} />
                    <Typography variant="caption" color="text.secondary">→</Typography>
                    <Chip size="small" color="primary" label={`新: ${c.newValue}`} />
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Alert>
      )}

      {/* ========== 智能分析（设置页核心，独立顶部卡片） ========== */}
      <Card variant="outlined" sx={{ mb: 2, borderColor: 'primary.main', borderWidth: 2, bgcolor: 'action.hover' }}>
        <CardHeader
          avatar={<AutoAwesomeIcon color="primary" />}
          title="智能分析：从样本反推配置"
          titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
          subheader="粘贴你想要的课堂反馈样本，可添加多条；AI 综合分析后自动调节下方设置，并展示每项改动"
        />
        <CardContent sx={{ pt: 0 }}>
          {/* 样本输入区 */}
          <TextField
            multiline
            minRows={3}
            maxRows={8}
            value={sampleInput}
            onChange={(e) => setSampleInput(e.target.value)}
            placeholder={'粘贴一段完整的课堂反馈样本，包含标题和各模块内容。例如：\n\n6.25小明数学课堂反馈\n\n【课堂内容】\n本节课讲解了二次函数的图像与性质...'}
            fullWidth
            size="small"
            sx={{ mb: 1 }}
          />
          <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddSample}
              disabled={!sampleInput.trim()}
              sx={{ textTransform: 'none' }}
            >
              添加样本
            </Button>
            <Typography variant="caption" color="text.secondary">
              可反复粘贴不同样本加入列表，AI 会综合所有样本判断
            </Typography>
          </Stack>

          {/* 已添加的样本列表 */}
          {samples.length > 0 && (
            <Box sx={{ mb: 1.5 }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  已添加 {samples.length} 条样本
                </Typography>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineIcon />}
                  onClick={handleClearSamples}
                  sx={{ textTransform: 'none' }}
                >
                  清空全部
                </Button>
              </Stack>
              <Stack spacing={0.75}>
                {samples.map((s, idx) => (
                  <Paper key={idx} variant="outlined" sx={{ p: 1, bgcolor: 'background.paper' }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                      <Chip label={idx + 1} size="small" color="primary" sx={{ flexShrink: 0, height: 20 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          flexGrow: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {s}
                      </Typography>
                      <IconButton size="small" onClick={() => handleRemoveSample(idx)} aria-label="删除样本">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {/* 分析错误提示 */}
          {analysisError && (
            <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>
              分析失败：{analysisError}
            </Alert>
          )}

          {/* AI 综合分析按钮 */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Button
              variant="contained"
              startIcon={analyzing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
              onClick={handleStartAnalysis}
              disabled={analyzing || samples.length === 0}
              sx={{ textTransform: 'none' }}
            >
              {analyzing ? `AI 综合分析中（${samples.length} 条）...` : `AI 综合分析并自动应用（${samples.length} 条样本）`}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
            分析后所有可推断的配置会被自动覆盖，并在顶部弹出改动反馈，可一键撤销
          </Typography>
        </CardContent>
      </Card>

      {/* 电脑端2列 masonry：CSS multi-column，卡片按高度自动流动填充，避免单列过长 */}
      <Box sx={{
        columnCount: { xs: 1, md: 2 },
        columnGap: 2,
        '& > .MuiCard-root': { mb: 2, breakInside: 'avoid', display: 'block' },
      }}>
        {/* ========== 1. API Key 设置 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<KeyIcon color="primary" />}
            title="API Key"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Stack spacing={2}>
              <TextField
                type={showApiKey ? 'text' : 'password'}
                label="DeepSeek API Key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="请输入您的 DeepSeek API Key"
                fullWidth
                autoComplete="off"
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowApiKey(!showApiKey)} edge="end" size="small">
                          {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {/* API Key 验证状态 */}
              {apiKeyValidating && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">验证中...</Typography>
                </Stack>
              )}
              {!apiKeyValidating && apiKeyValid === true && apiKey && (
                <Alert severity="success" sx={{ py: 0 }}>✅ API Key 有效</Alert>
              )}
              {!apiKeyValidating && apiKeyValid === false && apiKey && (
                <Alert severity="error" sx={{ py: 0 }}>❌ API Key 无效或已过期</Alert>
              )}
              {/* 高级设置 */}
              <Collapse in={showAdvanced}>
                <TextField
                  label="API 基础地址（可选）"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://api.deepseek.com"
                  fullWidth
                  size="small"
                  helperText="使用 DeepSeek 可留空；使用兼容接口请填写完整地址"
                  sx={{ mb: 1.5 }}
                />
                <TextField
                  label="模型名称（可选）"
                  value={apiModel}
                  onChange={(e) => setApiModel(e.target.value)}
                  placeholder="deepseek-v4-flash"
                  fullWidth
                  size="small"
                  helperText="DeepSeek 官方端点支持：deepseek-chat、deepseek-reasoner。留空使用默认值"
                />
              </Collapse>
              <Button size="small" onClick={() => setShowAdvanced(!showAdvanced)} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
                {showAdvanced ? '收起高级设置' : '高级设置'}
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {/* ========== 2. 语音识别设置 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<MicIcon color="primary" />}
            title="语音识别"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Stack spacing={2}>
              <ToggleButtonGroup
                value={speechProvider}
                exclusive
                onChange={(_, v) => {
                  if (v) {
                    setSpeechProvider(v);
                    // 即时持久化，与原版一致（避免未保存就离开丢失切换）
                    Storage.saveSpeechConfig({ provider: v });
                  }
                }}
                fullWidth
                size="small"
              >
                <ToggleButton value="browser">浏览器内置</ToggleButton>
                <ToggleButton value="whisper">本地AI</ToggleButton>
              </ToggleButtonGroup>
              {speechProvider === 'browser' && (
                <Typography variant="body2" color="text.secondary">
                  使用浏览器内置语音识别（Web Speech API），无需额外配置。推荐使用 Edge 浏览器获得最佳效果，Chrome 也可以正常使用。
                </Typography>
              )}
              {speechProvider === 'whisper' && (
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: 1, borderColor: 'divider' }}>
                  <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                    本地AI语音识别（基于 OpenAI Whisper 模型）
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>
                    ✅ 完全离线运行，无需联网，隐私安全<br />
                    ✅ 支持99+语言，中文识别准确率高<br />
                    ⚠️ 首次使用需下载模型文件（约40MB），请耐心等待<br />
                    ⚠️ 推荐使用 Edge 浏览器，设备性能越好识别越快
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handlePreloadWhisper}
                    startIcon={<CloudDownloadIcon />}
                    fullWidth
                    sx={{ textTransform: 'none' }}
                  >
                    预加载模型
                  </Button>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* ========== 3. 反馈风格设置 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<StyleIcon color="primary" />}
            title="反馈风格"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Stack spacing={2}>
              {/* 语气风格 */}
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>语气风格</Typography>
                <ToggleButtonGroup
                  value={style.tone || 'formal'}
                  exclusive
                  onChange={(_, v) => v && setStyle({ ...style, tone: v })}
                  size="small"
                  sx={{ flexWrap: 'wrap', gap: 0.5 }}
                >
                  {TONE_OPTIONS.map(opt => (
                    <ToggleButton key={opt.value} value={opt.value} sx={{ textTransform: 'none', py: 0.5 }}>
                      {opt.icon} {opt.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>

              <Divider />

              {/* 开关组 */}
              <FormControlLabel
                control={<Switch checked={!!style.useBulletPoints} onChange={(e) => setStyle({ ...style, useBulletPoints: e.target.checked })} />}
                label="允许分点输出"
              />
              <FormControlLabel
                control={<Switch checked={!!style.useEmoji} onChange={(e) => setStyle({ ...style, useEmoji: e.target.checked })} />}
                label="使用 Emoji 表情"
              />
              {/* Emoji 位置 */}
              {style.useEmoji && (
                <Box sx={{ pl: 4 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Emoji 位置</Typography>
                  <ToggleButtonGroup
                    value={style.emojiPosition || 'content'}
                    exclusive
                    onChange={(_, v) => v && setStyle({ ...style, emojiPosition: v })}
                    size="small"
                  >
                    {EMOJI_POSITION_OPTIONS.map(opt => (
                      <ToggleButton key={opt.value} value={opt.value} sx={{ textTransform: 'none' }}>{opt.label}</ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                </Box>
              )}
              <FormControlLabel
                control={<Switch checked={style.nameShorten !== false} onChange={(e) => setStyle({ ...style, nameShorten: e.target.checked })} />}
                label="姓名截取（三字名取后两字）"
              />
              <FormControlLabel
                control={<Switch checked={style.strictInput !== false} onChange={(e) => setStyle({ ...style, strictInput: e.target.checked })} />}
                label="严格遵循输入内容（不编造）"
              />
              <FormControlLabel
                control={<Switch checked={!!style.includeParentHelp} onChange={(e) => setStyle({ ...style, includeParentHelp: e.target.checked })} />}
                label='包含"请家长协助"内容'
              />

              <Divider />

              {/* 自定义日期 */}
              <Box>
                <FormControlLabel
                  control={<Switch checked={useCustomDate} onChange={(e) => setUseCustomDate(e.target.checked)} />}
                  label="使用自定义日期"
                />
                {useCustomDate && (
                  <TextField
                    type="date"
                    label="自定义日期"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    size="small"
                    sx={{ mt: 1, display: 'block' }}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                )}
              </Box>

              <Divider />

              {/* 标题模板（批次1） */}
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  反馈标题模板
                </Typography>
                <TextField
                  value={style.titleTemplate ?? DEFAULT_TITLE_TEMPLATE}
                  onChange={(e) => setStyle({ ...style, titleTemplate: e.target.value })}
                  fullWidth
                  size="small"
                  placeholder={DEFAULT_TITLE_TEMPLATE}
                  sx={{ mb: 1 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  可用占位符：{'{日期} {姓名} {科目} {试听} {机构} {老师}'}
                  （空值占位符会被替换为空字符串）
                </Typography>
                <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                  <InputLabel>日期格式</InputLabel>
                  <Select
                    value={style.titleDateFormat || 'M.D'}
                    label="日期格式"
                    onChange={(e) => setStyle({ ...style, titleDateFormat: e.target.value })}
                  >
                    {DATE_FORMAT_OPTIONS.map(opt => (
                      <MuiMenuItem key={opt.value} value={opt.value}>{opt.label}</MuiMenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    label="机构名（可选）"
                    value={style.institutionName || ''}
                    onChange={(e) => setStyle({ ...style, institutionName: e.target.value })}
                    size="small"
                    fullWidth
                    placeholder="如：新东方"
                  />
                  <TextField
                    label="老师名（可选）"
                    value={style.teacherName || ''}
                    onChange={(e) => setStyle({ ...style, teacherName: e.target.value })}
                    size="small"
                    fullWidth
                    placeholder="如：张老师"
                  />
                </Stack>
                <Paper variant="outlined" sx={{ p: 1.25, bgcolor: 'background.default' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                    标题预览
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>
                    {generateFeedbackTitle({
                      student: { name: '王小明', isTrial: false },
                      group: null,
                      subject: { name: '数学' },
                      getStudentById: () => null,
                      style,
                    })}
                  </Typography>
                </Paper>
              </Box>

              <Divider />

              {/* 按模块字数 */}
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>按模块字数</Typography>
                <Stack spacing={1}>
                  {modules.map((m) => {
                    const len = moduleLengths[m.name] || { min: 50, max: 150 };
                    return (
                      <Paper key={m.name} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ minWidth: 80 }}>{m.name}</Typography>
                          <TextField
                            type="number"
                            label="最小"
                            value={len.min}
                            onChange={(e) => handleModuleLengthChange(m.name, 'min', parseInt(e.target.value) || 50)}
                            size="small"
                            inputProps={{ min: 10, max: 1000 }}
                            sx={{ width: 90 }}
                          />
                          <Typography color="text.secondary">-</Typography>
                          <TextField
                            type="number"
                            label="最大"
                            value={len.max}
                            onChange={(e) => handleModuleLengthChange(m.name, 'max', parseInt(e.target.value) || 150)}
                            size="small"
                            inputProps={{ min: 50, max: 5000 }}
                            sx={{ width: 90 }}
                          />
                          <Typography variant="caption" color="text.secondary">字</Typography>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>

              <Divider />

              {/* 学生/家长称呼（第一期 P0-3） */}
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>学生/家长称呼</Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <TextField
                    label="学生称呼模板"
                    value={style.studentAddress || ''}
                    onChange={(e) => setStyle({ ...style, studentAddress: e.target.value })}
                    size="small"
                    fullWidth
                    placeholder="留空=沿用姓名规则；如 {name}同学"
                  />
                  <TextField
                    label="家长称呼"
                    value={style.parentAddress || ''}
                    onChange={(e) => setStyle({ ...style, parentAddress: e.target.value })}
                    size="small"
                    fullWidth
                    placeholder="留空=不指定；如 家长您好 / {student}妈妈"
                  />
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  学生称呼占位符 {`{name}`}（如 "{`{name}`}同学" → "小明同学"）；家长称呼占位符 {`{student}`}/{`{name}`}。留空则不注入额外称呼指令。
                </Typography>
              </Box>

              <Divider />

              {/* 开场白/结尾话术（第一期 P0-2） */}
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>开场白 / 结尾话术</Typography>
                <FormControlLabel
                  control={<Switch checked={!!style.useOpening} onChange={(e) => setStyle({ ...style, useOpening: e.target.checked })} />}
                  label="启用开场白"
                />
                {style.useOpening && (
                  <TextField
                    value={style.feedbackOpening || ''}
                    onChange={(e) => setStyle({ ...style, feedbackOpening: e.target.value })}
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="如：{家长}您好，我是{老师}老师，向您反馈{学生}今天{科目}课的情况"
                    sx={{ mt: 1, mb: 1 }}
                  />
                )}
                <FormControlLabel
                  control={<Switch checked={!!style.useClosing} onChange={(e) => setStyle({ ...style, useClosing: e.target.checked })} />}
                  label="启用结尾话术"
                  sx={{ mt: style.useOpening ? 0 : 1 }}
                />
                {style.useClosing && (
                  <TextField
                    value={style.feedbackClosing || ''}
                    onChange={(e) => setStyle({ ...style, feedbackClosing: e.target.value })}
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    placeholder="如：如有疑问随时联系，感谢配合！"
                    sx={{ mt: 1, mb: 1 }}
                  />
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  占位符：{`{家长} {老师} {学生} {科目} {日期} {机构}`}（复制/导出时替换，缺失则留空）
                </Typography>
              </Box>

              <Divider />

              {/* 附件提示（第一期 P0-5） */}
              <Box>
                <FormControlLabel
                  control={<Switch checked={!!style.useAttachmentHint} onChange={(e) => setStyle({ ...style, useAttachmentHint: e.target.checked })} />}
                  label="在反馈末尾追加附件提示（照片/视频）"
                />
                {style.useAttachmentHint && (
                  <TextField
                    value={style.attachmentHint ?? ''}
                    onChange={(e) => setStyle({ ...style, attachmentHint: e.target.value })}
                    size="small"
                    fullWidth
                    multiline
                    minRows={2}
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* ========== 4. 科目管理 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<SchoolIcon color="primary" />}
            title="科目管理"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
            action={
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddSubject} sx={{ textTransform: 'none' }}>添加</Button>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            {subjects.length === 0 ? (
              <Typography color="text.secondary" variant="body2">暂无科目，请点击右上角添加</Typography>
            ) : (
              <Stack spacing={1}>
                {subjects.map(s => (
                  <Paper key={s.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                      <Box
                        component="input"
                        type="color"
                        value={s.color}
                        onChange={(e) => handleSubjectColorChange(s.id, e.target.value)}
                        sx={{ width: 32, height: 32, border: 'none', borderRadius: 1, cursor: 'pointer', p: 0, bgcolor: 'transparent' }}
                      />
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>{s.name}</Typography>
                      <IconButton size="small" onClick={() => handleDeleteSubject(s.id)} aria-label="删除科目">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* ========== 5. Prompt 模板库 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<AutoAwesomeIcon color="primary" />}
            title="Prompt 模板库"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
            action={
              <Button size="small" startIcon={<AddIcon />} onClick={openNewTemplateForm} sx={{ textTransform: 'none' }}>新建</Button>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              保存和管理可复用的 Prompt 模板，在生成反馈时快速应用
            </Typography>
            {promptTemplates.length === 0 ? (
              <Typography color="text.secondary" variant="body2">暂无模板，点击右上角新建</Typography>
            ) : (
              <Stack spacing={1.5}>
                {promptTemplates.map(t => (
                  <Paper key={t.id} variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500, flexGrow: 1 }}>{t.name}</Typography>
                      {t.isDefault && <Chip label="预置" size="small" color="primary" variant="outlined" />}
                      <Chip label={t.category} size="small" variant="outlined" />
                    </Stack>
                    {t.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{t.description}</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.prompt.length > 80 ? t.prompt.substring(0, 80) + '...' : t.prompt}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => openEditTemplateForm(t)} sx={{ textTransform: 'none' }}>编辑</Button>
                      <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => handleCopyTemplate(t)} sx={{ textTransform: 'none' }}>复制</Button>
                      <Button size="small" startIcon={<SendIcon />} onClick={(e) => openApplyToSubjectMenu(e, t.id)} disabled={subjects.length === 0} sx={{ textTransform: 'none' }}>应用</Button>
                      {!t.isDefault && (
                        <Button size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => handleDeleteTemplate(t.id)} sx={{ textTransform: 'none' }}>删除</Button>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}

            {/* 临时备注 */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>临时备注（每次生成反馈时追加）</Typography>
              <TextField
                multiline
                minRows={2}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例如：本次课特别强调计算准确性…"
                fullWidth
                size="small"
              />
            </Box>
          </CardContent>
        </Card>

        {/* ========== 6. 科目专属设置 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<SubjectIcon color="primary" />}
            title="科目专属设置"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
          />
          <CardContent sx={{ pt: 0 }}>
            {subjects.length === 0 ? (
              <Typography color="text.secondary" variant="body2">暂无科目，请先添加科目</Typography>
            ) : (
              <Stack spacing={1}>
                {subjects.map(s => {
                  const template = store.getSubjectTemplate(s.id);
                  const hasTemplate = template && template.prompt;
                  return (
                    <Paper key={s.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: s.color }} />
                        <Typography variant="body2" sx={{ flexGrow: 1 }}>{s.name}</Typography>
                        {hasTemplate ? (
                          <Chip label="已配置" size="small" color="success" variant="outlined" />
                        ) : (
                          <Chip label="未配置" size="small" variant="outlined" />
                        )}
                        <Button size="small" onClick={() => openSubjectTemplateEditor(s.id)} sx={{ textTransform: 'none' }}>编辑</Button>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* ========== 7. 反馈模块设置 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<ListAltIcon color="primary" />}
            title="反馈模块"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
            action={
              <Button size="small" startIcon={<AddIcon />} onClick={handleAddModule} sx={{ textTransform: 'none' }}>添加</Button>
            }
          />
          <CardContent sx={{ pt: 0 }}>
            {/* 模块格式（包裹符号 / 分隔符） */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>模块格式</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, useFlexGap: true }}>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>模块名包裹符号</InputLabel>
                  <Select
                    value={style.moduleWrap || '【】'}
                    label="模块名包裹符号"
                    onChange={(e) => setStyle({ ...style, moduleWrap: e.target.value })}
                  >
                    {MODULE_WRAP_OPTIONS.map(opt => (
                      <MuiMenuItem key={opt.value} value={opt.value}>{opt.label}</MuiMenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 180 }}>
                  <InputLabel>模块间分隔符</InputLabel>
                  <Select
                    value={style.moduleSeparator || '\n\n'}
                    label="模块间分隔符"
                    onChange={(e) => setStyle({ ...style, moduleSeparator: e.target.value })}
                  >
                    {MODULE_SEPARATOR_OPTIONS.map(opt => (
                      <MuiMenuItem key={opt.value} value={opt.value}>{opt.label}</MuiMenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            </Box>

            {/* 小组模式：公共模块 + 集体称谓 */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>小组模式设置</Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, useFlexGap: true, alignItems: 'center' }}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>公共模块（多选）</InputLabel>
                  <Select
                    multiple
                    value={Array.isArray(style.commonModules) ? style.commonModules : ['课堂内容', '课后作业']}
                    label="公共模块（多选）"
                    onChange={(e) => setStyle({ ...style, commonModules: e.target.value })}
                    renderValue={(selected) => (selected && selected.length ? selected.join('、') : '无')}
                  >
                    {modules.map(m => (
                      <MuiMenuItem key={m.name} value={m.name}>
                        <Checkbox checked={(style.commonModules || []).includes(m.name)} />
                        <ListItemText primary={m.name} />
                      </MuiMenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  size="small"
                  label="集体称谓"
                  value={style.groupAddressTerm || '同学们'}
                  onChange={(e) => setStyle({ ...style, groupAddressTerm: e.target.value })}
                  sx={{ width: 160 }}
                  helperText="替换学生姓名"
                />
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                公共模块在小组模式下对所有学生保持一致内容，姓名替换为集体称谓
              </Typography>
            </Box>

            <Divider sx={{ mb: 1.5 }} />

            <Stack spacing={1}>
              {modules.map((m, i) => {
                const expanded = expandedModuleIndex === i;
                return (
                <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Switch
                      size="small"
                      checked={m.enabled}
                      onChange={() => handleToggleModule(i)}
                    />
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      <Box component="span" sx={{ mr: 0.5 }}>{m.icon || getModuleIcon(m.name)}</Box>
                      {m.name}
                    </Typography>
                    <IconButton size="small" onClick={() => setExpandedModuleIndex(expanded ? null : i)} aria-label="编辑模块">
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" disabled={i === 0} onClick={() => handleMoveModule(i, -1)} aria-label="上移">
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" disabled={i === modules.length - 1} onClick={() => handleMoveModule(i, 1)} aria-label="下移">
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                    {m.custom && (
                      <IconButton size="small" color="error" onClick={() => handleDeleteModule(i)} aria-label="删除模块">
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  {expanded && (
                    <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          label="图标（emoji）"
                          value={m.icon || ''}
                          onChange={(e) => handleModuleFieldChange(i, 'icon', e.target.value)}
                          size="small"
                          sx={{ width: 120 }}
                          placeholder="📖"
                        />
                        <TextField
                          label="模块名称"
                          value={m.name}
                          onChange={(e) => handleModuleRename(i, e.target.value)}
                          size="small"
                          fullWidth
                        />
                      </Stack>
                      <TextField
                        label="模块写作要求（覆盖默认 prompt）"
                        value={m.prompt || ''}
                        onChange={(e) => handleModuleFieldChange(i, 'prompt', e.target.value)}
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        placeholder="描述该模块应生成什么内容、用什么风格写。留空使用系统默认描述。"
                      />
                      <TextField
                        label="模块描述（备注，不参与 AI 生成）"
                        value={m.description || ''}
                        onChange={(e) => handleModuleFieldChange(i, 'description', e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="可选备注"
                      />
                    </Stack>
                  )}
                </Paper>
                );
              })}
            </Stack>
          </CardContent>
        </Card>

        {/* ========== 8. 界面主题 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<PaletteIcon color="primary" />}
            title="界面主题"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                当前模式：{mode === 'dark' ? '🌙 深色' : '☀️ 浅色'}
              </Typography>
              <Button variant="outlined" onClick={toggleMode} sx={{ textTransform: 'none' }}>
                切换为{mode === 'dark' ? '浅色' : '深色'}
              </Button>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              主题会跟随系统设置，也可手动切换并记忆选择
            </Typography>
          </CardContent>
        </Card>

        {/* ========== 9. 录音日志 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<DescriptionIcon color="primary" />}
            title="录音日志"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
          />
          <CardContent sx={{ pt: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              查看录音过程中的运行日志，便于排查问题
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" startIcon={<VisibilityIcon />} onClick={handleViewLogs} sx={{ flex: 1, textTransform: 'none' }}>查看</Button>
              <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={handleExportLogs} sx={{ flex: 1, textTransform: 'none' }}>导出</Button>
              <Button variant="outlined" size="small" color="error" startIcon={<DeleteOutlineIcon />} onClick={handleClearLogs} sx={{ flex: 1, textTransform: 'none' }}>清空</Button>
            </Stack>
          </CardContent>
        </Card>

        {/* ========== 10. 数据管理 ========== */}
        <Card variant="outlined">
          <CardHeader
            avatar={<StorageIcon color="primary" />}
            title="数据管理"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
          />
          <CardContent sx={{ pt: 0 }}>
            {backupStatus && (
              <Alert severity={backupStatus.type} sx={{ mb: 1.5, py: 0.5 }}>
                {backupStatus.text}
              </Alert>
            )}
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={handleExport} sx={{ flex: 1, textTransform: 'none' }}>导出</Button>
              <Button variant="outlined" size="small" startIcon={<UploadIcon />} onClick={handleImportClick} sx={{ flex: 1, textTransform: 'none' }}>导入</Button>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportFile} style={{ display: 'none' }} />
            </Stack>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteOutlineIcon />}
              onClick={handleClearAll}
              fullWidth
              sx={{ mt: 1.5, textTransform: 'none' }}
            >
              清空所有数据
            </Button>
          </CardContent>
        </Card>

      </Box>

      {/* ========== 保存按钮（固定底部，独立一行 full width） ========== */}
      <Box sx={{ position: 'sticky', bottom: 16, zIndex: 10, mt: 2 }}>
        <Button
          variant="contained"
          size="medium"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          fullWidth
          sx={{ textTransform: 'none', borderRadius: 16 }}
        >
          保存设置
        </Button>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', display: 'block', pb: 2 }}>
        课堂反馈助手 M3 · 纯前端应用，数据保存在本地
      </Typography>

      {/* ========== Prompt 模板编辑 Dialog ========== */}
      <Dialog open={templateFormOpen} onClose={() => setTemplateFormOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingTemplate ? '编辑模板' : '新建模板'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="模板名称"
              value={templateForm.name}
              onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              fullWidth
              required
              size="small"
            />
            <TextField
              label="描述"
              value={templateForm.description}
              onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel>分类</InputLabel>
              <Select
                value={templateForm.category}
                label="分类"
                onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
              >
                {PROMPT_CATEGORIES.map(c => <MuiMenuItem key={c} value={c}>{c}</MuiMenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Prompt 内容"
              value={templateForm.prompt}
              onChange={(e) => setTemplateForm({ ...templateForm, prompt: e.target.value })}
              multiline
              minRows={4}
              fullWidth
              required
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateFormOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveTemplate}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* ========== 科目专属模板编辑 Dialog ========== */}
      <Dialog open={subjectTemplateEditorOpen} onClose={() => setSubjectTemplateEditorOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>编辑科目模板 - {editingSubject?.name}</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="科目专属 Prompt"
            value={subjectTemplatePrompt}
            onChange={(e) => setSubjectTemplatePrompt(e.target.value)}
            multiline
            minRows={5}
            fullWidth
            placeholder="例如：数学科目需要强调解题思路、公式推导过程、计算准确性等..."
          />
          {/* 快速应用已有模板 */}
          {promptTemplates.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                或从模板库快速应用：
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, useFlexGap: true }}>
                {promptTemplates.map(t => (
                  <Chip
                    key={t.id}
                    label={t.name}
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const existing = subjectTemplatePrompt.trim();
                      setSubjectTemplatePrompt(existing ? existing + '\n\n' + t.prompt : t.prompt);
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {subjectTemplatePrompt && (
            <Button color="error" onClick={() => setSubjectTemplatePrompt('')} sx={{ mr: 'auto' }}>清空</Button>
          )}
          <Button onClick={() => setSubjectTemplateEditorOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveSubjectTemplate}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* ========== 录音日志查看 Dialog ========== */}
      <Dialog open={logPanelOpen} onClose={() => setLogPanelOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>录音日志 ({logs.length}条)</Box>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                size="small"
              >
                <MuiMenuItem value="all">全部</MuiMenuItem>
                <MuiMenuItem value="error">错误</MuiMenuItem>
                <MuiMenuItem value="warn">警告</MuiMenuItem>
                <MuiMenuItem value="info">信息</MuiMenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {filteredLogs.length === 0 ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              {logs.length === 0 ? '暂无日志记录' : '无匹配日志'}
            </Typography>
          ) : (
            <Box sx={{ fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.6 }}>
              {filteredLogs.map((e, i) => {
                const levelColor = e.level === 'error' ? 'error.main' : e.level === 'warn' ? 'warning.main' : 'text.secondary';
                const levelBg = e.level === 'error' ? 'error.light' : e.level === 'warn' ? 'warning.light' : 'transparent';
                return (
                  <Box
                    key={i}
                    sx={{
                      p: 0.75, pl: 1.5, mb: 0.5, borderLeft: 3, borderColor: levelColor,
                      bgcolor: levelBg, opacity: levelBg === 'transparent' ? 1 : 0.1,
                      borderRadius: '0 4px 4px 0',
                    }}
                  >
                    <Box component="span" color="text.secondary">[{e.time}]</Box>{' '}
                    <Box component="span" sx={{ fontWeight: 500, color: levelColor }}>{e.level.toUpperCase()}</Box>{' '}
                    <Box component="span">{e.event}</Box>
                    {e.extra && <Box component="span" color="text.secondary"> | {String(e.extra)}</Box>}
                    <Box sx={{ fontSize: '0.65rem', color: 'text.disabled', mt: 0.25 }}>
                      {e.state} | {e.provider}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button startIcon={<ContentCopyIcon />} onClick={handleCopyLogs} sx={{ textTransform: 'none' }}>复制</Button>
          <Button startIcon={<RefreshIcon />} onClick={handleRefreshLogs} sx={{ textTransform: 'none' }}>刷新</Button>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={() => setLogPanelOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>

      {/* ========== "应用到科目" 菜单 ========== */}
      <Menu
        anchorEl={applyMenuAnchor}
        open={Boolean(applyMenuAnchor)}
        onClose={closeApplyToSubjectMenu}
      >
        <MuiMenuItem disabled>选择要应用到的科目</MuiMenuItem>
        {subjects.map(s => {
          const existing = store.getSubjectTemplate(s.id);
          const hasExisting = existing && existing.prompt;
          return (
            <MuiMenuItem key={s.id} onClick={() => handleApplyToSubjectFromMenu(s.id)}>
              <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: s.color, mr: 1.5, flexShrink: 0 }} />
              <Box sx={{ flexGrow: 1 }}>{s.name}</Box>
              {hasExisting && <Chip label="已有" size="small" variant="outlined" sx={{ ml: 1 }} />}
            </MuiMenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
