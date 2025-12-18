import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '');
  
  // The target API URL - set via VITE_AI_API_TARGET env variable
  // or defaults to a placeholder
  const aiApiTarget = env.VITE_AI_API_TARGET || 'http://localhost:3001';
  
  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      proxy: {
        // Proxy /api/ai requests to the target API server
        '/api/ai': {
          target: aiApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ai/, ''),
          secure: false,
        },
      },
    },
  };
});
