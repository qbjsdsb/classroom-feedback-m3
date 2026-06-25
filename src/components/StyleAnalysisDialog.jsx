// StyleAnalysisDialog.jsx - 智能分析结果预览与逐项勾选应用
// 用户粘贴一段课堂反馈样本 → AI 反推配置 → 本 Dialog 展示"推断值→当前值"+复选框 → 用户勾选后应用

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Stack,
  Typography, Paper, Checkbox, FormControlLabel, Divider, Chip, Alert,
  CircularProgress, useTheme,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const TONE_LABELS = {
  friendly: '亲切', formal: '正式', concise: '简洁',
  detailed: '详细', humorous: '幽默', encouraging: '鼓励',
};

const WRAP_LABELS = {
  '【】': '【】中文方头括号', '[]': '[] 英文方括号',
  '（）': '（）中文圆括号', '·': '· 间隔号', none: '无包裹符号',
};

const SEP_LABELS = {
  '\n\n': '空行分隔', '\n': '单换行',
  '\n---\n': '横线分隔', '\n\n---\n\n': '空行+横线+空行',
};

const DATE_FMT_LABELS = {
  'M.D': 'M.D（如 6.25）', 'MM-DD': 'MM-DD（如 06-25）',
  'X月X日': 'X月X日（如 6月25日）', 'YYYY-MM-DD': 'YYYY-MM-DD',
};

/**
 * 把 AI 返回的 module 数组与当前模块数组对齐展示
 * 推断模块按顺序列出；当前模块若同名则标注"已存在"，否则"新增"
 */
function buildModuleRows(inferredModules, currentModules) {
  if (!Array.isArray(inferredModules) || inferredModules.length === 0) return [];
  const currentNames = (currentModules || []).map(m => m.name);
  return inferredModules.map((im, idx) => ({
    idx,
    name: im.name || `模块${idx + 1}`,
    icon: im.icon || '',
    prompt: im.prompt || '',
    minLength: typeof im.minLength === 'number' ? im.minLength : null,
    maxLength: typeof im.maxLength === 'number' ? im.maxLength : null,
    exists: currentNames.includes(im.name),
  }));
}

/**
 * 单行配置项：复选框 + 标签 + 推断值 → 当前值
 */
function ConfigRow({ checked, onToggle, label, inferred, current, inferable = true }) {
  const theme = useTheme();
  const showInferred = inferred !== null && inferred !== undefined && inferred !== '';
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25, opacity: inferable ? 1 : 0.5,
        borderColor: checked ? 'primary.main' : 'divider',
        bgcolor: checked ? 'action.selected' : 'background.paper',
        transition: theme.transitions.create(['border-color', 'background-color'], { duration: 150 }),
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Checkbox
          size="small"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          disabled={!inferable}
          sx={{ p: 0.5 }}
        />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{label}</Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5, useFlexGap: true, alignItems: 'center' }}>
            <Chip
              size="small"
              color={showInferred ? 'primary' : 'default'}
              variant={showInferred ? 'filled' : 'outlined'}
              label={showInferred ? `AI: ${String(inferred)}` : 'AI: 无法推断'}
            />
            <Typography variant="caption" color="text.secondary">→</Typography>
            <Chip size="small" variant="outlined" label={`当前: ${current === '' || current === null || current === undefined ? '（空）' : String(current)}`} />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {object|null} props.analysis - AI 返回的分析结果
 * @param {object} props.currentStyle - 当前 style
 * @param {Array} props.currentModules - 当前 modules
 * @param {boolean} props.analyzing - 是否正在分析
 * @param {string|null} props.error - 分析错误信息
 * @param {Function} props.onClose
 * @param {Function} props.onApply - (selected) => void，selected 为用户勾选的应用项
 */
