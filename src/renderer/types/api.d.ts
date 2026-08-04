import type { Api } from '@shared/ipc'

declare global {
  interface Window {
    api: Api
  }

  /** Injetado pelo `define` do Vite a partir do package.json. */
  const __APP_VERSION__: string
}
