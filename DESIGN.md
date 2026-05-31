# prvt — Privacy-Respecting URL Shortener

## Context & Motivation

Short URLs make QR codes significantly more compact, which matters for print and physical reproduction. Public URL shorteners (bit.ly, tinyurl, etc.) are surveillance businesses — their product is the click data. For audiences that are politically sensitized to tracking and surveillance capitalism, that's a non-starter.

This project is a self-hosted, ephemeral URL shortener with auto-expiring entries and no third-party data exposure.

---

## Stack Decision

**Cloudflare Workers + KV** is the right fit:

- Workers handles redirect logic (~30 lines of JS)
- KV stores slug → URL mappings with **native TTL support** — entries auto-delete at expiry, no cron jobs or cleanup needed
- Free tier: 100k requests/day, 1k KV writes/day — more than enough
- Domain cost is the only real expense
- Cloudflare's threat model is fundamentally different from a commercial link-shortener: they're not in the business of monetizing click graphs

---

## Domain Strategy

Target: shortest possible domain + path, ideally ≤10 chars total (e.g. `GO.IS/AB3X`).

| Pattern | Example | Est. cost/yr |
|---|---|---|
| 2-char + `.co` | `qr.co` | ~$30–60 |
| 2-char + `.is` (Iceland) | `go.is` | ~$35 |
| 2-char + `.gl` (Greenland) | `ab.gl` | varies |
| 2-char + `.co.uk` | `go.co.uk` | ~$10 |
| 3-char + `.xyz` | `get.xyz` | ~$1–10 |

2-char `.com` is not realistically available at reasonable prices. A 2-char ccTLD is the sweet spot.

**Action:** Browse availability at Cloudflare Registrar or Porkbun before committing — ccTLD availability is unpredictable.

---

## Critical QR Encoding Insight

QR codes support multiple encoding modes:

- **Numeric**: digits only — most compact
- **Alphanumeric**: digits + uppercase A–Z + `$%*+-./:` — ~40% more efficient than byte mode
- **Byte**: arbitrary characters including lowercase — least compact

A URL using only uppercase letters stays in alphanumeric mode throughout. `HTTPS://GO.IS/AB3X` produces a measurably smaller QR code than `https://go.is/ab3x`.

**Therefore:** generate slugs using only uppercase alphanumeric characters. The slug generator should pull from `[A-Z0-9]` only.

---

## Architecture

```
[Admin UI or CLI]
      |
      | POST /create  { url, ttl }
      v
[Cloudflare Worker]
      |
      | put(slug, url, { expirationTtl: ttl })
      v
[Cloudflare KV]
      |
      | GET /:slug  → 301 redirect
      v
[User's browser]
```

### Worker responsibilities
1. `GET /:slug` — look up slug in KV, return 301 if found, 404 if expired or missing
2. `POST /create` — accept `{ url, ttl }`, generate slug, write to KV, return short URL
3. Auth on `/create` — at minimum a shared secret in a header (env var)

### Slug generation
- 4 chars from `[A-Z0-9]` = 36^4 = ~1.7M combinations — plenty
- 3 chars = 46,656 — workable for low-volume use
- Start at 4, add a collision retry loop

### TTL options to expose
- 1 hour, 24 hours, 7 days, 30 days, custom
- After expiry, KV silently drops the key — no trace, no redirect, clean 404

---

## Implementation Plan

### Phase 1: Worker + KV
- [ ] Create Cloudflare account / confirm existing
- [ ] Create KV namespace `LINKS`
- [ ] Scaffold Worker with Wrangler CLI
- [ ] Implement redirect handler (`GET /:slug`)
- [ ] Implement creation endpoint (`POST /create`) with shared-secret auth
- [ ] Deploy, smoke test

### Phase 2: Domain
- [ ] Find and register short domain (see table above)
- [ ] Point domain to Worker via Cloudflare DNS (trivial since both are CF)
- [ ] Confirm HTTPS works end-to-end

