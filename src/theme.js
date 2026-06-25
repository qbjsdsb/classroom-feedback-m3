import { createTheme } from '@mui/material/styles';

// Material 3 设计系统
// 遵循 M3 规范：surface 色阶分层、headline/title/body 字体层级、状态层（state layer）、
// standard easing 动效曲线、克制阴影（tonal elevation 代替）
// 主题 token 命名遵循 M3 Material Theme Builder 输出
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
      tertiary: {
        // M3 tertiary：用于成功/积极反馈的辅助色
        main: isLight ? '#7D5260' : '#EFB8C8',
      },
      background: {
        // M3 surface 色阶分层：暗色模式下 default(surface) 与 paper(surface-container-low) 拉开层级，
        // 卡片与背景区分更清晰（避免暗色模式过于扁平）
        default: isLight ? '#FEF7FF' : '#141218',
        paper: isLight ? '#FEF7FF' : '#211F26',
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
        focus: isLight ? 'rgba(103, 80, 164, 0.10)' : 'rgba(208, 188, 255, 0.10)',
        active: isLight ? 'rgba(103, 80, 164, 0.10)' : 'rgba(208, 188, 255, 0.10)',
      },
      success: { main: isLight ? '#386A20' : '#A8D77B' },
      error: { main: isLight ? '#BA1A1A' : '#FFB4AB' },
      warning: { main: isLight ? '#7C5800' : '#FFB77B' },
      info: { main: isLight ? '#00639B' : '#9CCAFF' },
    },
    shape: {
      // M3 形状比例：small=8 medium=12 large=16 extraLarge=28 full=9999
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Roboto", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      // M3 Type Scale：headline 用 medium 字重（不用 semibold，保持克制纯净）
      h4: { fontWeight: 400, letterSpacing: 0 },
      h5: { fontWeight: 500, letterSpacing: 0 },
      // 标题字间距：中文用 0.1 折中（纯中文 0 偏挤，0.15 偏松，混合标题仍可读）
      h6: { fontWeight: 500, letterSpacing: 0.1 },
      subtitle1: { fontWeight: 500, letterSpacing: 0.1 },
      subtitle2: { fontWeight: 500, letterSpacing: 0.1 },
      // 中文行高优化：默认 1.43 在中文下偏挤，提到 1.6 提升可读性
      body1: { letterSpacing: 0.15, lineHeight: 1.6 },
      body2: { letterSpacing: 0.25, lineHeight: 1.6 },
      button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0.1 },
      caption: { letterSpacing: 0.4 },
      overline: { letterSpacing: 0.5 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          // M3 filled 按钮用 16 圆角（非全胶囊，更克制）；outlined/text 用 10 更扁平
          root: ({ ownerState }) => ({
            borderRadius: ownerState.variant === 'contained' ? 16 : 10,
            // M3 状态层：hover 时叠加 8% primary
            transition: 'background-color 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1)',
          }),
          // Button 图标对齐微调：startIcon 右内边距收紧，视觉与文字基线更平衡
          startIcon: { marginRight: -4, marginLeft: 0 },
        },
      },
      MuiCard: {
        // M3 outlined：无阴影，仅 1px 边框；12 圆角
        defaultProps: { variant: 'outlined', elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: 'none',
            // 交互卡片 hover 叠加状态层（仅对有 onClick 的卡片生效由页面控制，这里给基础过渡）
            transition: 'box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1), border-color 0.2s cubic-bezier(0.2, 0, 0, 1)',
          },
        },
      },
      MuiCardContent: {
        // 紧凑化：默认 padding 16/24 → 12/12
        styleOverrides: {
          root: { padding: 12, '&:last-child': { paddingBottom: 12 } },
        },
      },
      MuiCardHeader: {
        // 紧凑化：收紧 CardHeader 内边距
        styleOverrides: {
          root: { padding: 12 },
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
            // M3 navigation drawer item：选中态 tonal 高亮 + medium 字重
            borderRadius: 28,
            transition: 'background-color 0.2s cubic-bezier(0.2, 0, 0, 1)',
            '&.Mui-selected': { fontWeight: 500 },
            '&.Mui-selected:hover': { bgcolor: 'action.selected' },
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
          root: {
            borderRadius: 16,
            // M3 FAB：hover 抬升阴影，transition 用 standard easing
            transition: 'box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 500 },
        },
      },
      MuiTextField: {
        defaultProps: {
          // M3 outlined text field：默认 variant outlined，圆角 8（比 12 更克制）
          variant: 'outlined',
        },
        styleOverrides: {
          root: {
            // M3 输入框圆角 8（M3 spec：text-field 容器用 4-8 圆角）
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              transition: 'border-color 0.15s cubic-bezier(0.2, 0, 0, 1)',
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          // M3 tooltip：深色背景、小圆角、紧凑 padding
          tooltip: {
            backgroundColor: isLight ? '#322F35' : '#E6E1E5',
            color: isLight ? '#E6E1E5' : '#322F35',
            fontSize: 12,
            borderRadius: 4,
            padding: '4px 8px',
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          // M3 divider：更柔和（透明度略降）
          root: { borderColor: isLight ? 'rgba(231, 224, 236, 0.7)' : 'rgba(50, 47, 53, 0.7)' },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: { transition: 'none' },
        },
      },
    },
  });
}
