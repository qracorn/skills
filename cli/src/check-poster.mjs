import { open, readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import {
  batchLimits, checkPoster, completedPoster, createQrReader, manifestPosters, safeReport,
  summarizeBatch, validExpectations, validImagePath,
} from './poster-core.mjs';
import { displayGeometry, imageInfo } from './image.mjs';

class InputError extends Error {}

async function boundedFile(path, limit, label) {
  let file;
  try {
    file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
    const stats = await file.stat();
    if (!stats.isFile() || stats.size === 0 || stats.size > limit) throw new Error();
    const bytes = Buffer.alloc(stats.size);
    const { bytesRead } = await file.read(bytes);
    if (bytesRead !== bytes.length) throw new Error();
    return bytes;
  } catch {
    throw new InputError('Could not read the ' + label + ' within its size limit.');
  } finally {
    await file?.close();
  }
}

async function readJson(filename, limit, label) {
  const bytes = await boundedFile(filename, limit, label);
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new InputError('The ' + label + ' must contain valid UTF-8 JSON.');
  }
}

function requireExpectations(expected) {
  if (!validExpectations(expected)) {
    throw new InputError('Supply 1–20 positions with public HTTP(S) page URLs. Exclude private hosts, passwords, login links and signed access parameters.');
  }
}

async function openReader() {
  const wasm = await readFile(new URL('./zxing_reader.wasm', import.meta.url));
  return createQrReader(Uint8Array.from(wasm).buffer);
}

async function inspectPoster(filename, expected, readCodes) {
  const image = await boundedFile(filename, 12 * 1024 * 1024, 'poster image');
  let info;
  try {
    info = imageInfo(image);
  } catch {
    throw new InputError('Use a still PNG or JPEG of at most 16 megapixels and 16,384 pixels per side.');
  }
  const codes = await readCodes(image);
  if (codes.length === 20) throw new InputError('The decoder reached its 20-code limit. Check smaller sections of the poster.');
  const { width, height } = displayGeometry(codes, info);
  const rows = checkPoster(codes, width, height, expected);
  return { decodedCount: codes.length, rows };
}

function errorMessage(error) {
  return error instanceof InputError ? error.message : 'The checker could not decode the poster. Export a new PNG and retry.';
}

async function localImage(root, image) {
  let filename;
  try {
    filename = await realpath(path.join(root, image));
  } catch {
    throw new InputError('Could not find the image relative to the batch manifest.');
  }
  const local = path.relative(root, filename);
  if (local === '..' || local.startsWith('..' + path.sep) || path.isAbsolute(local)) {
    throw new InputError('Keep the image inside the batch manifest folder.');
  }
  return filename;
}

async function checkBatch(manifest) {
  const data = await readJson(manifest, batchLimits.manifestBytes, 'batch manifest');
  const entries = manifestPosters(data);
  if (!entries) throw new InputError('Use a version 1 batch manifest containing 1–100 posters.');
  const root = await realpath(path.dirname(path.resolve(manifest)));
  const readCodes = await openReader();
  const posters = [];
  for (const [offset, entry] of entries.entries()) {
    const index = offset + 1;
    const image = validImagePath(entry?.image) ? entry.image : null;
    try {
      if (!image) throw new InputError('Supply a relative image filename with / between folders.');
      requireExpectations(entry.expected);
      const filename = await localImage(root, image);
      const { decodedCount, rows } = await inspectPoster(filename, entry.expected, readCodes);
      posters.push(completedPoster(index, image, decodedCount, rows, entry.expected));
    } catch (error) {
      posters.push({ index, image, status: 'input_error', error: errorMessage(error) });
    }
  }
  return summarizeBatch(posters);
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length !== 2) throw new InputError('Pass an image and expected-links JSON file, or --batch and a batch manifest.');
  if (args[0] === '--batch') {
    const report = await checkBatch(args[1]);
    console.log(JSON.stringify(report));
    if (report.summary.passed !== report.summary.total) process.exitCode = 2;
    return;
  }
  const expected = await readJson(args[1], 64 * 1024, 'expected-links file');
  requireExpectations(expected);
  const result = await inspectPoster(args[0], expected, await openReader());
  console.log(JSON.stringify({ decodedCount: result.decodedCount, rows: safeReport(result.rows, expected) }));
}

try {
  await run();
} catch (error) {
  console.error(JSON.stringify({ error: errorMessage(error) }));
  process.exitCode = 1;
}
