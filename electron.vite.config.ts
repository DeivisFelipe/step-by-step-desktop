import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()],
    optimizeDeps: {
      exclude: ['monaco-editor']
    },
    build: {
      rollupOptions: {
        input: {
          // The IDE window, and the presentation pages served to OBS / students.
          index: resolve('src/renderer/index.html'),
          overlay: resolve('src/renderer/overlay.html')
        }
      }
    }
  }
})
