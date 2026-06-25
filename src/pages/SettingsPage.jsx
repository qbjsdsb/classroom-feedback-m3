import { Card, CardContent, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

export default function SettingsPage() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SettingsIcon /> 系统设置
        </Typography>
        <Typography color="text.secondary">此功能正在建设中…（第二阶段实现）</Typography>
      </CardContent>
    </Card>
  );
}
