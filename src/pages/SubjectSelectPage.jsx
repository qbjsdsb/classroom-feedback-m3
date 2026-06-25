// SubjectSelectPage.jsx - 科目选择页
// 原 /workspace/newclassroom/js/pages/subjectSelectPage.js 迁移而来
// 功能：单人模式只显示选修科目 / 小组模式显示所有科目 / 点击进入录音页

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, IconButton, Grid, Card, CardActionArea, CardContent,
  Avatar, Stack, Button, useTheme
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useData } from '../store/DataContext';
import { useSession } from '../store/SessionContext';
import { hexToRgba, adaptColorForTheme } from '../utils/color';

export default function SubjectSelectPage() {
  const navigate = useNavigate();
  const { ready, store, refreshCounter } = useData();
  const { currentStudent, currentGroup, setCurrentSubject } = useSession();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // 计算标题与副标题
  const { title, subtitle } = useMemo(() => {
    if (currentGroup && currentGroup.length > 0) {
      const names = currentGroup
        .map(id => store.getStudentById(id)?.name)
        .filter(Boolean)
        .join('、');
      return { title: '选择科目', subtitle: names || '' };
    } else if (currentStudent) {
      return { title: '选择科目', subtitle: currentStudent.name };
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
      <Stack direction="row" spacing={1} sx={{ mb: 2.5, alignItems: 'center' }}>
        <IconButton onClick={() => navigate('/students')} aria-label="返回学生管理">
          <ArrowBackIcon />
        </IconButton>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>{title}</Typography>
          {subtitle ? <Typography variant="body2" color="text.secondary">{subtitle}</Typography> : null}
        </Box>
      </Stack>

      {/* 科目网格 */}
      {displaySubjects.length === 0 ? (
        <Card variant="outlined" sx={{ textAlign: 'center', py: 6, mt: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>暂无科目</Typography>
            <Button variant="contained" onClick={() => navigate('/settings')}>前往设置添加科目</Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {displaySubjects.map(s => {
            const ac = adaptColorForTheme(s.color, isDark);
            return (
            <Grid item xs={6} sm={4} md={3} key={s.id}>
              <Card
                variant="outlined"
                sx={{
                  borderColor: ac,
                  borderWidth: 1,
                  borderRadius: 12,
                  // 项16：Card hover 改克制（borderColor 强调 + 轻微上移，不再用 boxShadow 抬升）
                  transition: 'border-color 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
                  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-1px)' },
                }}
              >
                <CardActionArea
                  onClick={() => selectSubject(s.id)}
                  sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <Avatar
                    sx={{
                      bgcolor: hexToRgba(ac, 0.14),
                      color: ac,
                      width: 48,
                      height: 48,
                      mb: 1,
                      fontSize: 20,
                      fontWeight: 500,
                    }}
                  >
                    {s.name.charAt(0)}
                  </Avatar>
                  <Typography sx={{ color: ac, fontWeight: 500 }}>{s.name}</Typography>
                </CardActionArea>
              </Card>
            </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
