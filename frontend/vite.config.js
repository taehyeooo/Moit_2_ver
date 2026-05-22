// frontend/vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  server: {
    proxy: {
      // '/api'로 시작하는 요청은 이제 Node.js 백엔드(3000번)로 보냅니다.
      '/api': {
        target: 'http://localhost:3000', // 👈 여기를 8000에서 3000으로 변경!
        changeOrigin: true,
        secure: false,
      }
    }
  }
})