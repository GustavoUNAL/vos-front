import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    /** Permite abrir el dev server por IP de red (ej. http://192.168.x.x:5173). */
    host: true,
    /**
     * Mismo origen que el front: evita CORS al usar IP LAN en lugar de localhost.
     * getApiBase() en dev usa `${origin}/dev-api` si no hay VITE_API_URL.
     */
    proxy: {
      '/dev-api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/dev-api/, ''),
      },
    },
  },
})
