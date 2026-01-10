import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load ALL env variables (empty prefix loads non-VITE_ vars too)
  const env = loadEnv(mode, process.cwd(), '');
  
  // The target API URL - set via VITE_AI_API_TARGET env variable
  // This should be the full URL including the path (e.g., https://api.example.com/endpoint)
  const aiApiTarget = env.VITE_AI_API_TARGET || 'http://localhost:3001';
  
  // API key for authentication - set via AI_API_KEY env variable (not exposed to client)
  const aiApiKey = env.AI_API_KEY || '';
  
  // Parse the URL to extract origin and path
  let targetOrigin = aiApiTarget;
  let targetPath = '';
  try {
    const url = new URL(aiApiTarget);
    targetOrigin = url.origin;
    targetPath = url.pathname;
  } catch {
    // If URL parsing fails, use as-is
    console.warn('Failed to parse VITE_AI_API_TARGET, using as-is:', aiApiTarget);
  }
  
  console.log('AI Proxy Config:', {
    target: targetOrigin,
    path: targetPath,
    hasApiKey: !!aiApiKey,
  });
  
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
          // Add headers including the API key
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // Add API key header if configured
              if (aiApiKey) {
                // AWS API Gateway uses x-api-key
                proxyReq.setHeader('x-api-key', aiApiKey);
                // Standard Bearer token for other APIs
                proxyReq.setHeader('Authorization', `Bearer ${aiApiKey}`);
              }
              
              // Log proxy requests in development
              console.log(`[Proxy] ${req.method} ${req.url} -> ${targetOrigin}${targetPath}`);
            });
            
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log(`[Proxy] Response: ${proxyRes.statusCode} for ${req.url}`);
            });
            
            proxy.on('error', (err, req) => {
              console.error(`[Proxy] Error for ${req.url}:`, err.message);
            });
          },
        },
      },
    },
  };
});
