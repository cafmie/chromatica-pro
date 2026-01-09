
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // baseを './' にすることで、リポジトリ名が何であっても相対パスでアセットを読み込めるようにします
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // ソースマップがあるとデバッグがしやすくなります
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
  }
});
