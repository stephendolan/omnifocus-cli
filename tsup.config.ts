import { defineConfig } from 'tsup';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  outDir: 'dist',
  sourcemap: true,
  define: {
    __VERSION__: JSON.stringify(packageJson.version),
  },
});
