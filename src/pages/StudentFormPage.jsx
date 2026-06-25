// StudentFormPage.jsx - 学生添加/编辑页
// 原 /workspace/newclassroom/js/pages/studentFormPage.js 迁移而来
// 功能：新增/编辑/试听标记/科目选择/删除（软删除+撤销）

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Typography, IconButton, Button, TextField, MenuItem, Select, InputLabel,
  FormControl, Switch, FormControlLabel, Checkbox, Stack, Paper, Card, CardContent, Divider
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import { useData } from '../store/DataContext';
import { UI } from '../utils/ui';

// 全部年级
const GRADES = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'];

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { ready, store, refresh, refreshCounter } = useData();

  // 表单状态
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [isTrial, setIsTrial] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState(new Set());

  // 编辑模式下加载学生数据
  useEffect(() => {
    if (!ready) return;
    if (isEdit) {
      const student = store.getStudentById(id);
      if (student) {
        setName(student.name);
        setGrade(student.grade || '');
        setIsTrial(!!student.isTrial);
      }
      const subIds = store._studentSubjects[id] || [];
      setSelectedSubjects(new Set(subIds));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id, refreshCounter]);

  // 所有科目（按 order 排序）
  const allSubjects = useMemo(() => {
    if (!ready) return [];
    return store.getSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter]);

  // 切换科目选择
  const toggleSubject = (subjectId) => {
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  // 保存
  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      UI.showToast('请输入学生姓名');
      return;
    }
    const subjectIds = Array.from(selectedSubjects);
    if (isEdit) {
      store.updateStudent(id, { name: trimmedName, isTrial, grade });
      store.setStudentSubjects(id, subjectIds);
      UI.showToast('学生信息已更新');
    } else {
      const newStudent = store.addStudent(trimmedName, isTrial, grade);
      store.setStudentSubjects(newStudent.id, subjectIds);
      UI.showToast('学生已添加');
    }
    refresh();
    navigate('/students');
  };

  // 删除（软删除 + 撤销）
  const handleDelete = () => {
    UI.showConfirm('确定删除该学生？相关反馈历史也将被删除。', () => {
      const snapshot = store.softDeleteStudent(id);
      refresh();
      navigate('/students');
      if (snapshot) {
        UI.showUndoToast('已删除学生', () => {
          store.restoreStudent(snapshot);
          refresh();
        });
      }
    });
  };

  if (!ready) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <Typography color="text.secondary">正在加载数据…</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* 顶部标题栏 */}
      <Stack direction="row" spacing={1} sx={{ mb: 2.5, alignItems: 'center' }}>
        <IconButton onClick={() => navigate('/students')} aria-label="返回学生管理">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {isEdit ? '✏️ 编辑学生' : '➕ 添加学生'}
        </Typography>
      </Stack>

      {/* 表单 */}
      <Stack spacing={2.5}>
        {/* 基本信息卡 */}
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2.5}>
              <TextField
                label="学生姓名 *"
                placeholder="请输入学生姓名…"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                autoFocus
              />

              <FormControl fullWidth>
                <InputLabel id="grade-label">年级</InputLabel>
                <Select
                  labelId="grade-label"
                  label="年级"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                >
                  <MenuItem value="">未选择</MenuItem>
                  {GRADES.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </Select>
              </FormControl>

              <Divider />

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isTrial}
                      onChange={(e) => setIsTrial(e.target.checked)}
                    />
                  }
                  label="标记为试听学生"
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, pl: 4 }}>
                  标记后，生成的反馈标题会显示"试听"字样
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>

        {/* 选修科目卡 */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>选修科目</Typography>
            {allSubjects.length === 0 ? (
              <Typography variant="body2" color="text.secondary">暂无科目，请在设置中添加</Typography>
            ) : (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {allSubjects.map(s => {
                  const checked = selectedSubjects.has(s.id);
                  return (
                    <Paper
                      key={s.id}
                      variant="outlined"
                      onClick={() => toggleSubject(s.id)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1,
                        px: 1.5, py: 0.75, cursor: 'pointer',
                        borderColor: checked ? s.color : 'divider',
                        borderWidth: checked ? 2 : 1,
                        bgcolor: checked ? `${s.color}14` : 'background.paper',
                        '&:hover': { borderColor: s.color },
                        borderRadius: 2,
                      }}
                    >
                      <Checkbox
                        checked={checked}
                        size="small"
                        sx={{
                          color: s.color,
                          '&.Mui-checked': { color: s.color },
                          p: 0.5,
                        }}
                      />
                      <Typography sx={{ color: checked ? s.color : 'text.primary' }}>{s.name}</Typography>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* 保存按钮 */}
        <Button
          variant="contained"
          color="primary"
          size="large"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          fullWidth
          sx={{ textTransform: 'none', borderRadius: 28 }}
        >
          {isEdit ? '保存修改' : '添加学生'}
        </Button>

        {/* 删除按钮（仅编辑模式） */}
        {isEdit ? (
          <Button
            variant="outlined"
            color="error"
            size="large"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            fullWidth
            sx={{ textTransform: 'none', borderRadius: 28 }}
          >
            删除学生
          </Button>
        ) : null}
      </Stack>
    </Box>
  );
}
