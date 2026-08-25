import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Единственный источник версии приложения на клиенте (см.
  // src/lib/version.js) — используется для принудительного
  // обновления (me() шлёт её на сервер, тот сверяет с MIN_APP_VERSION)
  // и показа в Настройках. package.json остаётся единственным местом,
  // где версию нужно бампать руками при релизе с breaking-изменением.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    globals: true,
  },
})