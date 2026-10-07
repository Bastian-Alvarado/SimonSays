import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Note vs V2:
//  - `outDir` was an absolute path into one developer's Documents folder; it
//    now builds to ./dist, which the server auto-detects and hosts.
//  - V2 inlined GEMINI_API_KEY into the browser bundle via `define`, which
//    shipped the secret to every viewer of the overlay. Gemini calls now
//    happen server-side, so the browser never sees the key.
export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    fs: {
      // ../shared/protocol.js is imported by hooks/useBackend.ts and lives
      // outside this root, so the dev server must be allowed to read it.
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
