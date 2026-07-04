import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              return 'vendor-three';
            }
            if (id.includes('gsap')) {
              return 'vendor-gsap';
            }
            return 'vendor'; // Fallback for other node_modules dependencies
          }
        },
      },
    },
  },
});
