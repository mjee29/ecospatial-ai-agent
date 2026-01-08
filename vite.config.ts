
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': process.env
  },
  server: {
    proxy: {
      '/wms': {
        target: 'https://climate.gg.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wms/, '/ols/api/geoserver/wms'),
        secure: false
      }
    }
  }
});
