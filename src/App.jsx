// App.jsx - 应用根组件
// 整合所有上下文：ThemeContext、DataContext、SessionContext
// 全局 UiBridge 监听 Toast/Confirm/Loading 事件

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider, CssBaseline, Box, CircularProgress, Typography } from '@mui/material';
import { ThemeProvider as CustomThemeProvider } from './contexts/ThemeContext';
import { useThemeMode } from './contexts/ThemeContext';
import { DataProvider, useData } from './store/DataContext';
import { SessionProvider } from './store/SessionContext';
import { createAppTheme } from './theme';
import Layout from './components/Layout';
import UiBridge from './components/UiBridge';
import StudentsPage from './pages/StudentsPage';
import StudentFormPage from './pages/StudentFormPage';
import SubjectSelectPage from './pages/SubjectSelectPage';
import RecordPage from './pages/RecordPage';
import HistoryPage from './pages/HistoryPage';
import SettingsPage from './pages/SettingsPage';

// 内部组件：渲染路由（在所有 Provider 内部）
function ThemedApp() {
  const { mode } = useThemeMode();
  const theme = createAppTheme(mode);
  const { ready } = useData();

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Layout>
          {/* 全局 UI 事件监听组件 */}
          <UiBridge />
          {!ready ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, gap: 2 }}>
              <CircularProgress />
              <Typography color="text.secondary">正在加载数据…</Typography>
            </Box>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/students" replace />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/students/new" element={<StudentFormPage />} />
              <Route path="/students/:id/edit" element={<StudentFormPage />} />
              <Route path="/subject-select" element={<SubjectSelectPage />} />
              <Route path="/record" element={<RecordPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          )}
        </Layout>
      </BrowserRouter>
    </MuiThemeProvider>
  );
}

export default function App() {
  return (
    <CustomThemeProvider>
      <DataProvider>
        <SessionProvider>
          <ThemedApp />
        </SessionProvider>
      </DataProvider>
    </CustomThemeProvider>
  );
}
