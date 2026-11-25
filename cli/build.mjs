import {build} from 'esbuild';
import {copyFile, mkdir} from 'node:fs/promises';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const destination = join(root, '../skills/check-poster/scripts');
await mkdir(destination, {recursive:true});
await build({
  absWorkingDir:root,
  entryPoints:['src/check-poster.mjs'],
  outfile:join(destination, 'check-poster.mjs'),
  bundle:true,
  platform:'node',
  format:'esm',
  target:'node22',
  legalComments:'eof',
  minifyWhitespace:true,
});
await copyFile(fileURLToPath(import.meta.resolve('zxing-wasm/reader/zxing_reader.wasm')), join(destination, 'zxing_reader.wasm'));
