import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/FlyCentral/',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5173,
  },
})
