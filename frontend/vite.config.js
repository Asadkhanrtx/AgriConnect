import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/auth': 'http://localhost:3001',
      '/api/marketplace': 'http://localhost:3002',
      '/api/orders': 'http://localhost:3003',
      '/api/media': 'http://localhost:3004',
      '/api/notifications': 'http://localhost:3005'
    }
  }
})
