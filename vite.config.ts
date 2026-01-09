
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
        rewrite: (path) => {
          // URL의 쿼리 파라미터를 추출하여 경로에 포함
          const url = new URL(path, 'http://localhost');
          const apiKey = url.searchParams.get('apiKey');
          const pathWithoutQuery = path.split('?')[0];
          const newPath = pathWithoutQuery.replace(/^\/wms/, '/ols/api/geoserver/wms');
          
          // apiKey가 있으면 쿼리 파라미터로 추가
          if (apiKey) {
            return `${newPath}?apiKey=${apiKey}&${url.searchParams.toString().replace(`apiKey=${apiKey}`, '').replace(/^&/, '')}`;
          }
          return newPath;
        },
        secure: false
      }
    }
  }
});
