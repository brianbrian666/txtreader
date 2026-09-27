import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    // 开发时 /api 代理到后端服务（需先启动 node server.mjs）
    proxy: {
      '/api': 'http://localhost:5174',
    },
  },
  preview: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:5174',
    },
  },
})
