const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c >>> 0;
  }
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  }
  return (c ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const toCrc = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([len, toCrc, crc]);
}

function createPng(width, height, rgbaBuffer) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const ihdrChunk = makeChunk('IHDR', ihdr);

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    scanlines.writeUInt8(0, y * (1 + width * 4));
    rgbaBuffer.copy(
      scanlines,
      y * (1 + width * 4) + 1,
      y * width * 4,
      (y + 1) * width * 4
    );
  }

  const compressed = zlib.deflateSync(scanlines);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function generateTrayIcon() {
  const width = 32;
  const height = 32;
  const pixels = Buffer.alloc(width * height * 4, 0); // all transparent

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
  }

  function drawDisc(cx, cy, r, color) {
    const [cr, cg, cb, ca] = color;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= r) {
          setPixel(x, y, cr, cg, cb, ca);
        }
      }
    }
  }

  // Cute Paw Print
  // Outline pads first (dark slate #1e2030)
  const outline = [30, 32, 48, 255];
  drawDisc(16, 21, 8.5, outline);
  drawDisc(8, 12, 4.5, outline);
  drawDisc(13, 8, 4.8, outline);
  drawDisc(19, 8, 4.8, outline);
  drawDisc(24, 12, 4.5, outline);

  // Fill pads (crisp light pastel / coral #f5a97f & white)
  const padFill = [245, 169, 127, 255]; // Pastel coral
  const mainFill = [255, 255, 255, 255]; // Crisp white
  drawDisc(16, 21, 6.5, mainFill);
  drawDisc(16, 22, 4.5, padFill); // inner soft tint

  drawDisc(8, 12, 3.0, padFill);
  drawDisc(13, 8, 3.2, padFill);
  drawDisc(19, 8, 3.2, padFill);
  drawDisc(24, 12, 3.0, padFill);

  const pngBuf = createPng(width, height, pixels);
  const outDir = path.join(__dirname, '../assets');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const outFile = path.join(outDir, 'tray-icon.png');
  fs.writeFileSync(outFile, pngBuf);
  console.log('Successfully generated tray-icon.png at:', outFile);
}

function generateAppIcon() {
  const size = 512;
  const pixels = Buffer.alloc(size * size * 4, 0);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    pixels[idx] = r;
    pixels[idx + 1] = g;
    pixels[idx + 2] = b;
    pixels[idx + 3] = a;
  }

  function drawDisc(cx, cy, r, color) {
    const [cr, cg, cb, ca] = color;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= r) {
          setPixel(x, y, cr, cg, cb, ca);
        }
      }
    }
  }

  // Rounded squircle background (macOS / Windows standard shape)
  const cornerRadius = 96;
  const pad = 24;
  const bg = [30, 32, 48, 255]; // #1e2030 dark slate
  const border = [138, 173, 244, 255]; // #8aadf4 soft pastel blue

  for (let y = pad; y < size - pad; y++) {
    for (let x = pad; x < size - pad; x++) {
      let isInside = true;
      // Check 4 rounded corners
      if (x < pad + cornerRadius && y < pad + cornerRadius) {
        isInside = Math.hypot(x - (pad + cornerRadius), y - (pad + cornerRadius)) <= cornerRadius;
      } else if (x >= size - pad - cornerRadius && y < pad + cornerRadius) {
        isInside = Math.hypot(x - (size - pad - cornerRadius), y - (pad + cornerRadius)) <= cornerRadius;
      } else if (x < pad + cornerRadius && y >= size - pad - cornerRadius) {
        isInside = Math.hypot(x - (pad + cornerRadius), y - (size - pad - cornerRadius)) <= cornerRadius;
      } else if (x >= size - pad - cornerRadius && y >= size - pad - cornerRadius) {
        isInside = Math.hypot(x - (size - pad - cornerRadius), y - (size - pad - cornerRadius)) <= cornerRadius;
      }

      if (isInside) {
        setPixel(x, y, bg[0], bg[1], bg[2], bg[3]);
      }
    }
  }

  // Cute Paw Print (scaled 16x)
  const s = 16;
  const outline = [17, 17, 27, 255];
  drawDisc(16 * s, 21 * s, 8.5 * s, outline);
  drawDisc(8 * s, 12 * s, 4.5 * s, outline);
  drawDisc(13 * s, 8 * s, 4.8 * s, outline);
  drawDisc(19 * s, 8 * s, 4.8 * s, outline);
  drawDisc(24 * s, 12 * s, 4.5 * s, outline);

  const padFill = [245, 169, 127, 255]; // Pastel coral
  const mainFill = [255, 255, 255, 255]; // Crisp white
  drawDisc(16 * s, 21 * s, 6.5 * s, mainFill);
  drawDisc(16 * s, 22 * s, 4.5 * s, padFill);

  drawDisc(8 * s, 12 * s, 3.0 * s, padFill);
  drawDisc(13 * s, 8 * s, 3.2 * s, padFill);
  drawDisc(19 * s, 8 * s, 3.2 * s, padFill);
  drawDisc(24 * s, 12 * s, 3.0 * s, padFill);

  const pngBuf = createPng(size, size, pixels);
  const outDir = path.join(__dirname, '../assets');
  const outFile = path.join(outDir, 'icon.png');
  fs.writeFileSync(outFile, pngBuf);
  console.log('Successfully generated icon.png at:', outFile);
}

generateTrayIcon();
generateAppIcon();
