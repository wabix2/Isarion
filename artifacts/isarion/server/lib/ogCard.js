/**
 * Dynamic social-share card generator.
 *
 * Replaces the previous behavior of `/invite-card.png`, which served the
 * raw app icon with no design, no copy, and no personalization — i.e. the
 * exact "fake implementation" a real growth loop needs to not have. This
 * renders an actual branded 1200x630 OG/Twitter card per request, built as
 * SVG and rasterized to PNG with resvg (no headless browser, no native
 * canvas toolchain — just a small precompiled Rust binding).
 *
 * Bundled Inter font files are passed explicitly (`loadSystemFonts: false`)
 * so the render is pixel-identical regardless of what fonts happen to be
 * installed on the host — the same reasoning that led the in-app share
 * cards to ship exact font weights instead of relying on the OS default.
 */

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const FONT_DIR = path.resolve(__dirname, '..', 'assets', 'fonts');
const FONT_FILES = ['Inter-Regular.ttf', 'Inter-SemiBold.ttf', 'Inter-Bold.ttf', 'Inter-ExtraBold.ttf']
  .map((f) => path.join(FONT_DIR, f))
  .filter((f) => fs.existsSync(f));

const WIDTH = 1200;
const HEIGHT = 630;

// Greedy word-wrap into at most `maxLines` lines of roughly `maxChars`
// characters each, ellipsizing if the text still doesn't fit.
function wrapText(text, maxChars, maxLines) {
  const words = text.split(' ');
  const allLines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      allLines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) allLines.push(current);

  if (allLines.length <= maxLines) return allLines;

  const lines = allLines.slice(0, maxLines);
  const last = lines[maxLines - 1].replace(/[.,;: ]+$/, '');
  lines[maxLines - 1] = last.replace(/.{1,3}$/, '') + '…';
  return lines;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

// A handful of dot-grid points used as a subtle background texture, kept
// deterministic (no Math.random) so output is stable and cacheable.
function dotGrid() {
  let dots = '';
  for (let y = 60; y < HEIGHT - 40; y += 42) {
    for (let x = 640; x < WIDTH - 40; x += 42) {
      dots += `<circle cx="${x}" cy="${y}" r="1.4" fill="rgba(255,255,255,0.07)"/>`;
    }
  }
  return dots;
}

/**
 * @param {object} opts
 * @param {string} [opts.code] - referral / invite code to display. Absent for the generic default card.
 * @param {string} [opts.headline] - main headline text.
 * @param {string} [opts.subhead] - supporting line under the headline.
 * @param {string} [opts.eyebrow] - small label above the headline (e.g. "YOU'RE INVITED").
 */
