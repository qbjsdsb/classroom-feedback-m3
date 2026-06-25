import { Card, CardContent, Typography } from '@mui/material';
import SubjectIcon from '@mui/icons-material/Subject';

export default function SubjectSelectPage() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SubjectIcon /> 科目选择
        </Typography>
        <Typography color="text.secondary">此功能正在建设中…（第三阶段实现）</Typography>
      </CardContent>
    </Card>
  );
}
