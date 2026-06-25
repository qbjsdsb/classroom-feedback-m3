import { createTheme } from '@mui/material/styles';

// Material 3 调色板（紫色为主色，对应原项目 #4F46E5，但用 M3 规范的色阶）
export function createAppTheme(mode) {
  const isLight = mode === 'light';
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isLight ? '#6750A4' : '#D0BCFF',
        light: isLight ? '#EADDFF' : '#4F378B',
        dark: isLight ? '#4F378B' : '#EADDFF',
        contrastText: isLight ? '#FFFFFF' : '#381E72',
      },
      secondary: {
        main: isLight ? '#625B71' : '#CCC2DC',
      },
      background: {
        default: isLight ? '#FFFBFE' : '#141218',
        paper: isLight ? '#FFFBFE' : '#1D1B20',
      },
      text: {
        primary: isLight ? '#1C1B1F' : '#E6E1E5',
        secondary: isLight ? '#49454F' : '#CAC4D0',
      },
      divider: isLight ? '#E7E0EC' : '#322F35',
      success: { main: isLight ? '#386A20' : '#A8D77B' },
      error: { main: isLight ? '#BA1A1A' : '#FFB4AB' },
      warning: { main: isLight ? '#7C5800' : '#FFB77B' },
    },
    shape: {
      borderRadius: 12, // M3 标准圆角
    },
    typography: {
      fontFamily: '"Roboto", "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif',
      h5: { fontWeight: 500 },
      h6: { fontWeight: 500 },
      button: { textTransform: 'none', fontWeight: 500 }, // M3 按钮不大写
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 20 }, // M3 胶囊按钮
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 16, boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.3)' },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'transparent' },
      },
    },
  });
}
