import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
// Settings come from web/.env (or .env.local, or the environment); see web/.env.example. Every one has a default, so no .env file is needed for
// normal development.
//   VITE_PORT              port for "npm run dev" (default 5173)
//   VITE_PREVIEW_PORT      port for "npm run preview" (default 4173)
//   VITE_ALLOWED_HOSTS     extra host names the dev server answers to, comma-separated (for a tunnel or another machine); "all" allows any.
//                          Default: Vite's own (localhost only), which protects against DNS rebinding.
//   VITE_API_PROXY_TARGET  where /api calls are forwarded (default https://localhost:7299, the API's development address)
//   VITE_API_PROXY_SECURE  "true" to require a trusted certificate from that target. Default false, which accepts the .NET development
//                          certificate (Windows trusts it, Node does not). Set true when the target has a real certificate.
//   VITE_API_BASE_URL      read by the website itself (src/api/client.ts), not here: see .env.example
export default defineConfig(({ mode }) => {
  // '' = load every variable, not only VITE_ ones; these are used only by this file, at dev and preview time, never sent to the browser.
  const env = loadEnv(mode, process.cwd(), '')

  const port = (name: string, fallback: number) => {
    const n = Number(env[name])
    return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback
  }
  const hosts = env.VITE_ALLOWED_HOSTS?.trim()
  const allowedHosts =
    hosts === 'all'
      ? true
      : hosts
        ? hosts
            .split(',')
            .map((h) => h.trim())
            .filter(Boolean)
        : undefined

  // changeOrigin: true makes the API see its own address, so links it builds (such as the email confirmation link) point to the API.
  const proxy = {
    '/api': {
      target: env.VITE_API_PROXY_TARGET || 'https://localhost:7299',
      secure: env.VITE_API_PROXY_SECURE === 'true',
      changeOrigin: true,
    },
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      // "@/..." means "src/..." in imports
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: { port: port('VITE_PORT', 5173), allowedHosts, proxy },
    preview: { port: port('VITE_PREVIEW_PORT', 4173), allowedHosts, proxy },
  }
})
