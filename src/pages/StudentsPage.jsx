// StudentsPage.jsx - 学生管理页
// 原 /workspace/newclassroom/js/pages/studentsPage.js 迁移而来
// 功能：列表/搜索/年级筛选/单人小组模式切换/软删除+撤销/快捷菜单

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, Button, TextField, MenuItem, Select, InputLabel,
  FormControl, Card, CardContent, Avatar, Chip, Fab, Checkbox, Menu, ListItemIcon,
  ListItemText, MenuList, Paper, Stack
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useData } from '../store/DataContext';
import { useSession } from '../store/SessionContext';
import { UI } from '../utils/ui';

// 全部年级按顺序
const GRADE_ORDER = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'];

// 根据姓名 hash 生成头像渐变色
function getAvatarGradient(name) {
  const gradients = [
    'linear-gradient(135deg, #6366F1, #8B5CF6)',
    'linear-gradient(135deg, #10B981, #34D399)',
    'linear-gradient(135deg, #F59E0B, #FBBF24)',
    'linear-gradient(135deg, #EF4444, #F87171)',
    'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    'linear-gradient(135deg, #EC4899, #F472B6)',
    'linear-gradient(135deg, #06B6D4, #22D3EE)',
    'linear-gradient(135deg, #F97316, #FB923C)',
    'linear-gradient(135deg, #14B8A6, #2DD4BF)',
    'linear-gradient(135deg, #E11D48, #FB7185)',
    'linear-gradient(135deg, #7C3AED, #A78BFA)',
    'linear-gradient(135deg, #0891B2, #67E8F9)'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

// hex 颜色 + 透明度（用于 Chip 背景）
function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function StudentsPage() {
  const { ready, store, Storage, refresh, refreshCounter } = useData();
  const { setCurrentStudent, setCurrentGroup } = useSession();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuStudentId, setMenuStudentId] = useState(null);

  // 从学生数据聚合所有年级
  const allGrades = useMemo(() => {
    if (!ready) return [];
    const grades = [...new Set(store._students.map(s => s.grade).filter(Boolean))];
    return grades.sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));
    // refreshCounter 用于在数据变更后重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter]);

  // 当前显示的学生列表
  const students = useMemo(() => {
    if (!ready) return [];
    return store.searchStudents(searchQuery, selectedGrade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter, searchQuery, selectedGrade]);

  const apiKey = ready ? Storage.getApiKey() : '';
  const hasSubjects = ready ? store.getSubjects().length > 0 : false;
  const hasSetup = ready && apiKey && students.length > 0 && hasSubjects;

  // 切换单人/小组模式
  const toggleGroupMode = () => {
    setIsGroupMode(g => !g);
    setSelectedStudentIds(new Set());
  };

  // 点击学生
  const onStudentClick = (studentId) => {
    if (isGroupMode) {
      setSelectedStudentIds(prev => {
        const next = new Set(prev);
        if (next.has(studentId)) next.delete(studentId);
        else next.add(studentId);
        return next;
      });
    } else {
      const student = store.getStudentById(studentId);
      setCurrentStudent(student);
      navigate('/subject-select');
    }
  };

  // 打开菜单
  const openMenu = (e, studentId) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuStudentId(studentId);
  };

  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuStudentId(null);
  };

  // 编辑
  const onEdit = () => {
    const id = menuStudentId;
    closeMenu();
    navigate(`/students/${id}/edit`);
  };

  // 删除（软删除 + 撤销）
  const onDelete = () => {
    const id = menuStudentId;
    const student = store.getStudentById(id);
    closeMenu();
    UI.showConfirm(`确定删除该学生${student ? `「${student.name}」` : ''}？相关反馈历史也将被删除。`, () => {
      const snapshot = store.softDeleteStudent(id);
      refresh();
      if (snapshot) {
        UI.showUndoToast('已删除学生', () => {
          store.restoreStudent(snapshot);
          refresh();
        });
      }
    });
  };

  // 确认小组选择
  const confirmGroup = () => {
    setCurrentGroup(Array.from(selectedStudentIds));
    navigate('/subject-select');
  };

  // 清空搜索
  const clearSearch = () => setSearchQuery('');

  if (!ready) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <Typography color="text.secondary">正在加载数据…</Typography>
      </Box>
    );
  }

  // 快速开始提示
  const tips = [];
  if (!apiKey) tips.push('在「系统设置」页面填入您的 DeepSeek API Key');
  if (!hasSubjects) tips.push('在「系统设置」页面添加教学科目（如数学、英语）');
  if (students.length === 0) tips.push('点击右下角「+」按钮添加您的学生');

  return (
    <Box sx={{ position: 'relative', pb: isGroupMode && selectedStudentIds.size > 0 ? 10 : 2 }}>
      {/* 标题栏 + 小组模式切换 */}
      <Stack direction="row" sx={{ mb: 2.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 500 }}>
          学生管理
        </Typography>
        <Button
          variant={isGroupMode ? 'contained' : 'outlined'}
          color={isGroupMode ? 'secondary' : 'primary'}
          size="small"
          startIcon={isGroupMode ? <GroupIcon /> : <PersonIcon />}
          onClick={toggleGroupMode}
          sx={{ textTransform: 'none', borderRadius: 20 }}
        >
          {isGroupMode ? '小组模式' : '单人模式'}
        </Button>
      </Stack>

      {/* 快速开始引导 */}
      {!hasSetup && tips.length > 0 ? (
        <Card variant="outlined" sx={{ mb: 2.5, bgcolor: 'background.paper' }}>
          <CardContent>
            <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 1 }}>快速开始</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {tips.map((tip, i) => (
                <Box component="li" key={i} sx={{ mb: 0.5, color: 'text.secondary' }}>{tip}</Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      ) : null}

      {/* 搜索栏 */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
        <TextField
          placeholder="搜索学生姓名…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />,
              endAdornment: searchQuery ? (
                <IconButton size="small" onClick={clearSearch} aria-label="清除搜索">
                  <CloseIcon fontSize="small" />
                </IconButton>
              ) : null,
            },
          }}
        />
        {allGrades.length > 0 ? (
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel id="grade-filter-label">年级</InputLabel>
            <Select
              labelId="grade-filter-label"
              label="年级"
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              renderValue={(v) => v || '全部'}
            >
              <MenuItem value="">全部年级</MenuItem>
              {allGrades.map(g => <MenuItem key={g} value={g}>{g}</MenuItem>)}
            </Select>
          </FormControl>
        ) : null}
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', minWidth: 36, textAlign: 'right' }}>
          {students.length} 名
        </Typography>
      </Stack>

      {/* 学生列表 */}
      {students.length === 0 ? (
        <Card variant="outlined" sx={{ textAlign: 'center', py: 8 }}>
          <CardContent>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>还没有添加学生</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/students/new')}>
              添加第一名学生
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {students.map(student => {
            const isSelected = selectedStudentIds.has(student.id);
            const subjects = store.getStudentSubjects(student.id);
            return (
              <Card
                key={student.id}
                variant="outlined"
                onClick={() => onStudentClick(student.id)}
                sx={{
                  cursor: 'pointer',
                  borderStyle: isGroupMode && isSelected ? 'solid' : 'outlined',
                  borderColor: isGroupMode && isSelected ? 'primary.main' : 'divider',
                  borderWidth: isGroupMode && isSelected ? 2 : 1,
                  bgcolor: isGroupMode && isSelected ? 'action.selected' : 'background.paper',
                  '&:hover': { boxShadow: 2 },
                }}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  {/* 小组模式下显示 Checkbox */}
                  {isGroupMode ? (
                    <Checkbox
                      checked={isSelected}
                      onClick={(e) => { e.stopPropagation(); onStudentClick(student.id); }}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                  ) : null}
                  {/* 头像 */}
                  <Avatar sx={{ background: getAvatarGradient(student.name), mr: 1.5, fontWeight: 500 }}>
                    {student.name.charAt(0)}
                  </Avatar>
                  {/* 信息 */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Typography component="span" sx={{ fontWeight: 500 }}>{student.name}</Typography>
                      {student.isTrial ? (
                        <Chip label="试听" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 12 }} />
                      ) : null}
                      {student.grade ? (
                        <Chip label={student.grade} size="small" variant="outlined" sx={{ height: 20, fontSize: 12 }} />
                      ) : null}
                    </Stack>
                    {subjects.length > 0 ? (
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {subjects.map(s => (
                          <Chip
                            key={s.id}
                            label={s.name}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: 12,
                              bgcolor: hexToRgba(s.color, 0.12),
                              color: s.color,
                              border: 'none',
                            }}
                          />
                        ))}
                      </Stack>
                    ) : null}
                  </Box>
                  {/* 右侧操作 */}
                  {!isGroupMode ? (
                    <IconButton
                      onClick={(e) => openMenu(e, student.id)}
                      aria-label={`${student.name} 的操作菜单`}
                      size="small"
                    >
                      <MoreVertIcon />
                    </IconButton>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      {/* 添加学生 FAB */}
      <Fab
        color="primary"
        aria-label="添加学生"
        onClick={() => navigate('/students/new')}
        sx={{ position: 'fixed', bottom: 80, right: 16, boxShadow: 4 }}
      >
        <AddIcon />
      </Fab>

      {/* 小组模式底部操作栏 */}
      {isGroupMode && selectedStudentIds.size > 0 ? (
        <Paper
          elevation={4}
          sx={{
            position: 'fixed', bottom: 56, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            px: 2, py: 1.5, zIndex: 1100, borderTop: 1, borderColor: 'divider',
          }}
        >
          <Typography variant="body2">已选择 <b>{selectedStudentIds.size}</b> 人</Typography>
          <Button variant="contained" color="primary" onClick={confirmGroup} sx={{ textTransform: 'none', borderRadius: 20 }}>确认选择</Button>
        </Paper>
      ) : null}

      {/* 学生菜单 */}
      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={closeMenu}>
        <MenuList>
          <MenuItem onClick={onEdit}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>编辑</ListItemText>
          </MenuItem>
          <MenuItem onClick={onDelete} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>删除</ListItemText>
          </MenuItem>
        </MenuList>
      </Menu>
    </Box>
  );
}
