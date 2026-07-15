// Renders a 1200×630 social-share (Open Graph / Twitter) banner for a plugin, in the
// dark "Ulanzi Community Store" visual system. Built as an SVG and rasterized to PNG
// with resvg (self-contained, no headless browser) so it runs the same locally and in CI.
//
// The banner is what X/Twitter, WhatsApp, Discord, Slack, etc. show when a plugin link
// is shared. It sells the plugin: icon with a brand glow, name + description, meta chips
// (version / platforms / downloads), the plugin sitting on a deck-key mockup, and a
// "Get it free on the Ulanzi Community Store" call to action — all in English.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(__dirname, '..', 'assets', 'fonts');
const LOGO_FILE = join(__dirname, '..', '..', '..', 'apps', 'marketing-site', 'assets', 'logo-512.png');

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// Palette (matches assets/style.css + the store banner visual system).
const BG0 = '#0a0e1a';
const BG1 = '#0d1117';
const WHITE = '#f4f7fb';
const MUTED = '#aeb6c6';
const BRAND = '#41e6c3';
const BRAND_2 = '#4f9cff';
const BRAND_INK = '#05221b';
const CHIP_TEXT = '#d6dbe6';

// Static Inter faces (family name "Inter", weights 400/700). Static files — not the
// variable InterVariable.ttf — because its family name is "Inter Variable", which never
// matches font-family="Inter": macOS happened to fall back to a good face, but Linux CI
// picked a wrong instance, breaking both the look and every width estimate.
let fontBuffers = null;
async function loadFonts() {
  if (!fontBuffers) {
    fontBuffers = [
      await readFile(join(FONT_DIR, 'Inter-Regular.ttf')),
      await readFile(join(FONT_DIR, 'Inter-Bold.ttf')),
    ];
  }
  return fontBuffers;
}

const RESVG_FONT_OPTS = { defaultFontFamily: 'Inter', loadSystemFonts: false };

// Store logo for the eyebrow. Missing file degrades to a plain brand dot.
let logoDataUrl;
async function loadLogo() {
  if (logoDataUrl === undefined) {
    try {
      logoDataUrl = `data:image/png;base64,${(await readFile(LOGO_FILE)).toString('base64')}`;
    } catch {
      logoDataUrl = null;
    }
  }
  return logoDataUrl;
}

function escapeXml(s) {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
}

// Last-resort width estimate, only used if a measurement render throws.
function approxWidth(text, fontSize, weight) {
  const factor = weight >= 700 ? 0.56 : 0.53;
  return text.length * fontSize * factor;
}

