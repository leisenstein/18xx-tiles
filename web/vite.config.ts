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
    // Send /api calls to the ASP.NET Core API (HTTPS only) during development.
    // secure: false lets Node accept the local development certificate, which
    // Windows trusts but Node does not. Development only; not used in production.
    proxy: {
      '/api': { target: 'https://localhost:7299', secure: false },
    },
  },
})
