// Read dimensions before passing the compressed bytes to the native decoder.
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');

function exifOrientation(tiff) {
  if (tiff.length < 8) throw new Error('Invalid EXIF header');
  const little = tiff.toString('ascii', 0, 2) === 'II';
  const u16 = offset => little ? tiff.readUInt16LE(offset) : tiff.readUInt16BE(offset);
  const u32 = offset => little ? tiff.readUInt32LE(offset) : tiff.readUInt32BE(offset);
  if (u16(2) !== 42) throw new Error('Invalid EXIF byte order');
  const start = u32(4);
  const count = u16(start);
  if (start + 2 + count * 12 > tiff.length) throw new Error('Invalid EXIF directory');
  for (let entry = start + 2; entry < start + 2 + count * 12; entry += 12) {
    if (u16(entry) !== 0x0112) continue;
    if (u16(entry + 2) !== 3 || u32(entry + 4) !== 1) throw new Error('Invalid orientation');
    const orientation = u16(entry + 8);
    if (orientation < 1 || orientation > 8) throw new Error('Invalid orientation');
    return orientation;
  }
  return 1;
}

export function imageInfo(bytes) {
  let width = 0, height = 0, orientation = 1;
  if (bytes.subarray(0, 8).equals(pngSignature)) {
    let imageData = false, complete = false;
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const size = bytes.readUInt32BE(offset);
      const type = bytes.toString('latin1', offset + 4, offset + 8);
      const end = offset + 12 + size;
      if (end > bytes.length || type === 'acTL') throw new Error('Invalid or animated PNG');
      if (type === 'IHDR') {
        if (offset !== 8 || size !== 13) throw new Error('Invalid PNG header');
        width = bytes.readUInt32BE(offset + 8);
        height = bytes.readUInt32BE(offset + 12);
      }
      if (type === 'eXIf') orientation = exifOrientation(bytes.subarray(offset + 8, end - 4));
      if (type === 'IDAT' && size > 0) imageData = true;
      if (type === 'IEND') {
        complete = size === 0;
        break;
      }
      offset = end;
    }
    if (!imageData || !complete) throw new Error('Incomplete PNG');
  } else if (bytes.readUInt16BE(0) === 0xffd8) {
    let offset = 2;
    let complete = false;
    while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9) break;
      const size = bytes.readUInt16BE(offset);
      if (size < 2 || offset + size > bytes.length) throw new Error('Invalid JPEG segment');
      if (marker === 0xda) {
        complete = bytes.indexOf(Buffer.from([0xff, 0xd9]), offset + size) >= 0;
        break;
      }
      if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
        if (width || size < 8) throw new Error('Invalid JPEG frame');
        height = bytes.readUInt16BE(offset + 3);
        width = bytes.readUInt16BE(offset + 5);
      }
      if (marker === 0xe1 && bytes.toString('latin1', offset + 2, offset + 8) === 'Exif\0\0') {
        orientation = exifOrientation(bytes.subarray(offset + 8, offset + size));
      }
      offset += size;
    }
    if (!complete) throw new Error('Incomplete JPEG');
  }
  if (!width || !height || width > 16384 || height > 16384 || width * height > 16000000) {
    throw new Error('Unsupported dimensions or format');
  }
  return { width, height, orientation };
}

// ZXing reads the stored pixels. Map their corners to the user's display orientation.
export function displayGeometry(codes, { width, height, orientation }) {
  const swap = orientation >= 5;
  const displayWidth = swap ? height : width;
  const displayHeight = swap ? width : height;
  const flipX = [2, 3, 6, 7].includes(orientation);
  const flipY = [3, 4, 7, 8].includes(orientation);
  for (const code of codes) {
    for (const point of Object.values(code.position)) {
      const x = swap ? point.y : point.x;
      const y = swap ? point.x : point.y;
      point.x = flipX ? displayWidth - x : x;
      point.y = flipY ? displayHeight - y : y;
    }
  }
  return { width: displayWidth, height: displayHeight };
}
