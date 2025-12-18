import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '');
  
  // The target API URL - set via VITE_AI_API_TARGET env variable
  // This should be the full URL including the path (e.g., https://api.example.com/endpoint)
  const aiApiTarget = env.VITE_AI_API_TARGET || 'http://localhost:3001';
  
  // Parse the URL to extract origin and path
  let targetOrigin = aiApiTarget;
  let targetPath = '';
  try {
    const url = new URL(aiApiTarget);
    targetOrigin = url.origin;
    targetPath = url.pathname;
  } catch {
    // If URL parsing fails, use as-is
  }
  
  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      proxy: {
        // Proxy /api/ai requests to the target API server
        '/api/ai': {
          target: targetOrigin,
          changeOrigin: true,
          rewrite: () => targetPath || '/',
          secure: true,
        },
      },
    },
  };
});
