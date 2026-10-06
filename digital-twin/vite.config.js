import { defineConfig, loadEnv } from 'vite';

/**
 * ANODOS Digital Twin — Vite configuration.
 * Configured for remote FastAPI backend integration (default: http://10.20.20.92:8001).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const targetHost = env.VITE_BACKEND_URL || 'http://10.20.20.92:8001';
  const wsTarget = targetHost.replace(/^http/, 'ws');

  return {
    server: {
      port: 5173,
      host: true,
      open: false,
      proxy: {
        '/api': {
          target: targetHost,
          changeOrigin: true
        },
        '/health': {
          target: targetHost,
          changeOrigin: true
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true
        }
      }
    },
    build: {
      target: 'es2020',
      outDir: 'dist',
      sourcemap: true
    },
    assetsInclude: ['**/*.glb', '**/*.gltf', '**/*.hdr']
  };
});
