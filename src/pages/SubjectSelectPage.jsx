// SubjectSelectPage.jsx - 科目选择页
// 原 /workspace/newclassroom/js/pages/subjectSelectPage.js 迁移而来
// 功能：单人模式只显示选修科目 / 小组模式显示所有科目 / 点击进入录音页

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, Grid, Card, CardActionArea, CardContent,
  Avatar, Stack, Button
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useData } from '../store/DataContext';
import { useSession } from '../store/SessionContext';

// hex 颜色 + 透明度
function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function SubjectSelectPage() {
  const navigate = useNavigate();
  const { ready, store, refreshCounter } = useData();
  const { currentStudent, currentGroup, setCurrentSubject } = useSession();

  // 计算标题与副标题
  const { title, subtitle } = useMemo(() => {
    if (currentGroup && currentGroup.length > 0) {
      const names = currentGroup
        .map(id => store.getStudentById(id)?.name)
        .filter(Boolean)
        .join('、');
      return { title: '选择科目', subtitle: `👥 ${names || ''}` };
    } else if (currentStudent) {
      return { title: '选择科目', subtitle: `👤 ${currentStudent.name}` };
    }
    return { title: '选择科目', subtitle: '请先选择学生' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudent, currentGroup, refreshCounter]);

  // 计算要显示的科目
  const displaySubjects = useMemo(() => {
    if (!ready) return [];
    const allSubjects = store.getSubjects();
    // 单人模式（非小组）：只显示该学生选修的科目
    if (currentStudent && !currentGroup) {
      const studentSubIds = store._studentSubjects[currentStudent.id] || [];
      if (studentSubIds.length > 0) {
        return studentSubIds
          .map(id => store.getSubjectById(id))
          .filter(Boolean);
      }
    }
    // 小组模式或未选学生：显示所有科目
    return allSubjects;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, refreshCounter, currentStudent, currentGroup]);

  // 选择科目
  const selectSubject = (subjectId) => {
    setCurrentSubject(subjectId);
    navigate('/record');
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
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <IconButton onClick={() => navigate('/students')} aria-label="返回学生管理">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h5">{title}</Typography>
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        </Box>
      </Stack>

      {/* 科目网格 */}
      {displaySubjects.length === 0 ? (
        <Card variant="outlined" sx={{ textAlign: 'center', py: 6, mt: 2 }}>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 1 }}>📚</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>暂无科目</Typography>
            <Button variant="contained" onClick={() => navigate('/settings')}>前往设置添加科目</Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {displaySubjects.map(s => (
            <Grid item xs={6} sm={4} md={3} key={s.id}>
              <Card
                variant="outlined"
                sx={{
                  borderColor: s.color,
                  borderWidth: 1,
                  '&:hover': { boxShadow: 3, borderColor: s.color },
                }}
              >
                <CardActionArea
                  onClick={() => selectSubject(s.id)}
                  sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <Avatar
                    sx={{
                      bgcolor: hexToRgba(s.color, 0.12),
                      color: s.color,
                      width: 56,
                      height: 56,
                      mb: 1,
                      fontSize: 24,
                      fontWeight: 500,
                    }}
                  >
                    {s.name.charAt(0)}
                  </Avatar>
                  <Typography sx={{ color: s.color, fontWeight: 500 }}>{s.name}</Typography>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
