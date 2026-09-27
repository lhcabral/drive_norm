/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_WS_HOST?: string
  readonly VITE_LANDING_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
