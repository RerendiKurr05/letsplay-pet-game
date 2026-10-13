import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This config is the key to making a React app embeddable in WordPress:
// - a single fixed output filename (app.js / app.css), not Vite's default
//   hashed filenames, so the PHP side can enqueue a predictable path
// - no code-splitting (one bundle), since WordPress is just loading this
//   as a single <script> tag on one page, not serving it as a full app host
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) return 'app.css';
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
