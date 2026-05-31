# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**prvt** is a self-hosted, privacy-respecting URL shortener built on Cloudflare Workers + KV. It generates short links that auto-expire via KV native TTL — no cron jobs, no cleanup, no trace after expiry. Designed for activist and nonprofit QR code use; no analytics, no click tracking, no third-party data exposure.

See `PLAN.md` for full design rationale, implementation phases, and decisions.

## Tech Stack

- **Runtime**: Cloudflare Workers (JS, ~30 lines for core logic)
- **Storage**: Cloudflare KV — two namespaces: `LINKS` (slugs → URLs with TTL) and `COOLOFF` (recently expired slugs, 90-day reuse prevention)
- **QR generation**: `qrcode` npm library (MIT), used in both web UI and CLI
- **CLI**: Node 18+, no bundler, built-ins only (`fetch`, `parseArgs`) + `qrcode`
- **Web UI**: Vanilla JS + HTML, no framework — see `qr-generator.html`

## Commands

Once scaffolded (Phase 1), the primary commands are:

```bash
# Authenticate with Cloudflare
wrangler login

# Create KV namespaces (one-time setup)
wrangler kv:namespace create LINKS
wrangler kv:namespace create COOLOFF

# Deploy the Worker
wrangler deploy

# Tail live logs (for debugging only — disable in production)
wrangler tail

# Run Worker locally for testing
wrangler dev
```

CLI tool (Phase 6, once built):
```bash
PRVT_SECRET=<token> PRVT_HOST=https://your.domain node cli/prvt.js https://long-url.com --ttl 24h
```

## Architecture

```
POST /create { url, ttl }   →  Worker validates auth + URL, generates slug,
                                writes LINKS KV (TTL) + COOLOFF KV (90d)
                                returns { slug, short, expires }

GET /:slug                  →  Worker looks up LINKS KV
                                302 + Referrer-Policy: no-referrer  (if found)
                                404                                  (if expired/missing)
```

**Slug generation**: 4 chars from `[A-Z0-9]` only — this keeps the QR code in alphanumeric mode (~40% more efficient than byte mode). Never lowercase in slugs or short domain output.

**Redirect type**: Always 302, never 301 — browser-cached 301s would ignore KV expiry.

**Auth**: `Authorization: Bearer <ADMIN_SECRET>` on `/create` only. Secret stored as Wrangler env var, never in code.

## Key Design Constraints

- **HTTPS-only**: Reject any `url` that doesn't start with `https://`
- **No logging**: Worker must not log destination URLs, IP addresses, User-Agent, or any identifying headers
- **No cookies**: Set-Cookie header must never appear anywhere
- **Response headers on all routes**: `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`
- **Slug cooloff**: Before reusing a slug, check COOLOFF KV — only recycle after 90 days
- **QR uppercase**: Short URLs must be uppercase in QR output (`HTTPS://PRVT.PW/AB3X`) for alphanumeric mode

## Files

- `PLAN.md` — Full spec: domain strategy, security/privacy design, phase-by-phase implementation checklist
- `qr-generator.html` — Existing SVG QR generator (dark theme, no external deps at runtime); Phase 4 modifies this to integrate the shortener
- `wrangler.toml` — Created in Phase 1; add to `.gitignore` (contains account IDs); commit `wrangler.toml.example` instead

## License

AGPL v3. All dependencies must be AGPL-compatible. The `qrcode` library is MIT ✓. Verify any new dependency before adding.
