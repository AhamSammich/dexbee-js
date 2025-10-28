import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM build for modern usage
  {
    entry: {
      index: 'src/index.ts',
      migrations: 'src/migrations.ts',
    },
    format: ['esm'],
    target: 'es2020',
    platform: 'browser',
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: true,
    minify: true,
    bundle: true,
    external: [],
    outDir: 'dist',
    treeshake: true,
    metafile: true,
  },
  // UMD build for script tag usage
  {
    entry: { 'index.umd': 'src/index.ts' },
    format: ['umd'],
    target: 'es2020',
    platform: 'browser',
    sourcemap: true,
    minify: true,
    bundle: true,
    external: [],
    outDir: 'dist',
    globalName: 'DexBee',
    treeshake: true,
    onSuccess: 'echo "✅ ESM and UMD builds completed successfully!"'
  }
]);