function buildCardSvg(opts = {}) {
  const {
    code,
    headline = 'Learn anything faster',
    subhead = 'Feynman-style AI tutoring, adaptive quizzes, and streaks that actually stick.',
    eyebrow = code ? "YOU'RE INVITED" : 'AI STUDY COACH',
  } = opts;

  const codeBlock = code
    ? `
    <g transform="translate(80, 486)">
      <rect width="360" height="76" rx="18" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.22)" stroke-width="1.5"/>
      <text x="24" y="30" font-family="Inter" font-weight="600" font-size="12" letter-spacing="2" fill="rgba(255,255,255,0.68)">INVITE CODE</text>
      <text x="24" y="58" font-family="Inter" font-weight="800" font-size="26" fill="#FFFFFF">${escapeXml(code)}</text>
    </g>`
    : '';

  const ctaX = code ? 460 : 80;
  const ctaText = code ? 'Download Isarion to accept →' : 'Download Isarion free →';

  return `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#05060A"/>
      <stop offset="42%" stop-color="#151E42"/>
      <stop offset="78%" stop-color="#3730A3"/>
      <stop offset="100%" stop-color="#F97316"/>
    </linearGradient>
    <radialGradient id="glow" cx="82%" cy="12%" r="55%">
      <stop offset="0%" stop-color="rgba(249,115,22,0.55)"/>
      <stop offset="100%" stop-color="rgba(249,115,22,0)"/>
    </radialGradient>
    <linearGradient id="iconGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#F97316"/>
    </linearGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  ${dotGrid()}

  <!-- brand row -->
  <g transform="translate(80, 64)">
    <rect width="44" height="44" rx="14" fill="#FFFFFF"/>
    <g transform="translate(-10,-6) scale(0.6)">
      <path d="M32,66 C38,60 42,58 48,52 C54,46 58,42 61,38" fill="none" stroke="#8A8FAE" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>
      <circle cx="32" cy="66" r="4" fill="#4B5170"/>
      <circle cx="48" cy="52" r="5.2" fill="#C7CBE0"/>
      <polygon points="66,25 68.12,31.88 75,34 68.12,36.12 66,43 63.88,36.12 57,34 63.88,31.88" fill="url(#iconGrad)"/>
    </g>
    <text x="60" y="20" font-family="Inter" font-weight="800" font-size="22" fill="#FFFFFF">ISARION</text>
    <text x="60" y="38" font-family="Inter" font-weight="500" font-size="13" letter-spacing="2" fill="rgba(255,255,255,0.6)">AI STUDY COACH</text>
  </g>

  <!-- headline block -->
  <g transform="translate(80, 200)">
    <text x="0" y="0" font-family="Inter" font-weight="700" font-size="14" letter-spacing="3" fill="rgba(255,255,255,0.75)">${escapeXml(eyebrow)}</text>
    <text x="0" y="60" font-family="Inter" font-weight="800" font-size="56" fill="#FFFFFF">${escapeXml(headline)}</text>
    <text x="0" y="112" font-family="Inter" font-weight="500" font-size="21" fill="rgba(255,255,255,0.82)">
      ${wrapText(subhead, 46, 2)
        .map((line, i) => `<tspan x="0" dy="${i === 0 ? 0 : 30}">${escapeXml(line)}</tspan>`)
        .join('')}
    </text>
  </g>

  <!-- icon motif, right side -->
  <g transform="translate(900, 90)" opacity="0.95">
    <circle cx="120" cy="120" r="150" fill="rgba(255,255,255,0.06)"/>
    <circle cx="120" cy="120" r="104" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
    <path d="M120 62 L138 104 L182 104 L146 130 L160 174 L120 148 L80 174 L94 130 L58 104 L102 104 Z" fill="url(#iconGrad)"/>
  </g>

  ${codeBlock}

  <!-- CTA -->
  <g transform="translate(${ctaX}, 486)">
    <rect width="${code ? 360 : 420}" height="76" rx="18" fill="#FFFFFF"/>
    <text x="${(code ? 360 : 420) / 2}" y="46" font-family="Inter" font-weight="700" font-size="20" fill="#151E42" text-anchor="middle">${escapeXml(ctaText)}</text>
  </g>

  <text x="80" y="600" font-family="Inter" font-weight="500" font-size="14" fill="rgba(255,255,255,0.55)">wabix2.github.io/Launchpad · study smarter, every day</text>
</svg>`;
}

function renderCardPng(opts = {}) {
  const svg = buildCardSvg(opts);
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: WIDTH },
    font: FONT_FILES.length
      ? { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Inter' }
      : { loadSystemFonts: true },
  });
  return resvg.render().asPng();
}

// Small in-memory cache: the card is a pure function of its inputs, so we
// don't need to pay the SVG-parse + rasterize cost on every social-preview
// crawler hit. Capped so it can't grow unbounded from crawled junk codes.
const cache = new Map();
const CACHE_LIMIT = 500;

function renderCardPngCached(opts = {}) {
  const key = JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const png = renderCardPng(opts);
  if (cache.size >= CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, png);
  return png;
}

module.exports = { buildCardSvg, renderCardPng, renderCardPngCached };
