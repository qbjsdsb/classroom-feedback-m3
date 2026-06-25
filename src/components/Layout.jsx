import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, BottomNavigation, BottomNavigationAction, useMediaQuery, useTheme, IconButton, Toolbar, Typography, AppBar, Stack, Divider } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import MicIcon from '@mui/icons-material/Mic';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeMode } from '../contexts/ThemeContext';

const drawerWidth = 240;

const navItems = [
  { label: '学生管理', icon: <PeopleIcon />, path: '/students' },
  { label: '课堂录音', icon: <MicIcon />, path: '/record' },
  { label: '历史反馈', icon: <HistoryIcon />, path: '/history' },
  { label: '系统设置', icon: <SettingsIcon />, path: '/settings' },
];

// 响应式布局：桌面端侧边栏（md以上）+ 移动端底部导航栏（md以下）
export default function Layout({ children }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleMode } = useThemeMode();

  const Sidebar = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>📚 课堂反馈助手</Typography>
      </Toolbar>
      <List sx={{ flex: 1, px: 1.5 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname.startsWith(item.path)}
            onClick={() => navigate(item.path)}
            sx={{ borderRadius: 28, mb: 0.5, py: 1.1 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: location.pathname.startsWith(item.path) ? 600 : 400 }} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <IconButton onClick={toggleMode} size="small" aria-label="切换主题">
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
          <Typography variant="caption" color="text.secondary">课堂反馈助手 M3 · v0.2</Typography>
        </Stack>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
            },
          }}
        >
          {Sidebar}
        </Drawer>
      ) : null}
      <Box component="main" sx={{ flexGrow: 1, pb: isDesktop ? 0 : 8, minWidth: 0 }}>
        {!isDesktop ? (
          <AppBar
            position="sticky"
            elevation={0}
            sx={{
              bgcolor: 'background.paper',
              borderBottom: '1px solid',
              borderColor: 'divider',
              color: 'text.primary',
            }}
          >
            <Toolbar>
              <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>📚 课堂反馈助手</Typography>
              <IconButton onClick={toggleMode} color="inherit" aria-label="切换主题">
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Toolbar>
          </AppBar>
        ) : null}
        <Box sx={{ maxWidth: 920, mx: 'auto', p: { xs: 2, md: 3 } }}>
          {children}
        </Box>
      </Box>
      {!isDesktop ? (
        <BottomNavigation
          value={Math.max(0, navItems.findIndex(i => location.pathname.startsWith(i.path)))}
          onChange={(_, v) => navigate(navItems[v].path)}
          sx={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            zIndex: 1100,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          {navItems.map((item) => (
            <BottomNavigationAction key={item.path} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      ) : null}
    </Box>
  );
}
