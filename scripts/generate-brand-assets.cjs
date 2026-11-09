const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const out = path.join(__dirname, '..', 'build');
fs.mkdirSync(out, { recursive: true });

const size = 256;
const pixels = Buffer.alloc(size * size * 4);
const colors = {
  bg: [255, 253, 248, 255],
  green: [29, 107, 93, 255],
  deep: [22, 72, 61, 255],
  gold: [210, 168, 79, 255],
  grid: [107, 143, 133, 255],
  transparent: [0, 0, 0, 0]
};

const set = (x, y, color) => {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3];
};
const fillRect = (x, y, w, h, color) => {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(size, Math.ceil(x + w));
  const y1 = Math.min(size, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy += 1) for (let xx = x0; xx < x1; xx += 1) set(xx, yy, color);
};
const fillPoly = (points, color) => {
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...points.map((p) => p[1]))));
  for (let y = minY; y <= maxY; y += 1) {
    const nodes = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i];
      const [xj, yj] = points[j];
      if ((yi < y && yj >= y) || (yj < y && yi >= y)) nodes.push(Math.floor(xi + ((y - yi) / (yj - yi)) * (xj - xi)));
    }
    nodes.sort((a, b) => a - b);
    for (let i = 0; i < nodes.length; i += 2) for (let x = nodes[i]; x < nodes[i + 1]; x += 1) set(x, y, color);
  }
};
const line = (x0, y0, x1, y1, color, width = 4) => {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    fillRect(x0 - width / 2, y0 - width / 2, width, width, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
};

fillRect(0, 0, size, size, colors.transparent);
fillRect(24, 24, 208, 208, colors.bg);
fillPoly([[46, 172], [96, 56], [188, 56], [214, 158], [150, 204], [64, 204]], colors.bg);
line(46, 172, 96, 56, colors.deep, 8);
line(96, 56, 188, 56, colors.deep, 8);
line(188, 56, 214, 158, colors.deep, 8);
line(214, 158, 150, 204, colors.deep, 8);
line(150, 204, 64, 204, colors.deep, 8);
line(64, 204, 46, 172, colors.deep, 8);
line(78, 164, 150, 164, colors.grid, 4);
line(150, 164, 198, 132, colors.grid, 4);
line(94, 116, 184, 116, colors.grid, 4);
line(112, 74, 82, 178, colors.grid, 4);
fillRect(116, 130, 32, 54, colors.green);
fillRect(156, 100, 42, 84, colors.green);
line(92, 194, 126, 186, colors.gold, 8);
line(126, 186, 164, 164, colors.gold, 8);
line(164, 164, 200, 124, colors.gold, 8);
line(200, 124, 200, 160, colors.gold, 8);
line(200, 124, 166, 124, colors.gold, 8);
fillRect(204, 58, 20, 20, colors.gold);
fillRect(72, 188, 12, 12, colors.gold);

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, crc]);
};
const raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y += 1) {
  raw[y * (size * 4 + 1)] = 0;
  pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
fs.writeFileSync(path.join(out, 'icon.png'), png);

const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(1, 4);
icoHeader[6] = 0;
icoHeader[7] = 0;
icoHeader[8] = 0;
icoHeader[9] = 0;
icoHeader.writeUInt16LE(1, 10);
icoHeader.writeUInt16LE(32, 12);
icoHeader.writeUInt32LE(png.length, 14);
icoHeader.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(out, 'icon.ico'), Buffer.concat([icoHeader, png]));
