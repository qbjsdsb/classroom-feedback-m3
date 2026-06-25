import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Vite 配置：React 插件 + PWA（课堂反馈助手）
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '课堂反馈助手',
        short_name: '课堂反馈',
        description: 'AI驱动的课堂反馈生成工具，帮助老师快速生成专业反馈',
        theme_color: '#6750A4',
        background_color: '#FFFBFE',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
        ],
        categories: ['education', 'productivity']
      },
      workbox: {
        // 扩展 globPatterns 包含 json/txt/onnx/wasm：缓存本地 whisper-tiny 模型文件
        // 模型文件位于 public/vendor/whisper-tiny/（含 config.json/tokenizer.json/onnx 等）
        // onnx 文件最大约 30MB，maximumFileSizeToCacheInBytes 设为 50MB 以容纳
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,txt,onnx,wasm}'],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024
      }
    })
  ],
  server: { host: true, port: 5173 }
})