// Exact text measurement: render the string alone and take resvg's own bounding box.
// Whatever face fontdb actually resolves is also what gets measured, so chip/CTA/wrap
// widths can never drift from the final raster (the bug behind clipped chips on CI).
function makeMeasure(buffers) {
  const cache = new Map();
  return function measure(text, fontSize, weight) {
    const w = weight >= 600 ? 700 : 400;
    const key = `${fontSize}|${w}|${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      try {
        const svg =
          `<svg xmlns="http://www.w3.org/2000/svg" width="8000" height="300">` +
          `<text x="10" y="200" font-family="Inter" font-size="${fontSize}" font-weight="${w}">${escapeXml(text)}</text></svg>`;
        const bbox = new Resvg(svg, { font: { ...RESVG_FONT_OPTS, fontBuffers: buffers } }).getBBox();
        width = bbox && bbox.width > 0 ? bbox.width : approxWidth(text, fontSize, weight);
      } catch {
        width = approxWidth(text, fontSize, weight);
      }
      cache.set(key, width);
    }
    return width;
  };
}

// Greedy word-wrap into at most `maxLines`; the last line is ellipsized if it overflows.
function wrapText(text, { fontSize, weight, maxWidth, maxLines, measure }) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, fontSize, weight) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);

  // Ellipsize the final line if content was left over or it still overflows.
  if (lines.length === maxLines) {
    let last = lines[maxLines - 1];
    const consumed = lines.join(' ').split(/\s+/).length;
    const overflowed = consumed < words.length;
    if (overflowed || measure(last, fontSize, weight) > maxWidth) {
      while (last.length && measure(last + '…', fontSize, weight) > maxWidth) {
        last = last.slice(0, -1).trimEnd();
      }
      lines[maxLines - 1] = last + '…';
    }
  }
  return lines;
}

function textLines(lines, { x, y, lineHeight, fontSize, weight, fill, spacing }) {
  // Normalize weight to 400 or 700 for better resvg compatibility with variable fonts
  const normalizedWeight = weight >= 600 ? '700' : '400';
  return lines
    .map((line, i) =>
      `<text x="${x}" y="${y + i * lineHeight}" font-family="Inter" font-size="${fontSize}" ` +
      `font-weight="${normalizedWeight}" fill="${fill}"${spacing ? ` letter-spacing="${spacing}"` : ''}>` +
      `${escapeXml(line)}</text>`,
    )
    .join('\n');
}

const PLATFORM_LABEL = { mac: 'macOS', windows: 'Windows', linux: 'Linux' };

function formatDownloads(n) {
  if (!n || n <= 0) return null;
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// A rounded meta chip. Returns { svg, width } so chips can be laid out in a row.
function chip(x, y, label, { accent = false, downloadIcon = false, measure } = {}) {
  const font = 22;
  const h = 46;
  const padX = 18;
  const iconW = downloadIcon ? 26 : 0;
  const w = padX * 2 + iconW + measure(label, font, 700);
  const stroke = accent ? 'rgba(65,230,195,0.38)' : 'rgba(255,255,255,0.10)';
  const fill = accent ? 'rgba(65,230,195,0.08)' : 'rgba(255,255,255,0.055)';
  const textFill = accent ? '#7dead0' : CHIP_TEXT;
  const ix = x + padX - 2;
  const iy = y + 13;
  const icon = downloadIcon
    ? `<path d="M ${ix + 9} ${iy + 1} v 10 M ${ix + 4} ${iy + 7} l 5 5 l 5 -5 M ${ix + 2} ${iy + 17} h 14" ` +
      `stroke="#8fe8d2" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  const svg =
    `<rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` +
    icon +
    `<text x="${x + padX + iconW}" y="${y + 30}" font-family="Inter" font-size="${font}" font-weight="700" fill="${textFill}">${escapeXml(label)}</text>`;
  return { svg, width: w };
}

// The deck mockup on the right: a tilted key panel with the plugin icon glowing on the
// center key — showing the plugin "installed" on the hardware.
function deckMockup(iconDataUrl) {
  const cx = 1035;
  const cy = 300;
  const panel = { x: 835, y: 100, w: 400, h: 400, rx: 30 };
  const key = 96;
  const gap = 16;
  const startX = panel.x + 40;
  const startY = panel.y + 40;

  let keys = '';
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const kx = startX + col * (key + gap);
      const ky = startY + row * (key + gap);
      const isCenter = row === 1 && col === 1;
      if (isCenter && iconDataUrl) {
        keys +=
          `<circle cx="${kx + key / 2}" cy="${ky + key / 2}" r="105" fill="url(#keyGlow)"/>` +
          `<image href="${iconDataUrl}" x="${kx}" y="${ky}" width="${key}" height="${key}" clip-path="url(#keyClip)" preserveAspectRatio="xMidYMid slice"/>` +
          `<rect x="${kx}" y="${ky}" width="${key}" height="${key}" rx="20" fill="none" stroke="${BRAND}" stroke-opacity="0.9" stroke-width="2.5"/>`;
      } else {
        keys +=
          `<rect x="${kx}" y="${ky}" width="${key}" height="${key}" rx="20" fill="#0d121b" stroke="rgba(255,255,255,0.06)" stroke-width="1.5"/>`;
      }
    }
  }

  return `<g transform="rotate(-6 ${cx} ${cy})">
    <rect x="${panel.x}" y="${panel.y}" width="${panel.w}" height="${panel.h}" rx="${panel.rx}" fill="#10141d" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    ${keys}
  </g>`;
}

