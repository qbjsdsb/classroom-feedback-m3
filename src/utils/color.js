// color.js - 颜色工具函数
// 用于科目色等用户自定义颜色在暗色模式下的可读性适配

/**
 * hex 转 rgb 分量
 */
function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#')) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

/**
 * hex 颜色 + 透明度 → rgba 字符串
 */
export function hexToRgba(hex, alpha) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/**
 * 暗色模式下科目色自动提亮：与白色混合 35%，避免深色科目在深背景上对比度不足。
 * 亮色模式原样返回（不改数据，仅改显示）。
 * @param {string} hex - 科目色 hex（如 #1A237E）
 * @param {boolean} isDark - 当前是否暗色模式
 * @returns {string} 适配后的 hex
 */
export function adaptColorForTheme(hex, isDark) {
  const c = hexToRgb(hex);
  if (!c || !isDark) return hex;
  const mix = (v) => Math.round(v + (255 - v) * 0.35);
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(mix(c.r))}${toHex(mix(c.g))}${toHex(mix(c.b))}`;
}
