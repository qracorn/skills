import { readFile } from 'node:fs/promises';
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';
import { displayGeometry, exifOrientation, imageInfo } from './image.mjs';
import { InputError } from './io.mjs';

const codeLimit = 20;
const formatError = 'Use a complete still PNG, JPEG or WebP of at most 12 MiB, 16 megapixels and 16,384 pixels per side.';

function requireWebp(valid) {
  if (!valid) throw new InputError(formatError);
}

function webpInfo(bytes) {
  requireWebp(bytes.length >= 20 && bytes.readUInt32LE(4) === bytes.length - 8 &&
    bytes.toString('latin1',8,12) === 'WEBP');
  let canvasWidth, canvasHeight, width, height, orientation = 1;
  for (let offset = 12; offset < bytes.length;) {
    requireWebp(offset + 8 <= bytes.length);
    const kind = bytes.toString('latin1',offset,offset+4);
    const size = bytes.readUInt32LE(offset+4);
    const start = offset+8, end = start+size;
    requireWebp(end + size % 2 <= bytes.length);
    switch (kind) {
      case 'VP8X':
        requireWebp(offset === 12 && size === 10 && !(bytes[start] & 2));
        canvasWidth = 1 + bytes.readUIntLE(start+4,3);
        canvasHeight = 1 + bytes.readUIntLE(start+7,3);
        break;
      case 'ANIM':
      case 'ANMF':
        throw new InputError(formatError);
      case 'VP8L': {
        requireWebp(width === undefined && size >= 5 && bytes[start] === 0x2f);
        const header = bytes.readUInt32LE(start+1);
        requireWebp((header >>> 29) === 0);
        width = 1 + (header & 0x3fff);
        height = 1 + ((header >>> 14) & 0x3fff);
        break;
      }
      case 'VP8 ':
        requireWebp(width === undefined && size >= 10 && !(bytes[start] & 1) &&
          bytes.readUIntBE(start+3,3) === 0x9d012a);
        width = bytes.readUInt16LE(start+6) & 0x3fff;
        height = bytes.readUInt16LE(start+8) & 0x3fff;
        break;
      case 'EXIF': {
        const tag = bytes.subarray(start,end);
        const tiff = tag.toString('latin1',0,6) === 'Exif\0\0' ? tag.subarray(6) : tag;
        orientation = exifOrientation(tiff);
        break;
      }
    }
    offset = end + size % 2;
  }
  // Check both the advertised canvas and the compressed frame before any pixel allocation.
  requireWebp(width > 0 && height > 0 && width <= 16384 && height <= 16384 && width * height <= 16_000_000);
  requireWebp(canvasWidth === undefined || (canvasWidth === width && canvasHeight === height));
  return {width,height,orientation};
}

async function webpPixels(bytes, info, wasmBytes, loader) {
  const { default: createDecoder } = await import(loader.href);
  const wasm = wasmBytes ?? await readFile(new URL('./webp_dec.wasm', import.meta.url));
  const decoder = await createDecoder({wasmBinary:wasm});
  // The icodec WASM binding calls this factory synchronously to construct its RGBA
  // result. Scope the hook to decode so other importers keep their own implementation.
  const previous = globalThis._icodec_ImageData;
  globalThis._icodec_ImageData = (data, width, height) => ({data,width,height});
  try {
    const pixels = decoder.decode(bytes);
    requireWebp(pixels?.width === info.width && pixels.height === info.height);
    return pixels;
  } finally {
    if (previous === undefined) delete globalThis._icodec_ImageData;
    else globalThis._icodec_ImageData = previous;
  }
}

export async function readImage(imageBytes, qrWasm, webpWasm, webpLoader = new URL('./webp_decoder.mjs', import.meta.url)) {
  if (!imageBytes?.byteLength || imageBytes.byteLength > 12 * 1024 * 1024) throw new InputError(formatError);
  const bytes = Buffer.isBuffer(imageBytes) ? imageBytes : Buffer.from(imageBytes);
  const isWebp = bytes.toString('latin1',0,4) === 'RIFF';
  try {
    const info = isWebp ? webpInfo(bytes) : imageInfo(bytes);
    const image = isWebp ? await webpPixels(bytes, info, webpWasm, webpLoader) : bytes;
    await prepareZXingModule({fireImmediately:true, overrides:{wasmBinary:qrWasm}});
    const results = await readBarcodes(image, {
      formats:['QRCode'], tryHarder:true, maxNumberOfSymbols:codeLimit, textMode:'Plain',
    });
    // ZXing can report an image-loading failure as one invalid, empty result.
    if (results.some(result => !result.isValid)) throw new InputError(formatError);
    const codes = results.map(({text,position}) => ({text,position}));
    const dimensions = displayGeometry(codes, info);
    return {...dimensions, decodedCount:codes.length, limitReached:codes.length >= codeLimit, codes};
  } catch {
    throw new InputError(formatError);
  }
}