export default function StyleAnalysisDialog({
  open, analysis, currentStyle, currentModules, analyzing, error, onClose, onApply,
}) {
  // 用户勾选状态：key -> boolean。初始化时默认勾选所有"可推断"项
  const [selected, setSelected] = useState({});
  // 模块应用模式：'replace'（替换全部模块）| 'merge'（合并，保留已有同名之外的）
  const [moduleMode, setModuleMode] = useState('replace');

  // analysis 变化时重置勾选状态：默认勾选所有非 null 项
  useEffect(() => {
    if (!analysis) {
      setSelected({});
      return;
    }
    const init = {};
    const tryCheck = (key, val) => {
      if (val !== null && val !== undefined && val !== '') init[key] = true;
    };
    tryCheck('tone', analysis.tone);
    tryCheck('useEmoji', analysis.useEmoji);
    tryCheck('emojiPosition', analysis.emojiPosition);
    tryCheck('useBulletPoints', analysis.useBulletPoints);
    tryCheck('nameShorten', analysis.nameShorten);
    tryCheck('includeParentHelp', analysis.includeParentHelp);
    tryCheck('strictInput', analysis.strictInput);
    tryCheck('titleTemplate', analysis.titleTemplate);
    tryCheck('titleDateFormat', analysis.titleDateFormat);
    tryCheck('institutionName', analysis.institutionName);
    tryCheck('teacherName', analysis.teacherName);
    tryCheck('moduleWrap', analysis.moduleWrap);
    tryCheck('moduleSeparator', analysis.moduleSeparator);
    tryCheck('customPrompt', analysis.customPrompt);
    if (Array.isArray(analysis.modules) && analysis.modules.length > 0) init.modules = true;
    setSelected(init);
  }, [analysis]);

  const moduleRows = useMemo(
    () => buildModuleRows(analysis?.modules, currentModules),
    [analysis, currentModules]
  );

  const toggle = (key) => (checked) => setSelected(prev => ({ ...prev, [key]: checked }));

  const handleApply = () => {
    onApply({ selected, moduleMode });
  };

  const inferable = (val) => val !== null && val !== undefined && val !== '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AutoAwesomeIcon color="primary" />
        智能分析结果预览
      </DialogTitle>
      <DialogContent dividers>
        {analyzing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
            <CircularProgress />
            <Typography color="text.secondary">AI 正在分析样本，请稍候...</Typography>
          </Box>
        )}

        {!analyzing && error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            分析失败：{error}
          </Alert>
        )}

        {!analyzing && !error && analysis && (
          <Stack spacing={2.5}>
            <Alert severity="info" sx={{ py: 0.5 }}>
              以下是 AI 从样本中反推的配置。勾选要应用的项，未勾选的保持不变。无法推断的项已禁用。
            </Alert>

            {/* ========== 风格类 ========== */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>风格</Typography>
              <Stack spacing={1}>
                <ConfigRow
                  label="语气风格"
                  checked={!!selected.tone}
                  onToggle={toggle('tone')}
                  inferable={inferable(analysis.tone)}
                  inferred={TONE_LABELS[analysis.tone] || analysis.tone}
                  current={TONE_LABELS[currentStyle?.tone] || currentStyle?.tone}
                />
                <ConfigRow
                  label="使用 emoji"
                  checked={!!selected.useEmoji}
                  onToggle={toggle('useEmoji')}
                  inferable={inferable(analysis.useEmoji)}
                  inferred={analysis.useEmoji ? '是' : '否'}
                  current={currentStyle?.useEmoji ? '是' : '否'}
                />
                <ConfigRow
                  label="emoji 位置"
                  checked={!!selected.emojiPosition}
                  onToggle={toggle('emojiPosition')}
                  inferable={inferable(analysis.emojiPosition)}
                  inferred={analysis.emojiPosition}
                  current={currentStyle?.emojiPosition}
                />
                <ConfigRow
                  label="分点输出"
                  checked={!!selected.useBulletPoints}
                  onToggle={toggle('useBulletPoints')}
                  inferable={inferable(analysis.useBulletPoints)}
                  inferred={analysis.useBulletPoints ? '是' : '否'}
                  current={currentStyle?.useBulletPoints ? '是' : '否'}
                />
                <ConfigRow
                  label="姓名缩写"
                  checked={!!selected.nameShorten}
                  onToggle={toggle('nameShorten')}
                  inferable={inferable(analysis.nameShorten)}
                  inferred={analysis.nameShorten === true ? '缩写' : analysis.nameShorten === false ? '不缩写' : null}
                  current={currentStyle?.nameShorten ? '缩写' : '不缩写'}
                />
                <ConfigRow
                  label="包含家长协助"
                  checked={!!selected.includeParentHelp}
                  onToggle={toggle('includeParentHelp')}
                  inferable={inferable(analysis.includeParentHelp)}
                  inferred={analysis.includeParentHelp ? '是' : '否'}
                  current={currentStyle?.includeParentHelp ? '是' : '否'}
                />
              </Stack>
            </Box>

            <Divider />

            {/* ========== 标题类 ========== */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>标题模板</Typography>
              <Stack spacing={1}>
                <ConfigRow
                  label="标题模板"
                  checked={!!selected.titleTemplate}
                  onToggle={toggle('titleTemplate')}
                  inferable={inferable(analysis.titleTemplate)}
                  inferred={analysis.titleTemplate}
                  current={currentStyle?.titleTemplate}
                />
                <ConfigRow
                  label="日期格式"
                  checked={!!selected.titleDateFormat}
                  onToggle={toggle('titleDateFormat')}
                  inferable={inferable(analysis.titleDateFormat)}
                  inferred={DATE_FMT_LABELS[analysis.titleDateFormat] || analysis.titleDateFormat}
                  current={DATE_FMT_LABELS[currentStyle?.titleDateFormat] || currentStyle?.titleDateFormat}
                />
                <ConfigRow
                  label="机构名"
                  checked={!!selected.institutionName}
                  onToggle={toggle('institutionName')}
                  inferable={inferable(analysis.institutionName)}
                  inferred={analysis.institutionName}
                  current={currentStyle?.institutionName}
                />
                <ConfigRow
                  label="老师名"
                  checked={!!selected.teacherName}
                  onToggle={toggle('teacherName')}
                  inferable={inferable(analysis.teacherName)}
                  inferred={analysis.teacherName}
                  current={currentStyle?.teacherName}
                />
              </Stack>
            </Box>

            <Divider />

            {/* ========== 模块格式 ========== */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>模块格式</Typography>
              <Stack spacing={1}>
                <ConfigRow
                  label="模块名包裹符号"
                  checked={!!selected.moduleWrap}
                  onToggle={toggle('moduleWrap')}
                  inferable={inferable(analysis.moduleWrap)}
                  inferred={WRAP_LABELS[analysis.moduleWrap] || analysis.moduleWrap}
                  current={WRAP_LABELS[currentStyle?.moduleWrap] || currentStyle?.moduleWrap}
                />
                <ConfigRow
                  label="模块间分隔符"
                  checked={!!selected.moduleSeparator}
                  onToggle={toggle('moduleSeparator')}
                  inferable={inferable(analysis.moduleSeparator)}
                  inferred={SEP_LABELS[analysis.moduleSeparator] || analysis.moduleSeparator}
                  current={SEP_LABELS[currentStyle?.moduleSeparator] || currentStyle?.moduleSeparator}
                />
              </Stack>
            </Box>

            <Divider />

            {/* ========== 模块列表 ========== */}
            {moduleRows.length > 0 && (
              <Box>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2">模块列表（{moduleRows.length} 个）</Typography>
                  <Stack direction="row" spacing={1}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={!!selected.modules}
                          onChange={(e) => toggle('modules')(e.target.checked)}
                        />
                      }
                      label="应用模块"
                    />
                  </Stack>
                </Stack>
                {selected.modules && (
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    <Chip
                      size="small"
                      label="替换全部模块"
                      color={moduleMode === 'replace' ? 'primary' : 'default'}
                      variant={moduleMode === 'replace' ? 'filled' : 'outlined'}
                      onClick={() => setModuleMode('replace')}
                    />
                    <Chip
                      size="small"
                      label="合并（保留已有不同名模块）"
                      color={moduleMode === 'merge' ? 'primary' : 'default'}
                      variant={moduleMode === 'merge' ? 'filled' : 'outlined'}
                      onClick={() => setModuleMode('merge')}
                    />
                  </Stack>
                )}
                <Stack spacing={1}>
                  {moduleRows.map(row => (
                    <Paper key={row.idx} variant="outlined" sx={{ p: 1.25 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {row.icon && <Box component="span" sx={{ mr: 0.5 }}>{row.icon}</Box>}
                          {row.name}
                        </Typography>
                        <Chip
                          size="small"
                          label={row.exists ? '已存在（将更新）' : '新增'}
                          color={row.exists ? 'warning' : 'success'}
                          variant="outlined"
                        />
                      </Stack>
                      {row.prompt && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                          写作要求：{row.prompt}
                        </Typography>
                      )}
                      {(row.minLength !== null || row.maxLength !== null) && (
                        <Typography variant="caption" color="text.secondary">
                          字数范围：{row.minLength ?? '?'} - {row.maxLength ?? '?'}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            <Divider />

            {/* ========== 整体备注 ========== */}
            <ConfigRow
              label="整体写作要求备注"
              checked={!!selected.customPrompt}
              onToggle={toggle('customPrompt')}
              inferable={inferable(analysis.customPrompt)}
              inferred={analysis.customPrompt}
              current={currentStyle?.customPrompt}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={analyzing || !!error || !analysis}
          startIcon={<AutoAwesomeIcon />}
        >
          应用勾选项
        </Button>
      </DialogActions>
    </Dialog>
  );
}
