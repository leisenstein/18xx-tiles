import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/..." means "src/..." in imports
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Send /api calls to the ASP.NET Core API during development
    proxy: {
      '/api': 'http://localhost:5010',
    },
  },
})
