
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pagesのリポジトリ名に合わせて自動的にベースパスを調整します
// リポジトリ名が 'chromatica' の場合、 '/chromatica/' に設定する必要があります。
export default defineConfig({
  plugins: [react()],
  base: './', // 相対パスにすることで、どのようなディレクトリ構造でも動作するようにします
  server: {
    host: true,
    port: 5173,
    open: false
  }
});