// Builds the SVG markup. `iconDataUrl` may be null (renders a branded placeholder tile).
function buildSvg({ name, description, iconDataUrl, version, platforms, downloads, repo, logo, measure }) {
  const PAD = 72;
  const NAME_MAX_W = 500;
  const DESC_MAX_W = 660;

  const iconSize = 150;
  const iconX = PAD;
  const iconY = 132;
  const iconCx = iconX + iconSize / 2;
  const iconCy = iconY + iconSize / 2;
  const textX = iconX + iconSize + 36;

  const nameLines = wrapText(name || 'Untitled plugin', {
    fontSize: 58,
    weight: 700,
    maxWidth: NAME_MAX_W,
    maxLines: 2,
    measure,
  });
  const descLines = wrapText(description || 'A community plugin for the Ulanzi Deck.', {
    fontSize: 28,
    weight: 400,
    maxWidth: DESC_MAX_W,
    maxLines: 2,
    measure,
  });

  // Name is vertically centered against the icon.
  const nameLH = 68;
  const nameFirstBaseline = iconCy - ((nameLines.length - 1) * nameLH) / 2 + 20;

  // Meta chips: version · platforms · downloads.
  const chipY = 418;
  const chipGap = 14;
  const chipDefs = [];
  if (version) chipDefs.push({ label: `v${version}`, opts: { accent: true } });
  const platformLabel = (platforms || []).map((p) => PLATFORM_LABEL[p] || p).join(' · ');
  if (platformLabel) chipDefs.push({ label: platformLabel, opts: {} });
  const dl = formatDownloads(downloads);
  if (dl) chipDefs.push({ label: `${dl} download${downloads === 1 ? '' : 's'}`, opts: { downloadIcon: true } });

  let chipX = PAD;
  let chipsSvg = '';
  for (const c of chipDefs) {
    const built = chip(chipX, chipY, c.label, { ...c.opts, measure });
    chipsSvg += built.svg;
    chipX += built.width + chipGap;
  }

  // Call-to-action pill.
  const ctaLabel = 'Get it free on the Ulanzi Community Store';
  const ctaFont = 26;
  const ctaH = 78;
  const ctaY = 500;
  const ctaX = PAD;
  const arrowCx = ctaX + 44;
  const arrowCy = ctaY + ctaH / 2;
  const ctaTextX = arrowCx + 24 + 18;
  const ctaW = ctaTextX - ctaX + measure(ctaLabel, ctaFont, 700) + 36;

  const eyebrowLogo = logo
    ? `<image href="${logo}" x="${PAD}" y="60" width="40" height="40" clip-path="url(#logoClip)"/>`
    : `<circle cx="${PAD + 20}" cy="80" r="7" fill="${BRAND}"/>`;

  const iconTile = iconDataUrl
    ? `<image href="${iconDataUrl}" x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" ` +
      `clip-path="url(#iconClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="34" fill="#131a26"/>` +
      `<text x="${iconCx}" y="${iconCy + 22}" font-family="Inter" font-size="64" ` +
      `font-weight="700" fill="${BRAND}" text-anchor="middle">U</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG0}"/>
      <stop offset="1" stop-color="${BG1}"/>
    </linearGradient>
    <radialGradient id="glowTeal" cx="0.10" cy="0.05" r="0.75">
      <stop offset="0" stop-color="${BRAND}" stop-opacity="0.16"/>
      <stop offset="1" stop-color="${BRAND}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBlue" cx="0.92" cy="0.95" r="0.8">
      <stop offset="0" stop-color="${BRAND_2}" stop-opacity="0.20"/>
      <stop offset="1" stop-color="${BRAND_2}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="iconGlow">
      <stop offset="0" stop-color="${BRAND}" stop-opacity="0.30"/>
      <stop offset="1" stop-color="${BRAND}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="keyGlow">
      <stop offset="0" stop-color="${BRAND}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${BRAND}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="cta" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${BRAND}"/>
      <stop offset="1" stop-color="#2fd4b0"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 H 0 V 48" fill="none" stroke="rgba(255,255,255,0.035)" stroke-width="1"/>
    </pattern>
    <clipPath id="iconClip">
      <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="34"/>
    </clipPath>
    <clipPath id="keyClip">
      <rect x="987" y="252" width="96" height="96" rx="20"/>
    </clipPath>
    <clipPath id="logoClip">
      <rect x="${PAD}" y="60" width="40" height="40" rx="10"/>
    </clipPath>
  </defs>

  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#grid)"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#glowTeal)"/>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#glowBlue)"/>

  ${deckMockup(iconDataUrl)}

  ${eyebrowLogo}
  <text x="${PAD + (logo ? 54 : 40)}" y="88" font-family="Inter" font-size="24" font-weight="700" letter-spacing="3.5" fill="${BRAND}">ULANZI COMMUNITY STORE</text>

  <circle cx="${iconCx}" cy="${iconCy}" r="160" fill="url(#iconGlow)"/>
  ${iconTile}
  <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="34" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>

  ${textLines(nameLines, { x: textX, y: nameFirstBaseline, lineHeight: nameLH, fontSize: 58, weight: 800, fill: WHITE })}
  ${textLines(descLines, { x: PAD, y: 340, lineHeight: 40, fontSize: 28, weight: 400, fill: MUTED })}

  ${chipsSvg}

  <rect x="${ctaX}" y="${ctaY}" width="${ctaW.toFixed(1)}" height="${ctaH}" rx="${ctaH / 2}" fill="url(#cta)"/>
  <circle cx="${arrowCx}" cy="${arrowCy}" r="24" fill="rgba(4,32,25,0.16)"/>
  <path d="M ${arrowCx} ${arrowCy - 12} L ${arrowCx} ${arrowCy + 8} M ${arrowCx - 10} ${arrowCy - 1} L ${arrowCx} ${arrowCy + 10} L ${arrowCx + 10} ${arrowCy - 1}" stroke="${BRAND_INK}" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="${ctaTextX}" y="${arrowCy + 10}" font-family="Inter" font-size="${ctaFont}" font-weight="700" fill="${BRAND_INK}">${escapeXml(ctaLabel)}</text>

  ${repo ? `<text x="1128" y="596" font-family="Inter" font-size="20" font-weight="400" fill="#6b7688" text-anchor="end">${escapeXml(`github.com/${repo}`)}</text>` : ''}
</svg>`;
}

// Renders a plugin banner to a PNG Buffer (1200×630).
export async function renderBanner({ name, description, iconDataUrl, version, platforms, downloads, repo }) {
  const logo = await loadLogo();
  const buffers = await loadFonts();
  const measure = makeMeasure(buffers);
  const svg = buildSvg({ name, description, iconDataUrl, version, platforms, downloads, repo, logo, measure });
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: OG_WIDTH },
    font: { ...RESVG_FONT_OPTS, fontBuffers: buffers },
  });
  return resvg.render().asPng();
}
