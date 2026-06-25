import { createTheme } from '@mui/material/styles';

// Material 3 纯净配色
// 遵循 M3 规范：surface 色阶分层、headline/title/body 字体层级、按钮胶囊但克制阴影
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
        // M3 surface：亮色用近白但略带色调，暗色用近黑略带紫调
        default: isLight ? '#FEF7FF' : '#141218',
        paper: isLight ? '#FEF7FF' : '#1D1B20',
      },
      text: {
        primary: isLight ? '#1C1B1F' : '#E6E1E5',
        secondary: isLight ? '#49454F' : '#CAC4D0',
        disabled: isLight ? '#CAC4D0' : '#938F99',
      },
      divider: isLight ? '#E7E0EC' : '#322F35',
      action: {
        selected: isLight ? 'rgba(103, 80, 164, 0.08)' : 'rgba(208, 188, 255, 0.08)',
        hover: isLight ? 'rgba(103, 80, 164, 0.06)' : 'rgba(208, 188, 255, 0.06)',
      },
      success: { main: isLight ? '#386A20' : '#A8D77B' },
      error: { main: isLight ? '#BA1A1A' : '#FFB4AB' },
      warning: { main: isLight ? '#7C5800' : '#FFB77B' },
    },
    shape: {
      // M3 标准：small=8 medium=12 large=16 extraLarge=28
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Roboto", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      // M3 headline：用于页面主标题，medium 字重（不用 semibold，保持纯净）
      h4: { fontWeight: 400, letterSpacing: 0 },
      h5: { fontWeight: 500, letterSpacing: 0 },
      h6: { fontWeight: 500, letterSpacing: 0.15 },
      subtitle1: { fontWeight: 500, letterSpacing: 0.15 },
      subtitle2: { fontWeight: 500, letterSpacing: 0.1 },
      body1: { letterSpacing: 0.15 },
      body2: { letterSpacing: 0.25 },
      button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0.1 },
      caption: { letterSpacing: 0.4 },
      overline: { letterSpacing: 0.5 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          // M3 filled 按钮用胶囊；outlined/text 用 8 圆角更扁平
          root: ({ ownerState }) => ({
            borderRadius: ownerState.variant === 'contained' ? 20 : 12,
          }),
        },
      },
      MuiCard: {
        // M3 outlined：无阴影，仅 1px 边框；保留默认 16 圆角
        defaultProps: { variant: 'outlined', elevation: 0 },
        styleOverrides: {
          root: { borderRadius: 16, boxShadow: 'none' },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'transparent' },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            '&.Mui-selected': { fontWeight: 500 },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500 },
        },
      },
      MuiFab: {
        defaultProps: { disableRipple: false },
        styleOverrides: {
          root: { borderRadius: 16 },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 500 },
        },
      },
    },
  });
}
