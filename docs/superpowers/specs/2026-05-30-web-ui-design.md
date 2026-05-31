# prvt Web UI — Design Spec

## What we're building

A hosted form at `prvt.pw/go/FORM_TOKEN` that lets a small trusted group create self-expiring short links and download QR codes — without anyone in the group needing to know the admin secret.

---

## Access model

Two credentials, separate concerns:

| Credential | Who holds it | Used for |
|---|---|---|
| `ADMIN_SECRET` | Admin only | `POST /create` — direct API access, never in any UI |
| `FORM_TOKEN` | Shared with the group | URL token that unlocks the form; `POST /shorten` validation |

The group receives one bookmarked URL: `https://prvt.pw/go/FORM_TOKEN`. That URL is their only onboarding. If the token is ever compromised, the admin runs `wrangler secret put FORM_TOKEN` and shares a new URL.

Bare `prvt.pw` returns 404. No form is visible to anyone without the token URL.

---

## New Worker endpoints

### `GET /go/:token`
- If `token === env.FORM_TOKEN`: serve the form HTML with `Content-Type: text/html`
- Otherwise: `404`
- The HTML contains the form token in a hidden field so `POST /shorten` can validate it
- `ADMIN_SECRET` never appears anywhere in the HTML

### `POST /shorten`
Accepts JSON: `{ url, ttl, token }`
- Validate `token === env.FORM_TOKEN` — return `401` if wrong
- Validate `url` starts with `https://` — return `400` if not
- Generate slug (reuse existing `makeSlug`), write to `LINKS` KV + `COOLOFF` KV
- Return `{ slug, short, expires }` — same shape as `/create`

Existing `GET /:slug` and `POST /create` are unchanged.

---

## Form UI

Single HTML document, embedded as a string in the Worker. No external dependencies — the `qrcode` library (MIT) is bundled inline.

### Layout (approved)

```
┌─────────────────────────────┐
│  Form panel                 │
│  URL input                  │
│  TTL picker | Generate btn  │
└─────────────────────────────┘
┌─────────────────────────────┐  (hidden until result arrives)
│  Result panel               │
│  [QR]  HTTPS://PRVT.PW/AB3X │
│        Expires in 24 hours  │
│        Copy · ↓SVG · ↓PNG   │
└─────────────────────────────┘
┌─────────────────────────────┐
│  About panel                │
│  Copy (approved below)      │
│  Run your own instance ↗    │
└─────────────────────────────┘
```

### TTL options
1 day / 3 days / 1 week (default) / 2 weeks / 4 weeks — the default option is labeled `1 week (default)` in the dropdown text, no other marker

Expressed as seconds for the API: 86400 / 259200 / 604800 / 1209600 / 2419200

### QR generation
- Library: `qrcode` (MIT), bundled inline — no CDN calls. The minified source (`node_modules/qrcode/build/qrcode.min.js`) is read at build time and interpolated into the HTML template string inside the Worker. Running `npm install` in `worker/` provides it.
- Error correction: Level L (smallest output)
- Input to library: uppercase short URL (`HTTPS://PRVT.PW/AB3X`) — keeps QR in alphanumeric encoding mode, ~40% smaller than byte mode
- On-screen display: SVG rendered into a container div
- Download SVG: serialize the SVG element, trigger file download as `qr-AB3X.svg`
- Download PNG: render QR to an off-screen `<canvas>`, call `canvas.toDataURL('image/png')`, trigger download as `qr-AB3X.png`

### Form token handling
- The form token is embedded as a JS variable in the served HTML: `const FORM_TOKEN = "..."`
- Included in every `POST /shorten` request body
- Not shown in any visible UI element

### Visual style
- Dark theme matching existing `qr-generator.html` color palette
- Three stacked panels separated by `12px` gap
- Max width `480px`, centered

---

## About copy (approved)

> **prvt** generates short links that self-destruct. Scan a QR code, follow a link — the destination stays private and the link disappears when its time is up.
>
> No click tracking. No analytics. No third-party visibility into where your links go or who follows them. Public URL shorteners are surveillance businesses. This one isn't.
>
> [Run your own instance ↗](placeholder — repo URL to be added when published)

---

## Files to modify

| File | Change |
|---|---|
| `worker/src/index.js` | Add `GET /go/:token` and `POST /shorten` handlers; embed form HTML |
| `worker/wrangler.toml.example` | Add `FORM_TOKEN` placeholder to env vars section |

The form HTML will be defined as a template literal function in `index.js` — it takes the form token as an argument and returns the complete HTML string.

---

## Deferred

- Accent color borrowed from eugenetogetherstrong.org — to be added once a hex value is identified and approved

---

## What this does not include

- Any admin UI for managing or listing links
- Ability for group members to delete or list links they've created
- Rate limiting on `/shorten` (deferred to Phase 7 Cloudflare WAF rules)
- The `qrcode` library source (to be fetched from npm at build time or copied from `node_modules`)