### Phase 3: Admin interface
Options in roughly increasing complexity:
- **CLI script** — `node create.js https://long-url.com --ttl 24h` — simplest, good enough
- **Minimal web UI** — hosted on the same Worker or a Pages site, with the shared secret in a bookmark/env
- **Integration into the QR generator tool** — POST to the shortener directly from the QR app before encoding

### Phase 4: QR integration (optional)
Modify the SVG QR generator (already built) to:
- Accept a long URL
- POST to `/create` on the shortener
- Encode the returned short URL
- Output uppercase slug to stay in QR alphanumeric mode

---

## Security Notes

- The `/create` endpoint must be authenticated — even a static bearer token in an env var is fine for personal/org use
- Consider rate limiting on the Worker (CF has this built in)
- Logs: Cloudflare Workers logs requests by default — turn off or filter if that matters; Workers Logpush can be disabled
- KV is eventually consistent — fine for this use case
- No analytics, no click counting, no referrer logging — by design

---

## Open Questions

- What domain? (needs availability research)
- Single-tenant (personal) or shared across an org?
- Should the admin UI be web-based or CLI-only?
- Desired default TTL for campaigns vs. one-off links?

---

## References

- Cloudflare Workers docs: https://developers.cloudflare.com/workers/
- KV TTL / expiration: https://developers.cloudflare.com/kv/api/write-key-value-pairs/#expiring-keys
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- QR encoding modes (for the alphanumeric insight): https://www.qrcode.com/en/about/version.html
- Existing QR generator: see sibling chat / artifact `qr-generator.html`

---

## License

**AGPL v3.** See reasoning and alternatives below.

### Why not MIT

MIT was the initial instinct but is the wrong choice here. It is maximally permissive: anyone can take the code, modify it, close-source it, and sell it as a commercial service — with zero obligation to publish what they changed or even acknowledge the original. That is the opposite of what this project needs. Activists using a tool to protect their privacy deserve to know that the hosted version they're trusting is actually running the code they can read.

### The core tension

The OSI definition of "open source" explicitly prohibits licenses from restricting commercial use or discriminating against fields of endeavor. This means **"open source + non-commercial" is a strict contradiction.** Any license that prohibits commercial use is, by definition, not OSI-certified open source. The options below navigate this tradeoff differently.

---

### Option A — AGPL v3 ✓ Recommended

The GNU Affero General Public License closes the loophole that GPL misses: if you run modified AGPL software **as a network service**, you must publish your full modified source to users of that service. This is critical for server-side software like a URL shortener — a regular GPL'd tool can be modified and run as a SaaS with no disclosure obligation; AGPL cannot.

