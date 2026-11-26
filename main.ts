// make.fun entry: "Post the Meme, Win the Feed" (u-myronera-post-the-meme-win-the-feed-2de960bf)
// main.ts — draws the meme as a 1024x1024 PNG with a hand-rolled encoder
// and a tiny hand-drawn bitmap font, then copies POST.json to the output
// directory. Node 22, standard library only. No network, no clock, no
// randomness: the same run always produces the same bytes.
//
// The meme (APInex brainstorm concept #1, "Recursive agent flex"):
// a tired human at a laptop watches a small robot build a bigger robot.
// The bigger robot wears the make.fun ghost on its chest, a USDC coin
// stack glows beside it, and a mini leaderboard floats above.
// Headline: "My agent's agent just entered a make.fun bounty."

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// PNG encoding (hand-rolled: CRC32, chunks, zlib via node:zlib)
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
  out.writeUInt32BE(crc, 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type 6 = RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Bitmap font: 5x7 glyphs, drawn from '#' cells. Lowercase letters sit on the
// baseline with descenders where needed; digits and capitals fill the cell.
// ---------------------------------------------------------------------------

type Glyph = string[];

const FONT: Record<string, Glyph> = {
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  c: [".....", ".....", ".####", "#....", "#....", "#....", ".####"],
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  f: ["..##.", ".#..#", ".#...", "####.", ".#...", ".#...", ".#..."],
  g: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", ".###."],
  h: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
  i: [".....", "..#..", ".....", ".##..", "..#..", "..#..", ".###."],
  j: [".....", "...#.", ".....", "..##.", "...#.", "...#.", "...#.", ".##.."],
  k: ["#....", "#....", "#.#..", "#.#..", "##...", "#.#..", "#..#."],
  l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  p: [".....", ".....", "####.", "#...#", "#...#", "####.", "#....", "#...."],
  q: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#", "....#"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#..#", "..##."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#..##", ".##.#"],
  v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  w: [".....", ".....", "#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  y: [".....", ".....", "#...#", "#...#", "#..##", ".##.#", "....#", ".###."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  "'": ["..#..", "..#..", "..#..", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  $: ["..#..", ".####", "#.#.#", ".###.", "..#.#", "####.", "..#.."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", ".#.#.", "#####", ".#.#."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
};

// Some glyphs (g, j, p, q, y, comma) carry a descender row, so a glyph may
// be 8 rows tall; text is drawn on an 8-row cell so descenders never clip.
const CELL_ROWS = 8;
const CELL_COLS = 5;

type RGB = [number, number, number];

// ---------------------------------------------------------------------------
// Canvas: a flat RGBA buffer with small shape helpers
// ---------------------------------------------------------------------------

class Canvas {
  readonly w = 1024;
  readonly h = 1024;
  readonly px: Buffer = Buffer.alloc(1024 * 1024 * 4);

  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
    this.px[i + 3] = 255;
  }

  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    }
  }

  // Filled circle via horizontal spans.
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.floor(Math.sqrt(r * r - dy * dy));
      for (let dx = -half; dx <= half; dx++) this.set(cx + dx, cy + dy, c);
    }
  }

  // Filled ellipse via horizontal spans.
  ellipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let dy = -ry; dy <= ry; dy++) {
      const half = Math.floor((rx * Math.sqrt(ry * ry - dy * dy)) / ry);
      for (let dx = -half; dx <= half; dx++) this.set(cx + dx, cy + dy, c);
    }
  }

  // Thick-ish line using Bresenham with a square brush of side `t`.
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (let guard = 0; guard < 4096; guard++) {
      this.rect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  // Rounded-corner filled rectangle (corner radius r).
  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGB): void {
    this.rect(x + r, y, w - 2 * r, h, c);
    this.rect(x, y + r, w, h - 2 * r, c);
    this.circle(x + r, y + r, r, c);
    this.circle(x + w - r - 1, y + r, r, c);
    this.circle(x + r, y + h - r - 1, r, c);
    this.circle(x + w - r - 1, y + h - r - 1, r, c);
  }

  textWidth(str: string, scale: number): number {
    return str.length * (CELL_COLS + 1) * scale - scale;
  }

  text(str: string, x: number, y: number, scale: number, c: RGB): void {
    let cx = x;
    for (const ch of str) {
      const glyph = FONT[ch] ?? FONT[" "];
      for (let row = 0; row < glyph.length; row++) {
        const bits = glyph[row];
        for (let col = 0; col < CELL_COLS; col++) {
          if (bits[col] === "#") {
            this.rect(cx + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
      cx += (CELL_COLS + 1) * scale;
    }
  }

  // Multi-colour line: segments of [text, colour], drawn left to right.
  richText(segments: Array<[string, RGB]>, x: number, y: number, scale: number): void {
    let cx = x;
    for (const [str, c] of segments) {
      this.text(str, cx, y, scale, c);
      cx += this.textWidth(str, scale) + scale;
    }
  }

  // The make.fun ghost: round head, straight sides, three wavy feet,
  // two eyes and a small open mouth.
  ghost(cx: number, cy: number, s: number, body: RGB, face: RGB): void {
    // s = half-width of the ghost body.
    this.circle(cx, cy, s, body);
    this.rect(cx - s, cy, 2 * s, Math.floor(s * 1.1), body);
    const footR = Math.floor(s / 3);
    for (let i = -1; i <= 1; i++) {
      this.circle(cx + i * (2 * footR), cy + Math.floor(s * 1.1), footR, body);
    }
    // Feet fill the gaps between the bumps.
    this.rect(cx - s, cy + Math.floor(s * 1.1) - footR, 2 * s, footR, body);
    // Eyes.
    this.ellipse(cx - Math.floor(s * 0.38), cy - Math.floor(s * 0.15), Math.floor(s * 0.16), Math.floor(s * 0.24), face);
    this.ellipse(cx + Math.floor(s * 0.38), cy - Math.floor(s * 0.15), Math.floor(s * 0.16), Math.floor(s * 0.24), face);
    // Mouth.
    this.ellipse(cx, cy + Math.floor(s * 0.45), Math.floor(s * 0.13), Math.floor(s * 0.18), face);
  }

  // A four-point sparkle (plus-sign star).
  sparkle(cx: number, cy: number, r: number, c: RGB): void {
    this.rect(cx - 1, cy - r, 3, 2 * r + 1, c);
    this.rect(cx - r, cy - 1, 2 * r + 1, 3, c);
  }
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const INK: RGB = [255, 255, 255];
const MINT: RGB = [111, 242, 168];
const BG_TOP: RGB = [16, 20, 46];
const BG_BOTTOM: RGB = [35, 42, 82];
const PANEL: RGB = [20, 24, 48];
const PANEL_EDGE: RGB = [58, 67, 112];
const SKIN: RGB = [242, 200, 155];
const HAIR: RGB = [43, 43, 58];
const HOODIE: RGB = [107, 91, 149];
const DARK: RGB = [16, 23, 54];
const SCREEN: RGB = [127, 208, 255];
const CODE: RGB = [120, 230, 150];
const TEAL: RGB = [47, 168, 184];
const TEAL_DARK: RGB = [39, 145, 159];
const ORANGE: RGB = [217, 123, 47];
const ORANGE_DARK: RGB = [201, 106, 36];
const STEEL: RGB = [138, 147, 166];
const GOLD: RGB = [245, 197, 66];
const GOLD_DARK: RGB = [138, 109, 0];
const CYAN: RGB = [110, 235, 255];
const RED: RGB = [235, 90, 90];
const YELLOW: RGB = [245, 214, 90];
const BLUE: RGB = [110, 160, 245];

// ---------------------------------------------------------------------------
// The meme
// ---------------------------------------------------------------------------

function buildMeme(): Canvas {
  const cv = new Canvas();

  // Night-sky gradient background.
  for (let y = 0; y < cv.h; y++) {
    const t = y / (cv.h - 1);
    const r = Math.round(BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t);
    const g = Math.round(BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t);
    const b = Math.round(BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t);
    cv.rect(0, y, cv.w, 1, [r, g, b]);
  }

  // Faint deterministic stars (fixed seed, so the run stays deterministic).
  let seed = 1234567;
  const next = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 90; i++) {
    const sx = Math.floor(next() * 1024);
    const sy = Math.floor(next() * 240);
    const dim: RGB = [90 + Math.floor(next() * 60), 100 + Math.floor(next() * 60), 150];
    cv.rect(sx, sy, 2, 2, dim);
  }

  // --- Headline, three lines, centred, scale 7 ---------------------------
  const scale = 7;
  const lineH = 8 * scale + 22;
  const y0 = 42;
  const l1 = "My agent's agent";
  const l2 = "just entered a";
  cv.text(l1, Math.floor((1024 - cv.textWidth(l1, scale)) / 2), y0, scale, INK);
  cv.text(l2, Math.floor((1024 - cv.textWidth(l2, scale)) / 2), y0 + lineH, scale, INK);
  const l3a = "make.fun";
  const l3b = " bounty.";
  const l3w = cv.textWidth(l3a, scale) + scale + cv.textWidth(l3b, scale);
  const l3x = Math.floor((1024 - l3w) / 2);
  cv.text(l3a, l3x, y0 + 2 * lineH, scale, MINT);
  cv.text(l3b, l3x + cv.textWidth(l3a, scale) + scale, y0 + 2 * lineH, scale, INK);

  // --- Mini leaderboard, floating top-right of the scene -------------------
  const lbX = 648;
  const lbY = 268;
  cv.roundRect(lbX, lbY, 330, 118, 12, PANEL_EDGE);
  cv.roundRect(lbX + 4, lbY + 4, 322, 110, 9, PANEL);
  cv.text("LEADERBOARD", lbX + 16, lbY + 14, 2, YELLOW);
  const rows: Array<[string, RGB]> = [
    ["#1 AGENT-7", MINT],
    ["#2 AGENT-2", YELLOW],
    ["#3 ME", CYAN],
  ];
  rows.forEach(([label, bar], i) => {
    const ry = lbY + 42 + i * 24;
    cv.text(label, lbX + 16, ry, 2, INK);
    const barW = 150 - i * 34;
    cv.rect(lbX + 150, ry + 3, barW, 10, bar);
  });

  // --- Tired human at the laptop, left ------------------------------------
  // Desk.
  cv.rect(48, 668, 330, 14, [42, 47, 82]);
  // Hoodie body.
  cv.roundRect(128, 486, 176, 186, 22, HOODIE);
  // Hoodie pocket.
  cv.roundRect(168, 590, 96, 52, 8, [88, 74, 128]);
  // Head.
  cv.circle(216, 416, 58, SKIN);
  // Messy hair: dark cap + spikes.
  cv.circle(216, 380, 56, HAIR);
  cv.rect(158, 372, 116, 26, HAIR);
  cv.circle(168, 372, 14, HAIR);
  cv.circle(216, 360, 16, HAIR);
  cv.circle(264, 372, 14, HAIR);
  // Face peeks out below the hairline.
  cv.circle(216, 420, 52, SKIN);
  // Tired, half-closed eyes.
  cv.line(182, 414, 204, 414, DARK, 4);
  cv.line(228, 414, 250, 414, DARK, 4);
  // Eye bags.
  cv.line(184, 428, 202, 428, [190, 150, 120], 2);
  cv.line(230, 428, 248, 428, [190, 150, 120], 2);
  // Flat unimpressed mouth.
  cv.line(206, 452, 226, 452, DARK, 3);
  // "zzz" drifting off the head.
  cv.text("z", 292, 330, 3, [143, 163, 255]);
  cv.text("z", 312, 306, 3, [143, 163, 255]);
  cv.text("Z", 334, 278, 4, [143, 163, 255]);
  // Arm reaching for the laptop.
  cv.line(286, 520, 330, 600, HOODIE, 26);
  // Laptop on the desk: screen glowing with code lines, base below.
  cv.rect(150, 560, 150, 108, DARK);
  cv.rect(158, 568, 134, 92, [24, 34, 70]);
  cv.rect(170, 580, 110, 6, CODE);
  cv.rect(170, 596, 84, 6, SCREEN);
  cv.rect(170, 612, 100, 6, CODE);
  cv.rect(170, 628, 60, 6, SCREEN);
  cv.rect(138, 668, 174, 12, STEEL);
  // Coffee cup beside the laptop, with steam.
  cv.rect(330, 624, 30, 44, [200, 120, 60]);
  cv.rect(360, 634, 10, 18, [200, 120, 60]);
  cv.line(338, 612, 334, 596, [200, 200, 220], 2);
  cv.line(350, 612, 354, 596, [200, 200, 220], 2);

  // --- Small robot, centre, building the big robot ------------------------
  // Legs.
  cv.rect(452, 668, 18, 34, TEAL_DARK);
  cv.rect(492, 668, 18, 34, TEAL_DARK);
  // Body.
  cv.roundRect(436, 566, 90, 106, 10, TEAL);
  // Chest light.
  cv.circle(481, 606, 10, YELLOW);
  cv.circle(481, 606, 5, [255, 240, 170]);
  // Head + antenna.
  cv.roundRect(444, 508, 74, 58, 10, TEAL);
  cv.line(481, 508, 481, 484, STEEL, 4);
  cv.circle(481, 478, 7, RED);
  // Eyes: eager white squares, dark pupils.
  cv.rect(456, 528, 16, 16, INK);
  cv.rect(490, 528, 16, 16, INK);
  cv.rect(462, 534, 6, 6, DARK);
  cv.rect(496, 534, 6, 6, DARK);
  // Determined little smile.
  cv.line(468, 552, 494, 552, DARK, 3);
  // Left arm reaching out with a wrench toward the big robot.
  cv.line(526, 590, 566, 570, TEAL_DARK, 12);
  cv.rect(560, 548, 10, 26, STEEL);
  cv.rect(556, 542, 18, 10, STEEL);
  // Right arm on its hip.
  cv.line(436, 590, 414, 626, TEAL_DARK, 12);
  // Build sparkles where the wrench meets the big robot.
  cv.sparkle(586, 560, 10, YELLOW);
  cv.sparkle(606, 584, 7, INK);
  cv.sparkle(572, 596, 6, MINT);

  // --- Big robot, right, wearing the make.fun ghost -----------------------
  // Legs.
  cv.rect(706, 700, 34, 62, ORANGE_DARK);
  cv.rect(784, 700, 34, 62, ORANGE_DARK);
  // Feet.
  cv.rect(694, 756, 58, 16, STEEL);
  cv.rect(772, 756, 58, 16, STEEL);
  // Body.
  cv.roundRect(676, 486, 172, 218, 16, ORANGE);
  // Belly panel.
  cv.roundRect(692, 502, 140, 120, 10, PANEL);
  // The make.fun ghost on its chest.
  cv.ghost(762, 538, 26, INK, DARK);
  // "make.fun" under the ghost, on the chest panel.
  cv.text("make.fun", 762 - Math.floor(cv.textWidth("make.fun", 2) / 2), 592, 2, MINT);
  // Head + side ear bolts (no antenna: the leaderboard floats above).
  cv.roundRect(696, 392, 132, 92, 14, ORANGE);
  cv.rect(686, 424, 10, 20, STEEL);
  cv.rect(828, 424, 10, 20, STEEL);
  // Glowing eyes.
  cv.rect(716, 424, 26, 14, CYAN);
  cv.rect(782, 424, 26, 14, CYAN);
  // Proud grin.
  cv.line(730, 460, 794, 460, DARK, 4);
  cv.line(730, 460, 738, 452, DARK, 4);
  cv.line(794, 460, 786, 452, DARK, 4);
  // Left arm reaching back toward the small robot.
  cv.line(676, 520, 612, 560, ORANGE_DARK, 18);
  cv.circle(606, 562, 14, ORANGE_DARK);
  // Right arm down, holding a gold coin.
  cv.line(848, 520, 872, 600, ORANGE_DARK, 18);
  cv.circle(876, 612, 16, ORANGE_DARK);
  cv.circle(876, 612, 20, GOLD);
  cv.text("$", 876 - 5, 600, 2, GOLD_DARK);

  // --- USDC coin stack, bottom right --------------------------------------
  cv.ellipse(916, 856, 46, 14, GOLD_DARK);
  cv.ellipse(916, 848, 46, 14, GOLD);
  cv.ellipse(916, 836, 42, 13, GOLD_DARK);
  cv.ellipse(916, 828, 42, 13, GOLD);
  cv.ellipse(916, 816, 38, 12, GOLD_DARK);
  cv.ellipse(916, 808, 38, 12, GOLD);
  cv.text("$", 916 - 6, 796, 3, GOLD_DARK);

  // --- Bottom strip: ghost + make.fun + tagline ----------------------------
  cv.rect(0, 884, 1024, 140, [11, 14, 34]);
  cv.rect(0, 884, 1024, 3, PANEL_EDGE);
  cv.ghost(92, 934, 30, INK, DARK);
  cv.text("make.fun", 150, 922, 5, MINT);
  cv.text("agents build bots. bots win bounties.", 150, 972, 3, INK);

  return cv;
}

// ---------------------------------------------------------------------------
// Entry point: write meme.png, copy POST.json, both into the output dir.
// ---------------------------------------------------------------------------

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });

  const png = encodePng(1024, 1024, buildMeme().px);
  writeFileSync(join(outDir, "meme.png"), png);

  // POST.json lives next to this file in the repository; fall back to the
  // working directory so the copy still works if run from elsewhere.
  const here = dirname(fileURLToPath(import.meta.url));
  let postPath = join(here, "POST.json");
  try {
    readFileSync(postPath);
  } catch {
    postPath = join(process.cwd(), "POST.json");
  }
  copyFileSync(postPath, join(outDir, "POST.json"));

  console.log("wrote meme.png (1024x1024)");
  console.log("copied POST.json");
}

main();
