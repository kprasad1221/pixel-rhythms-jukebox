import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
await build({ entryPoints: ['src/app.js'], bundle: true, format: 'esm', outfile: 'public/app.js' });
// Bundling places the wasm initializer in app.js, so its import.meta URL
// resolves this companion asset beside app.js.
await copyFile('node_modules/@reactor-team/js-sdk/dist/wasm/reactor_wasm_bg.wasm', 'public/reactor_wasm_bg.wasm');
