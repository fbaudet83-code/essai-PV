
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Base relatif: compatible avec "simple web server" et Netlify drag&drop
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version || '0.0.0'),
  },
  plugins: [react()],
  esbuild: {
    // Force les loaders en format string pour éviter l'erreur "Invalid loader value: 4"
    loader: 'tsx',
    include: /.*\.(ts|tsx)$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
});