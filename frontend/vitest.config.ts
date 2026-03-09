import { mergeConfig } from 'vite'
import viteConfig from './vite.config'
import { defineConfig } from 'vitest/config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
    },
  }),
)
