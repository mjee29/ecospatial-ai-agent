
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
        target: 'https://climate.gg.go.kr/ols/api/geoserver',
        changeOrigin: true,
        rewrite: (path) => {
          // /wms?... → /wms?...
          return path.replace(/^\/wms/, '/wms');
        },
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      },
      '/wfs': {
        target: 'https://climate.gg.go.kr/ols/api/geoserver',
        changeOrigin: true,
        rewrite: (path) => {
          // /wfs?... → /wfs?...
          return path.replace(/^\/wfs/, '/wfs');
        },
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
      ,
      // 에어코리아 API 프록시 (공공데이터포털)
      '/airkorea': {
        target: 'http://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/airkorea/, ''),
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      },
      // SGIS 인증 API 프록시 (kostat.go.kr)
      '/sgis-auth': {
        target: 'https://sgisapi.kostat.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sgis-auth/, ''),
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      },
      // SGIS 인구데이터 API 프록시 (mods.go.kr)
      '/sgis-data': {
        target: 'https://sgisapi.mods.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sgis-data/, ''),
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      },
      // 경기도 공공데이터 API 프록시 (openapi.gg.go.kr)
      '/gg-openapi': {
        target: 'https://openapi.gg.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gg-openapi/, ''),
        secure: false,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    }
  }
});
