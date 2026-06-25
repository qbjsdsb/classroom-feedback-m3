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
import StyleAnalysisDialog from '../components/StyleAnalysisDialog';

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

  // 智能分析：样本输入 + 分析状态 + 结果预览 Dialog
  const [analysisSample, setAnalysisSample] = useState('');
  const [analysisDialogOpen, setAnalysisDialogOpen] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const analysisAbortRef = useRef(null);

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

  // ========== 智能分析：调用 AI 分析样本 ==========
  const handleStartAnalysis = useCallback(async () => {
    const sample = analysisSample.trim();
    if (!sample) {
      UI.showToast('请先粘贴一段课堂反馈样本');
      return;
    }
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      UI.showToast('请先设置 API Key');
      return;
    }
    setAnalysisResult(null);
    setAnalysisError(null);
    setAnalyzing(true);
    setAnalysisDialogOpen(true);
    const abortController = new AbortController();
    analysisAbortRef.current = abortController;
    try {
      const result = await AiService.analyzeFeedbackStyle(sample, { signal: abortController.signal });
      setAnalysisResult(result);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setAnalysisError(err.message || '分析失败');
    } finally {
      setAnalyzing(false);
      analysisAbortRef.current = null;
    }
  }, [analysisSample, Storage]);

  // ========== 智能分析：应用用户勾选的配置 ==========
  const handleApplyAnalysis = useCallback(({ selected, moduleMode }) => {
    const a = analysisResult;
    if (!a) return;
    // 1. 应用 style 字段
    const newStyle = { ...style };
    if (selected.tone && a.tone) newStyle.tone = a.tone;
    if (selected.useEmoji && a.useEmoji !== null && a.useEmoji !== undefined) newStyle.useEmoji = a.useEmoji;
    if (selected.emojiPosition && a.emojiPosition) newStyle.emojiPosition = a.emojiPosition;
    if (selected.useBulletPoints && a.useBulletPoints !== null && a.useBulletPoints !== undefined) newStyle.useBulletPoints = a.useBulletPoints;
    if (selected.nameShorten && a.nameShorten !== null && a.nameShorten !== undefined) newStyle.nameShorten = a.nameShorten;
    if (selected.includeParentHelp && a.includeParentHelp !== null && a.includeParentHelp !== undefined) newStyle.includeParentHelp = a.includeParentHelp;
    if (selected.strictInput && a.strictInput !== null && a.strictInput !== undefined) newStyle.strictInput = a.strictInput;
    if (selected.titleTemplate && a.titleTemplate) newStyle.titleTemplate = a.titleTemplate;
    if (selected.titleDateFormat && a.titleDateFormat) newStyle.titleDateFormat = a.titleDateFormat;
    if (selected.institutionName && a.institutionName) newStyle.institutionName = a.institutionName;
    if (selected.teacherName && a.teacherName) newStyle.teacherName = a.teacherName;
    if (selected.moduleWrap && a.moduleWrap) newStyle.moduleWrap = a.moduleWrap;
    if (selected.moduleSeparator && a.moduleSeparator) newStyle.moduleSeparator = a.moduleSeparator;
    if (selected.customPrompt && a.customPrompt !== null && a.customPrompt !== undefined) {
      newStyle.customPrompt = a.customPrompt;
      setCustomPrompt(a.customPrompt);
    }
    setStyle(newStyle);
    Storage.saveStyle(newStyle);

    // 2. 应用模块
    if (selected.modules && Array.isArray(a.modules) && a.modules.length > 0) {
      let newModules;
      if (moduleMode === 'replace') {
        // 替换：保留所有模块的 enabled/custom 字段（同名继承），否则按 AI 推断生成
        newModules = a.modules.map(im => {
          const existing = modules.find(m => m.name === im.name);
          return {
            name: im.name,
            enabled: existing ? existing.enabled : true,
            custom: existing ? existing.custom : true,
            icon: im.icon || (existing ? existing.icon : undefined),
            prompt: im.prompt || (existing ? existing.prompt : undefined),
            description: existing ? existing.description : '',
          };
        });
      } else {
        // 合并：保留所有当前模块，对 AI 推断的同名模块更新 icon/prompt，新增模块追加
        newModules = [...modules];
        for (const im of a.modules) {
          const idx = newModules.findIndex(m => m.name === im.name);
          if (idx >= 0) {
            newModules[idx] = {
              ...newModules[idx],
              ...(im.icon ? { icon: im.icon } : {}),
              ...(im.prompt ? { prompt: im.prompt } : {}),
            };
          } else {
            newModules.push({
              name: im.name, enabled: true, custom: true,
              icon: im.icon || undefined, prompt: im.prompt || undefined, description: '',
            });
          }
        }
      }
      // 清理 undefined 字段
      newModules = newModules.map(m => {
        const cleaned = { ...m };
        if (cleaned.icon === undefined) delete cleaned.icon;
        if (cleaned.prompt === undefined) delete cleaned.prompt;
        return cleaned;
      });
      Storage.saveModules(newModules);
      setModules(newModules);

      // 同步 moduleLengths：用 AI 推断的 min/max 更新（仅当应用模块时）
      const newLengths = { ...moduleLengths };
      for (const im of a.modules) {
        if (typeof im.minLength === 'number' && typeof im.maxLength === 'number') {
          newLengths[im.name] = { min: im.minLength, max: im.maxLength };
        }
      }
      setModuleLengths(newLengths);
      // moduleLengths 保存在 style 里，需同步
      Storage.saveStyle({ ...newStyle, moduleLengths: newLengths });
    }

    setAnalysisDialogOpen(false);
    UI.showToast('已应用勾选的配置');
  }, [analysisResult, style, modules, moduleLengths, Storage]);

  // 卸载时中止进行中的分析请求
  useEffect(() => {
    return () => {
      if (analysisAbortRef.current) {
        analysisAbortRef.current.abort();
        analysisAbortRef.current = null;
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

        {/* ========== 智能分析（粘贴样本一键配置） ========== */}
        <Card variant="outlined" sx={{ borderColor: 'primary.main', borderWidth: 1.5 }}>
          <CardHeader
            avatar={<AutoAwesomeIcon color="primary" />}
            title="智能分析：从样本反推配置"
            titleTypographyProps={{ variant: 'subtitle1', fontWeight: 500 }}
            subheader="粘贴一段你想要的课堂反馈样本，AI 自动分析格式/风格/模块并填充下方设置"
          />
          <CardContent sx={{ pt: 0 }}>
            <TextField
              multiline
              minRows={4}
              maxRows={10}
              value={analysisSample}
              onChange={(e) => setAnalysisSample(e.target.value)}
              placeholder={'粘贴一段完整的课堂反馈样本，包含标题和各模块内容。例如：\n\n6.25小明数学课堂反馈\n\n【课堂内容】\n本节课讲解了二次函数的图像与性质...\n\n【课堂表现】\n小明今天听课专注，积极回答问题...\n\n【课后作业】\n完成课本第45页练习题1-5题'}
              fullWidth
              size="small"
              sx={{ mb: 1.5 }}
            />
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Button
                variant="contained"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleStartAnalysis}
                disabled={analyzing}
                sx={{ textTransform: 'none' }}
              >
                {analyzing ? '分析中...' : 'AI 分析并应用'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                样本越完整，分析越准确。分析后可逐项勾选应用。
              </Typography>
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

      {/* ========== 智能分析结果预览 Dialog ========== */}
      <StyleAnalysisDialog
        open={analysisDialogOpen}
        analysis={analysisResult}
        currentStyle={style}
        currentModules={modules}
        analyzing={analyzing}
        error={analysisError}
        onClose={() => {
          // 分析进行中关闭时中止请求
          if (analysisAbortRef.current) {
            analysisAbortRef.current.abort();
            analysisAbortRef.current = null;
          }
          setAnalysisDialogOpen(false);
        }}
        onApply={handleApplyAnalysis}
      />
    </Box>
  );
}
