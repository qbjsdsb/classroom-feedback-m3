import { Card, CardContent, Typography } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';

export default function RecordPage() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <MicIcon /> 课堂录音
        </Typography>
        <Typography color="text.secondary">此功能正在建设中…（第三阶段实现）</Typography>
      </CardContent>
    </Card>
  );
}
