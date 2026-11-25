import {build} from 'esbuild';
import {chmod,copyFile,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=dirname(fileURLToPath(import.meta.url));
const bin=join(root,'bin');
const general=join(root,'../skills/qracorn/scripts');
const legacy=join(root,'../skills/check-poster/scripts');
await Promise.all([bin,general,legacy].map(directory=>mkdir(directory,{recursive:true})));
const shared={
  absWorkingDir:root, bundle:true, platform:'node', format:'esm', target:'node22',
  legalComments:'eof', minifyWhitespace:true,
};
await build({...shared,entryPoints:['src/check-poster.mjs'],outfile:join(legacy,'check-poster.mjs')});
await build({
  ...shared,minify:true,entryPoints:['src/qracorn.mjs'],outfile:join(bin,'qracorn.mjs'),external:['./webp_decoder.mjs'],
  // qrcode's Node PNG writer uses built-in CommonJS modules.
  banner:{js:'import {createRequire} from "node:module";const require=createRequire(import.meta.url);'},
});
const zxing=fileURLToPath(import.meta.resolve('zxing-wasm/reader/zxing_reader.wasm'));
const webp=new URL(import.meta.resolve('icodec/webp-dec.wasm'));
await copyFile(zxing,join(legacy,'zxing_reader.wasm'));
await copyFile(zxing,join(bin,'zxing_reader.wasm'));
await copyFile(webp,join(bin,'webp_dec.wasm'));
await copyFile(new URL('webp-dec.js',webp),join(bin,'webp_decoder.mjs'));
await chmod(join(bin,'qracorn.mjs'),0o755);
for (const file of ['qracorn.mjs','webp_dec.wasm','webp_decoder.mjs','zxing_reader.wasm']) {
  await copyFile(join(bin,file),join(general,file));
}
