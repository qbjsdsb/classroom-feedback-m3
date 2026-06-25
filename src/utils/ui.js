// ui.js - UI 事件桥接
// 业务模块（store、dataTransfer 等）派发事件，React 组件（UiBridge）订阅后渲染 MUI 的 Snackbar/Dialog
// 这样非 React 模块也能调用 Toast/Confirm/Loading

const listeners = { toast: [], confirm: [], undo: [], loading: [] };

export const uiEvents = {
  on(event, handler) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
    return () => {
      const idx = listeners[event].indexOf(handler);
      if (idx >= 0) listeners[event].splice(idx, 1);
    };
  },
  emit(event, ...args) {
    (listeners[event] || []).forEach(h => h(...args));
  },
};

export const UI = {
  // 显示普通 Toast 提示
  showToast(msg, duration = 3000) {
    uiEvents.emit('toast', { msg, duration });
  },
  // 显示确认对话框
  showConfirm(message, onConfirm) {
    uiEvents.emit('confirm', { message, onConfirm });
  },
  // 显示带撤销按钮的 Toast
  showUndoToast(message, onUndo, duration = 5000) {
    uiEvents.emit('undo', { message, onUndo, duration });
  },
  // 显示全屏加载
  showLoading(message) {
    uiEvents.emit('loading', { show: true, message });
  },
  // 更新加载文字
  updateLoading(message) {
    uiEvents.emit('loading', { show: true, message });
  },
  // 隐藏加载
  hideLoading() {
    uiEvents.emit('loading', { show: false });
  },
};
