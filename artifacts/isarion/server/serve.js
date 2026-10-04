/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with several special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 *   (used by Expo Go during development/preview)
 * - GET /                                        → real marketing/download
 *   landing page (not the Expo Go "scan to preview" screen — see below)
 * - GET /invite/:code                             → branded invite page
 * - GET /invite/:code/card.png, /invite-card.png  → dynamic OG/share card
 * Everything else falls through to static file serving from ./static-build/.
 *
 * `GITHUB_RELEASE_URL` points the primary download button (and the QR code)
 * at a GitHub Releases asset — e.g.
 * `https://github.com/<org>/<repo>/releases/latest/download/lumiq-ai.apk`.
 * Until it's set, the page shows an honest "coming soon" state instead of a
 * dead or misleading link.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { renderCardPngCached } = require('./lib/ogCard');

const STATIC_ROOT = path.resolve(__dirname, '..', 'static-build');
const TEMPLATE_PATH = path.resolve(__dirname, 'templates', 'landing-page.html');
const basePath = (process.env.BASE_PATH || '/').replace(/\/+$/, '');
const GITHUB_RELEASE_URL = (process.env.GITHUB_RELEASE_URL || '').trim();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, '..', 'app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf-8'));
    return appJson.expo?.name || 'App Landing Page';
  } catch {
    return 'App Landing Page';
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, 'utf-8');
  res.writeHead(200, {
    'content-type': 'application/json',
    'expo-protocol-version': '1',
    'expo-sfv-version': '0',
  });
  res.end(manifest);
}

function requestBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers['host'];
  return { baseUrl: `${protocol}://${host}`, host };
}

/**
 * Fills in the shared template placeholders. `extraHead` / `extraBody` let
 * a specific route (e.g. the invite page) inject page-specific <meta> tags
 * and CTA markup without duplicating the whole template.
 */
function renderTemplate(landingPageTemplate, { baseUrl, expsUrl, appName, extraHead = '', extraBody = '' }) {
  const downloadReady = Boolean(GITHUB_RELEASE_URL);
  const downloadHref = downloadReady ? GITHUB_RELEASE_URL : '#';
  const downloadLabel = downloadReady ? 'Download for Android' : 'Download coming soon';

  return landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName)
    .replace(/DOWNLOAD_HREF_PLACEHOLDER/g, escapeHtml(downloadHref))
    .replace(/DOWNLOAD_LABEL_PLACEHOLDER/g, escapeHtml(downloadLabel))
    .replace(/DOWNLOAD_READY_PLACEHOLDER/g, downloadReady ? 'true' : 'false')
    .replace('</head>', `${extraHead}</head>`)
    .replace('INVITE_BANNER_PLACEHOLDER', extraBody);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const { baseUrl, host } = requestBaseUrl(req);
  const html = renderTemplate(landingPageTemplate, { baseUrl, expsUrl: host, appName });
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}

function serveInvitePage(req, res, landingPageTemplate, appName, referralCode) {
  const { baseUrl, host } = requestBaseUrl(req);
  const safeCode = escapeHtml(referralCode);
  const inviteUrl = `${baseUrl}/invite/${encodeURIComponent(referralCode)}`;
  const deepLink = `lumiq-ai://onboarding?ref=${encodeURIComponent(referralCode)}`;
  const cardUrl = `${baseUrl}/invite/${encodeURIComponent(referralCode)}/card.png`;

  const extraHead = `
    <meta name="description" content="Join Isarion and turn small daily study sessions into a streak." />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="A friend invited you to Isarion" />
    <meta property="og:description" content="Learn anything faster with Feynman tutoring, adaptive quizzes, and streaks." />
    <meta property="og:url" content="${escapeHtml(inviteUrl)}" />
    <meta property="og:image" content="${escapeHtml(cardUrl)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="A friend invited you to Isarion" />
    <meta name="twitter:description" content="Join your friend on Isarion and start a winning study streak." />
    <meta name="twitter:image" content="${escapeHtml(cardUrl)}" />
  `;

  const extraBody = `
    <div class="invite-banner">
      <img src="${escapeHtml(cardUrl)}" alt="You were invited to Isarion" class="invite-card-img" />
      <div class="invite-copy">
        <strong>You were invited to Isarion</strong>
        <p>Invite code: <span class="invite-code">${safeCode}</span></p>
      </div>
      <a href="${escapeHtml(deepLink)}" class="invite-open-btn">Open in Isarion</a>
    </div>
  `;

  const html = renderTemplate(landingPageTemplate, {
    baseUrl,
    expsUrl: host,
    appName,
    extraHead,
    extraBody,
  });

  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}

function serveOgCard(res, opts) {
  try {
    const png = renderCardPngCached(opts);
    res.writeHead(200, {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=3600',
    });
    res.end(png);
  } catch (err) {
    console.error('Failed to render share card:', err);
    // Fall back to the static app icon so a render bug never breaks the
    // social preview entirely — a plain icon still beats a broken image.
    const imagePath = path.resolve(__dirname, '..', 'assets', 'images', 'icon.png');
    if (fs.existsSync(imagePath)) {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(fs.readFileSync(imagePath));
    } else {
      res.writeHead(500);
      res.end('card render failed');
    }
  }
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'content-type': contentType });
  res.end(content);
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
const appName = getAppName();

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || '/';
  }

  if (pathname === '/' || pathname === '/manifest') {
    const platform = req.headers['expo-platform'];
    if (platform === 'ios' || platform === 'android') {
      return serveManifest(platform, res);
    }

    if (pathname === '/') {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  if (pathname === '/invite-card.png') {
    const code = url.searchParams.get('code');
    return serveOgCard(res, code ? { code: code.toUpperCase() } : {});
  }

  const inviteCardMatch = pathname.match(/^\/invite\/([A-Za-z0-9-]+)\/card\.png$/);
  if (inviteCardMatch) {
    return serveOgCard(res, { code: inviteCardMatch[1].toUpperCase() });
  }

  const inviteMatch = pathname.match(/^\/invite\/([A-Za-z0-9-]+)$/);
  if (inviteMatch) {
    return serveInvitePage(req, res, landingPageTemplate, appName, inviteMatch[1].toUpperCase());
  }

  serveStaticFile(pathname, res);
});

const port = parseInt(process.env.PORT || '3000', 10);
server.listen(port, '0.0.0.0', () => {
  console.log(`Serving static Expo build on port ${port}`);
  if (!GITHUB_RELEASE_URL) {
    console.warn(
      'GITHUB_RELEASE_URL is not set — the landing page download button will show "coming soon" until it is configured.',
    );
  }
});
