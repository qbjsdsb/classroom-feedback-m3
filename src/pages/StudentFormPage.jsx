import { Card, CardContent, Typography } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';

export default function StudentFormPage() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <PersonAddIcon /> 学生表单
        </Typography>
        <Typography color="text.secondary">此功能正在建设中…（第二阶段实现）</Typography>
      </CardContent>
    </Card>
  );
}
