import { Card, CardContent, Typography } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';

export default function HistoryPage() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <HistoryIcon /> 历史反馈
        </Typography>
        <Typography color="text.secondary">此功能正在建设中…（第二阶段实现）</Typography>
      </CardContent>
    </Card>
  );
}
