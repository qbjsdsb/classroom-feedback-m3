import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Vite 配置：React 插件 + PWA（课堂反馈助手）
// base 通过环境变量 VITE_BASE 控制：
//   - 本地开发（npm run dev）：默认 '/'，不影响本地访问
//   - GitHub Pages 部署：Actions 中设置 VITE_BASE=/classroom-feedback-m3-pages/
// 严谨起见，本地 dev 始终用 '/'，避免相对路径导致 HMR 异常
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // includeAssets 用相对路径，base 已由 Vite 自动处理前缀
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-192.png', 'icon-maskable-512.png'],
      manifest: {
        name: '课堂反馈助手',
        short_name: '课堂反馈',
        description: 'AI驱动的课堂反馈生成工具，帮助老师快速生成专业反馈',
        theme_color: '#6750A4',
        background_color: '#FFFBFE',
        display: 'standalone',
        // start_url 和 icon.src 用相对路径，部署到子路径时自动解析
        start_url: './',
        scope: './',
        // Mac 程序坞/Safari "添加到程序坞"要求 PNG 图标（192/512），仅 SVG 会安装失败
        // maskable：图标内容在中心 80% safe zone，外圈填充背景色，适配 Android/iOS 圆形裁剪
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        categories: ['education', 'productivity']
      },
      workbox: {
        // precache 仅包含常规静态资源（js/css/html/图标/字体/whisper 配置文件）
        // 大体积的 onnx 模型（~30MB）与 ort wasm（~23MB）改用 runtime caching（CacheFirst）
        // 避免 SW precache 达 60MB+ 导致首次安装缓慢、iOS 配额报错
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,txt}'],
        globIgnores: [
          '**/vendor/whisper-tiny/onnx/**',
          '**/*.onnx',
          '**/*.wasm'
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // ONNX 模型与 wasm 运行时：内容寻址（hash/版本固定），CacheFirst 永久缓存
            urlPattern: ({ url }) =>
              url.pathname.endsWith('.onnx') || url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'whisper-model-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 年
              },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  server: { host: true, port: 5173 }
})
