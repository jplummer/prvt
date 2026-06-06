import { QRCODE_SRC } from './qrcode-src.js';

export function renderForm(token) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>prvt</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0f0f11;
  --surface: #1a1a1f;
  --border: #2a2a32;
  --accent: #d53f23;
  --text: #e8e8f0;
  --text-muted: #6b6b80;
  --text-dim: #9999aa;
  --success: #fbdf71;
  --radius: 10px;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.stack {
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
}
.panel-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  margin-bottom: 14px;
}
input[type="text"] {
  width: 100%;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--text);
  font-size: 13px;
  padding: 10px 12px;
  margin-bottom: 10px;
  outline: none;
}
input[type="text"]:focus { border-color: var(--accent); }
.form-row { display: flex; gap: 8px; }
select {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--text);
  font-size: 12px;
  padding: 9px 12px;
  outline: none;
  cursor: pointer;
}
button {
  flex: 1;
  background: var(--accent);
  border: none;
  border-radius: 7px;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  padding: 9px 16px;
  cursor: pointer;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
.result-inner { display: flex; gap: 16px; align-items: flex-start; }
#qr-display svg { width: 96px; height: 96px; border-radius: 6px; display: block; }
.result-meta { flex: 1; min-width: 0; }
.short-url {
  color: var(--success);
  font-family: monospace;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.03em;
  margin-bottom: 4px;
  word-break: break-all;
}
.expiry { color: var(--text-muted); font-size: 11px; margin-bottom: 14px; }
.btn-row { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-sm {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 11px;
  font-weight: 500;
  padding: 7px 12px;
  cursor: pointer;
}
.error { color: #f87171; font-size: 12px; margin-top: 8px; }
.about-body { color: var(--text-dim); font-size: 12px; line-height: 1.65; margin-bottom: 12px; }
.about-body strong { color: var(--text); }
.about-link { color: var(--accent); font-size: 12px; font-weight: 500; text-decoration: none; }
#result { display: none; }
</style>
</head>
<body>
<div class="stack">

  <div class="panel">
    <div class="panel-label">Paste a URL to shorten</div>
    <input type="text" id="url" placeholder="https://..." autocomplete="off" spellcheck="false">
    <div class="form-row">
      <select id="ttl">
        <option value="86400">1 day</option>
        <option value="259200">3 days</option>
        <option value="604800">1 week</option>
        <option value="1209600" selected>2 weeks (default)</option>
        <option value="2592000">1 month</option>
        <option value="5184000">2 months</option>
        <option value="7776000">1 quarter</option>
        <option value="15552000">6 months</option>
      </select>
      <button id="gen-btn" onclick="generate()">Shorten &amp; Generate QR</button>
    </div>
    <div id="error" class="error"></div>
  </div>

  <div class="panel" id="result">
    <div class="panel-label">Your link</div>
    <div class="result-inner">
      <div id="qr-display"></div>
      <div class="result-meta">
        <div class="short-url" id="short-url"></div>
        <div class="expiry" id="expiry"></div>
        <div class="btn-row">
          <button class="btn-sm" onclick="copyUrl(this)">Copy URL</button>
          <button class="btn-sm" onclick="downloadSvg()">&#8595; SVG</button>
          <button class="btn-sm" onclick="downloadPng()">&#8595; PNG</button>
        </div>
      </div>
    </div>
  </div>

  <div class="panel">
    <div class="panel-label">About</div>
    <p class="about-body"><strong>prvt</strong> generates short links that self-destruct. Scan a QR code, follow a link — the destination stays private and the link disappears when its time is up.</p>
    <p class="about-body">No click tracking. No analytics. No third-party visibility into where your links go or who follows them. Public URL shorteners are surveillance businesses. This one isn't.</p>
    <a class="about-link" href="https://codeberg.org/nooble/prvt" target="_blank" rel="noopener noreferrer">Run your own instance &#8599;</a>
  </div>

</div>
<script>${QRCODE_SRC}</script>
<script>
const FORM_TOKEN = ${JSON.stringify(token)};
let currentSlug = '';
let svgString = '';
let pngDataUrl = '';

async function generate() {
  const url = document.getElementById('url').value.trim();
  const ttl = parseInt(document.getElementById('ttl').value, 10);
  const errEl = document.getElementById('error');
  const btn = document.getElementById('gen-btn');

  errEl.textContent = '';
  if (!url.startsWith('https://') && !url.startsWith('http://')) {
    errEl.textContent = 'URL must start with http:// or https://';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Working…';

  try {
    const resp = await fetch('/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ttl, token: FORM_TOKEN }),
    });

    if (!resp.ok) {
      errEl.textContent = await resp.text();
      return;
    }

    const { slug, short, expires } = await resp.json();
    currentSlug = slug;

    // Generate SVG for display
    svgString = await QRCode.toString(short, { type: 'svg', errorCorrectionLevel: 'L', margin: 1 });
    document.getElementById('qr-display').innerHTML = svgString;

    // Generate PNG for download (off-screen canvas)
    const canvas = document.createElement('canvas');
    await QRCode.toCanvas(canvas, short, { errorCorrectionLevel: 'L', width: 512, margin: 1 });
    pngDataUrl = canvas.toDataURL('image/png');

    document.getElementById('short-url').textContent = short;
    document.getElementById('expiry').textContent = formatExpiry(expires);
    document.getElementById('result').style.display = 'block';
    document.getElementById('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (e) {
    errEl.textContent = 'Something went wrong. Try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Shorten & Generate QR';
  }
}

function formatExpiry(iso) {
  const diff = new Date(iso) - Date.now();
  if (diff <= 0) return 'Expires soon';
  const days = Math.round(diff / 86400000);
  if (days < 1) return 'Expires today';
  if (days === 1) return 'Expires in 1 day';
  if (days < 7) return 'Expires in ' + days + ' days';
  const weeks = Math.round(days / 7);
  return 'Expires in ' + weeks + ' week' + (weeks > 1 ? 's' : '');
}

function copyUrl(btn) {
  navigator.clipboard.writeText(document.getElementById('short-url').textContent)
    .then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy URL'; }, 1500);
    })
    .catch(() => {
      btn.textContent = 'Copy failed';
      setTimeout(() => { btn.textContent = 'Copy URL'; }, 1500);
    });
}

function downloadSvg() {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  trigger(url, 'qr-' + currentSlug + '.svg');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadPng() {
  trigger(pngDataUrl, 'qr-' + currentSlug + '.png');
}

function trigger(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

document.getElementById('url').addEventListener('keydown', e => {
  if (e.key === 'Enter') generate();
});
</script>
</body>
</html>`;
}
