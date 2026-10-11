/// <reference types="vite/client" />

// Settings the website reads from web/.env at build time (see web/.env.example). Only VITE_ variables reach the browser code.
interface ImportMetaEnv {
  // The API's address when it is not the website's own (for example https://api.example.com). Empty or missing: relative /api/... addresses.
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
