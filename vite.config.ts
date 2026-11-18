import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [react()],
  // Серверна збірка MCP читає дані з public/data на місці, копія не потрібна.
  build: { copyPublicDir: !isSsrBuild },
  test: { include: ['src/**/*.test.ts'] },
}));
