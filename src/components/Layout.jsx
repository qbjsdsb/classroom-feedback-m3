import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, BottomNavigation, BottomNavigationAction, useMediaQuery, useTheme, IconButton, Toolbar, Typography, AppBar, Stack, Divider } from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import MicIcon from '@mui/icons-material/Mic';
import HistoryIcon from '@mui/icons-material/History';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useNavigate, useLocation } from 'react-router-dom';
import { useThemeMode } from '../contexts/ThemeContext';

// 电脑端为主：侧边栏紧凑化，内容区最大宽度 960
const drawerWidth = 240;

const navItems = [
  { label: '学生管理', icon: <PeopleIcon />, path: '/students' },
  { label: '课堂录音', icon: <MicIcon />, path: '/record' },
  { label: '历史反馈', icon: <HistoryIcon />, path: '/history' },
  { label: '系统设置', icon: <SettingsIcon />, path: '/settings' },
];

// 响应式布局：桌面端侧边栏（md 以上）+ 移动端底部导航栏（md 以下）
export default function Layout({ children }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleMode } = useThemeMode();

  const Sidebar = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 3, minHeight: 64 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 500, letterSpacing: 0.15 }}>
          课堂反馈助手
        </Typography>
      </Toolbar>
      <List sx={{ flex: 1, px: 2, py: 1 }}>
        {navItems.map((item) => {
          const selected = location.pathname.startsWith(item.path);
          return (
            <ListItemButton
              key={item.path}
              selected={selected}
              onClick={() => navigate(item.path)}
              sx={{
                borderRadius: 28,
                mb: 0.5,
                py: 1,
                pl: 2,
                // M3 navigation drawer item：选中态用 tonal 高亮
                '&.Mui-selected': { bgcolor: 'action.selected' },
                '&.Mui-selected:hover': { bgcolor: 'action.selected' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: selected ? 'primary.main' : 'text.secondary' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: selected ? 500 : 400,
                  color: selected ? 'primary.main' : 'text.primary',
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <IconButton onClick={toggleMode} size="small" aria-label="切换主题" sx={{ bgcolor: 'action.hover' }}>
            {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
          <Typography variant="caption" color="text.secondary">Material 3 · v0.2</Typography>
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
              backgroundImage: 'none',
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
              backgroundImage: 'none',
            }}
          >
            <Toolbar>
              <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 500 }}>课堂反馈助手</Typography>
              <IconButton onClick={toggleMode} color="inherit" aria-label="切换主题">
                {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Toolbar>
          </AppBar>
        ) : null}
        {/* 电脑端为主：内容区紧凑化 960，留白收紧 */}
        <Box sx={{ maxWidth: { xs: '100%', md: 960 }, mx: 'auto', p: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
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
            bgcolor: 'background.paper',
            backgroundImage: 'none',
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