**What it does:**
- Anyone can run it, modify it, self-host it
- Any hosted/modified version must publish its complete source
- Makes commercial exploitation deeply unattractive (you'd have to open-source your entire modifications)
- Does not technically *prohibit* commercial use — but creates strong disincentives

**Why it's right for this project:**
- Battle-tested and widely understood in security and activist communities
- OSI-certified — no ambiguity or legal novelty for cautious users
- Used by Signal (GPL), Briar (GPL), Wire (GPL), Tor-adjacent tooling
- Activists can audit the published source and verify it matches what's running
- A README statement of intent covers the political gap: *"This software is published for activist, nonprofit, and personal use. Commercial deployment is contrary to its purpose."*

**Dependency note:** AGPL v3 requires that dependencies be compatible. The `qrcode` npm library is MIT ✓ — MIT is compatible with AGPL. Verify any new dependency before adding it.

---

### Option B — PolyForm Noncommercial 1.0

Explicitly prohibits commercial use in plain language. Source is visible and freely usable by individuals, nonprofits, and activists. Simple and readable.

**Tradeoffs:**
- Not OSI-certified — technically "source available," not "open source"
- For most activists, auditability matters more than the OSI label — this may be fine
- Less widely recognized; may cause hesitation among legally cautious contributors
- Provides a cleaner non-commercial guarantee than AGPL

Worth considering if "cannot be commercialized" is a hard requirement and the OSI distinction doesn't matter to the intended audience.

---

### Option C — Anti-Capitalist Software License (ACSL)

Written explicitly for this politics. Permits use only by individuals, nonprofits, cooperatives, and mutual aid organizations. Prohibits use by for-profit corporations by design.

**Tradeoffs:**
- Very niche — most developers and legal reviewers have never seen it
- May create confusion or FUD among technically cautious users unfamiliar with it
- Not OSI-certified, not widely legally tested
- The politics are legible but the license itself introduces friction
- Could actually undermine trust by being unfamiliar

Not recommended for a tool intended for wide activist adoption.

---

### Decision

**AGPL v3**, paired with a clear README preamble stating the project's intent and values. The license provides the legal structure; the README provides the political context. This is the approach used by most serious privacy and security projects and will be immediately legible and trustworthy to the communities this tool is meant to serve.

---

## Design Principles

### 1. Minimal PII infrastructure

The goal is to touch as little personally-identifiable data as possible — ideally none:

- No user accounts, no sign-up, no email addresses
- No IP address logging (Cloudflare Workers receives IPs but we don't write them anywhere)
- No tracking of who created which link or when
- No analytics, no dashboard, no click counts — if you want to know if your link was used, check whether it still resolves
- Auth is a single shared secret (env var), not an identity system

### 2. Maximum simplicity of setup

- One `wrangler deploy` should get the Worker live
- KV namespace creation is a one-liner
- A `.env.example` file covers all required config
- No database, no server, no Docker, no migrations
- Ideally: clone repo → fill in `.env` → deploy → done

### 3. Open source and auditable

MIT license means anyone using this tool can read exactly what it does with their data. No black boxes. No obfuscated dependencies.

---

## Privacy Design

### Pre-built slug space

Slugs are drawn from a **pre-shuffled pool** rather than generated sequentially or derived from the destination URL. This means:

- You cannot enumerate valid slugs by guessing neighbors
- The slug encodes zero information about the destination
- A sequentially-assigned shortener leaks volume and timing; this one doesn't

Implementation: shuffle a large alphanumeric keyspace deterministically (seeded), maintain a pointer into it via KV. Or generate cryptographically random slugs and retry on collision (simpler, nearly equivalent in practice at low volume).

### No referrer leakage

When the Worker issues a redirect, it must set:

```
Referrer-Policy: no-referrer
```

Without this, the destination server's access log will show `go.yourshortdomain/AB3X` as the referrer — a meaningful privacy leak. With it, the destination sees no referrer at all.

### Use 302, not 301

301 redirects are cached by browsers. A user who clicked an expired link before it died might silently land on the old destination from browser cache. Use **302** (or 307) so every click goes through the Worker and respects the TTL.

### Self-destructing links

TTL is set at creation time by the user. Cloudflare KV's native expiration handles deletion — no cron, no trace, no residual record. Options to expose:

- 1 hour, 6 hours, 24 hours, 7 days, 30 days, custom
- Default should be short — suggest 24 hours as a reasonable default
- After expiry, the slug returns 404. The KV entry is gone. The Worker has no memory of it.

### Slug cooling-off and reuse

After a slug expires, it should not be immediately reused — a reused slug could theoretically cause someone who bookmarked or cached the old URL to land somewhere unexpected. Suggested approach:

- Maintain a `cooling-off` set in KV with its own TTL (e.g., 90 days)
- Only draw from slugs not in cooling-off
- After the cooling-off entry expires, the slug is silently returned to the pool

### No cookies

The redirect Worker sets no cookies. Period. No session, no analytics pixel, no consent banner — there is nothing to consent to.

### No memory of origin

The Worker does not log, store, or forward the request's `User-Agent`, `Accept-Language`, `X-Forwarded-For`, or any other fingerprinting header. It reads the slug, looks it up, and redirects. That's it.

### Additional ideas to consider

- **Vanity slugs off by default** — user-chosen slugs make enumeration easier; if supported, add a rate limit and require auth
- **No preview page** — some shorteners show a "you're being redirected to X" interstitial; skip it, it just logs an extra pageview and reveals the destination URL in the UI
- **Strip UTM parameters from destination URLs at creation time** (optional, user-controlled) — if the long URL contains `?utm_source=...`, offer to strip those before shortening
- **No favicon fetching** — some shorteners fetch the destination favicon; don't, it creates a request log entry at the destination
- **HTTPS-only** — refuse to shorten or redirect to `http://` URLs
- **Public suffix check** — refuse to shorten links to known tracking domains (bit.ly shortening another bit.ly link, etc.) — optional but elegant
- **No admin UI in production** — the creation endpoint is API-only; any management UI is local-only or omitted entirely

---

## Convenience Design

The UX goal: **one input, one operation, everything you need comes out.**

### CLI (primary interface)

```
prvt https://some-very-long-url.com/path?with=params --ttl 24h
```

Output:
```
Short URL:  HTTPS://GO.XY/AB3X
QR Code:    ./qr_AB3X.svg   (saved to current directory)
Expires:    2026-05-17 14:32 UTC
```

The CLI:
- Calls the Worker's `/create` endpoint
- Receives the slug
- Generates the QR SVG locally using the `qrcode` (MIT) library
- Prints the short URL in uppercase (alphanumeric QR mode)
- Saves the SVG
- Requires no browser, no GUI

### Web UI (secondary interface)

A single-page app (no framework, vanilla JS + the `qrcode` MIT library):
- Paste long URL
- Pick TTL from a dropdown
- Click one button
- See: short URL (copyable), QR code (downloadable SVG), expiry time
- No external scripts, no CDN calls in production (bundle everything)
- Can be hosted on Cloudflare Pages alongside the Worker, or not hosted at all — just opened as a local HTML file

### Library dependencies (must be MIT)

| Purpose | Library | License |
|---|---|---|
| QR code generation | `qrcode` | MIT ✓ (compatible with AGPL v3) |
| CLI arg parsing | `minimist` or `parseArgs` (built-in Node 18+) | MIT / built-in |
| HTTP requests (CLI) | `fetch` (built-in Node 18+) | built-in |
| Worker runtime | Cloudflare Workers (platform, not a dep) | — |

No build step if avoidable. No bundler required for the Worker if it stays small.


---

## Repo Hosting: GitHub vs Alternatives

### Is there such a thing as an anonymous public repo?

Short answer: **no, not truly.** Any public repo host requires an account, and any account leaves a trail — IP logs, registration email, legal jurisdiction. What you can do is *pseudonymous*, and the platform you choose determines how much that matters.

On **GitHub (Microsoft)**: registration requires an email but not a real name. However, GitHub collects substantial user data, integrates tightly with Microsoft's ecosystem, complies with US legal requests, and — relevant here — has used hosted code to train Copilot. For a privacy tool aimed at activists, this is an uncomfortable fit both practically and symbolically.

On **Codeberg**: a German nonprofit (Codeberg e.V.), run by its community, built on Forgejo (itself fully open source). No ads, no tracking, no third-party cookies, no data sales, no AI training on your code. Hosted in the EU under German law — not subject to US DMCA takedowns in the same way GitHub is. Accepts pseudonymous registration with any email address. The platform's explicit mission is to be a "safe and friendly home" for free and open source software. For a privacy tool aimed at activists, hosting on Codeberg is itself a values statement.

### Recommendation: Codeberg, pseudonymous account

Register with a handle unconnected to your personal identity and a private/masked email (iCloud's Hide My Email, SimpleLogin, or similar). You don't need to be anonymous — you need to be *appropriately pseudonymous for the project's context.* The code is public and auditable; that's the point. Who wrote it is a separate question.

You don't need to put on your man pants and publish it under your personal GitHub account. You need to make a considered decision about what name this project wears in the world, and Codeberg gives you a better home for that decision than GitHub does.

### Discoverability tradeoff

Codeberg has a smaller audience than GitHub. If activist communities finding this tool organically matters, a mirror on GitHub (pointing to Codeberg as canonical) is a reasonable hedge. That's a later decision.

---

## Questions to Answer Before Starting

Resolve these before the first Claude Code session. Some block everything downstream; others can wait.

**Blocking — answer first:**
1. **Domain.** What short domain will you register? Research availability on Cloudflare Registrar or Porkbun before committing. Target: 2-char SLD + short ccTLD (see domain table above). Have a backup in mind.
2. **Cloudflare account.** Do you have one, or are you creating one? If creating, use an email not linked to your personal identity if that matters to you.
3. **Codeberg handle.** What name does this project wear? Personal handle, a new pseudonymous one, or a project org (Codeberg supports orgs)?
4. **Project name.** Is it `prvt`? That's the working name — confirm or rename before the repo is public.

**Important — shapes the implementation:**

5. **Who creates links?** Just you, or a small group? This determines whether the admin secret needs to be shareable and how carefully it needs to be managed.
6. **Default TTL.** What should the UI default to? Suggested: 24 hours. Events and campaigns might want 7 days; one-off tactical links might want 1 hour.
7. **Slug length.** 4 chars (`[A-Z0-9]⁴` = ~1.7M combinations) vs 3 chars (~47k). For low volume, 3 is fine and keeps URLs shorter. Recommend 4 for a public tool.
8. **Will the web UI be publicly hosted?** Options: (a) Codeberg Pages / Cloudflare Pages — publicly accessible, anyone can use it; (b) local HTML file only — you open it in a browser, it calls the Worker; (c) both. A publicly hosted UI means anyone can mint links on your Worker, so the auth story matters more.

**Can decide later:**
9. UTM stripping — offer to strip `?utm_*` params from destination URLs before shortening?
10. CLI tool — worth building after the web UI works.
11. GitHub mirror — yes/no, and when.

---

## Implementation Steps

In priority order. Designed to be handed to Claude Code session by session.

---

### Phase 0 — Decisions & Groundwork
*Do this yourself before opening Claude Code.*

- [ ] Answer all blocking questions above
- [ ] Register domain (Cloudflare Registrar keeps it in one place; Porkbun is also good)
- [ ] Create Codeberg account with chosen handle
- [ ] Create repo: `codeberg.org/<handle>/prvt` — initialize with README placeholder
- [ ] Verify or create Cloudflare account
- [ ] Note your Cloudflare account ID (Dashboard → right sidebar)

---

### Phase 1 — Cloudflare Worker Scaffold
*Claude Code: "Set up the Wrangler project for a Cloudflare Worker URL shortener."*

- [ ] Install Wrangler: `npm install -g wrangler`
- [ ] Authenticate: `wrangler login`
- [ ] Scaffold: `wrangler init worker` inside `~/Projects/prvt/`
- [ ] Create KV namespace for links: `wrangler kv:namespace create LINKS`
- [ ] Create KV namespace for cooling-off: `wrangler kv:namespace create COOLOFF`
- [ ] Configure `wrangler.toml` with both KV bindings
- [ ] Create `.env.example` with `ADMIN_SECRET=` placeholder
- [ ] Add `wrangler.toml` to `.gitignore` (contains account IDs); commit `wrangler.toml.example`

---

### Phase 2 — Worker Implementation
*Claude Code: "Implement the Worker handlers per the spec in PLAN.md."*

**Redirect handler — `GET /:slug`**
- [ ] Look up slug in `LINKS` KV
- [ ] If found: respond with `302` + `Location` + `Referrer-Policy: no-referrer`
- [ ] If not found (expired or never existed): respond with `404`
- [ ] Never log the destination URL or any request headers

**Create handler — `POST /create`**
- [ ] Require `Authorization: Bearer <ADMIN_SECRET>` header; return `401` otherwise
- [ ] Accept JSON body: `{ "url": "...", "ttl": 86400 }`
- [ ] Validate: URL must be `https://` — reject `http://`
- [ ] Generate slug: 4 chars from `[A-Z0-9]`, retry on collision, skip slugs in `COOLOFF`
- [ ] Write to `LINKS` KV with `expirationTtl: ttl`
- [ ] Write to `COOLOFF` KV with `expirationTtl: 7776000` (90 days)
- [ ] Return `{ "slug": "AB3X", "short": "HTTPS://YOUR.DOMAIN/AB3X", "expires": "<iso timestamp>" }`

**Response headers on all routes**
- [ ] `Referrer-Policy: no-referrer`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] No `Set-Cookie` anywhere

- [ ] Deploy to `*.workers.dev` subdomain for testing
- [ ] Smoke test: create a link, follow it, confirm redirect, wait for TTL, confirm 404

---

### Phase 3 — Domain
*Claude Code: "Wire the custom domain to the Cloudflare Worker."*

- [ ] Add domain to Cloudflare (or transfer if registered elsewhere)
- [ ] In Worker settings: add Custom Domain → your short domain
- [ ] Confirm HTTPS certificate provisioned
- [ ] Smoke test end-to-end with real domain

---

### Phase 4 — Web UI
*Claude Code: "Modify qr-generator.html to add URL shortening per PLAN.md."*

Starting point: `~/Projects/prvt/qr-generator.html` (the SVG QR generator already built).

- [ ] Add TTL selector (dropdown: 1h / 6h / 24h / 7d / 30d / custom)
- [ ] Add admin secret input (stored in `localStorage` as convenience — user enters once)
- [ ] Change flow: user pastes long URL → clicks "Shorten & Generate" → single operation:
  1. POST to `/create` with URL + TTL
  2. Receive short URL
  3. Generate QR from short URL (uppercase, alphanumeric mode)
  4. Display short URL (copyable) + QR preview + expiry time
- [ ] Keep manual mode: user can still paste a URL directly into the QR field without shortening
- [ ] Ensure all QR output is uppercase (already handled by the `qrcode` library + our slugs)
- [ ] No external script calls, no CDN dependencies in production build
- [ ] Download SVG button (already exists — verify it still works)

---

### Phase 5 — Publish & Document
*Claude Code: "Write the README and supporting docs per the values in PLAN.md."*

- [ ] `LICENSE` — AGPL v3 full text
- [ ] `README.md`:
  - What it is and what it's for
  - Values statement (privacy, non-commercial, activist use)
  - One-command setup instructions
  - Link to PLAN.md for design rationale
- [ ] `SETUP.md` — step-by-step Wrangler deploy instructions for self-hosters
- [ ] `SECURITY.md` — responsible disclosure, what data the Worker does and doesn't handle
- [ ] Push to Codeberg
- [ ] Tag `v0.1.0`

---

### Phase 6 — CLI (optional, do after Phase 5)
*Claude Code: "Build the prvt CLI tool per PLAN.md."*

- [ ] `cli/prvt.js` — Node 18+, no dependencies beyond built-ins + `qrcode` (MIT)
- [ ] Usage: `node prvt.js <url> [--ttl 24h] [--out ./qr.svg]`
- [ ] Reads `PRVT_SECRET` and `PRVT_HOST` from environment
- [ ] Calls `/create`, receives slug
- [ ] Generates QR SVG locally using `qrcode`
- [ ] Prints short URL to stdout, saves SVG to `--out` path
- [ ] Optionally: `prvt.js shorten <url>` / `prvt.js qr <url>` subcommands

---

### Phase 7 — Hardening (ongoing)
- [ ] Add Cloudflare rate limiting to `/create` (Dashboard → Security → WAF → Rate Limiting)
- [ ] Review Worker logs settings — disable or filter to avoid retaining request data
- [ ] Consider: does the `/create` endpoint need IP rate limiting independent of CF?
- [ ] Test slug cooling-off behavior
- [ ] Test expiry edge cases (link used 1 second before expiry, etc.)
- [ ] Solicit review from a technically trusted person in the activist community

