import { Card, CardContent, Typography } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';

export default function StudentsPage() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PeopleIcon /> 学生管理
        </Typography>
        <Typography color="text.secondary">此功能正在建设中…（第二阶段实现）</Typography>
      </CardContent>
    </Card>
  );
}
