# Security and Privacy

## What this Worker does and does not handle

### Data the Worker receives but does not store

Every HTTP request arrives with metadata that the Worker can see but deliberately ignores:

- **IP address** — available via `CF-Connecting-IP`; used only for rate limiting and discarded
- **User-Agent** — not read, not stored
- **Referer** — not read, not stored
- **Accept-Language and other fingerprinting headers** — not read, not stored

The redirect handler (`GET /:slug`) reads the slug, looks up the destination, and returns a 302. That is the entirety of what it does. The destination URL is not logged.

### Data that is stored

- **Slug → destination URL mapping** — written to Cloudflare KV with a TTL set at creation time. Deleted automatically when the TTL expires; no residual record remains.
- **Slug → cooloff marker** — written to a separate KV namespace for 90 days after a slug expires, to prevent immediate reuse. Contains only the slug key, not the destination.
- **Rate limit state** — Cloudflare's edge tracks request counts per IP for the `/shorten` endpoint. This is ephemeral edge state, not accessible to the Worker operator, and not linked to any stored record.

### What is never stored

- Who created a link
- When a link was created (beyond the TTL calculation)
- Who followed a link
- How many times a link was followed
- Any request header from any request

---

## Cloudflare's role

prvt runs on Cloudflare Workers. Cloudflare is the infrastructure provider and terminates HTTPS — they can observe traffic in principle. Cloudflare is not a surveillance-for-hire business, but they are a US company subject to US law.

**Cloudflare Workers does not persist per-request logs by default.** Live log streaming is available via `wrangler tail` or the dashboard Logs tab during active debugging sessions, but these are ephemeral and not stored anywhere.

**Do not enable Cloudflare Logpush** for this Worker. Logpush ships request logs to an external destination and would undermine the no-logging design. If you find it enabled (Dashboard → Analytics & Logs → Logpush), disable it.

Cloudflare Analytics shows aggregate traffic metrics (request counts, status codes, error rates) but not per-request content. These aggregate metrics are acceptable — they reveal nothing about individual users or destinations.

---

## Privacy headers

Every response includes:

- `Referrer-Policy: no-referrer` — prevents the short URL from appearing in the destination server's access logs as a referrer
- `Cache-Control: no-store` — prevents intermediate caches from storing responses, ensuring redirect behavior always reflects current KV state
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` — enforces HTTPS for all future requests to the domain
- `X-Content-Type-Options: nosniff` — prevents MIME type sniffing
- `X-Frame-Options: DENY` — prevents the form page from being embedded in a frame (clickjacking protection)

---

## Form token security model

The form at `/go/TOKEN` embeds the token in the page source, visible to anyone who inspects the page with browser developer tools. Security depends entirely on keeping the URL confidential. Anyone with the URL can create short links on your domain.

Treat the form URL like a password: share it only with trusted people, over an encrypted channel, and rotate it if it is ever compromised (`wrangler secret put FORM_TOKEN`).

---

## Responsible disclosure

If you find a security or privacy issue in this project, please report it by opening a confidential issue on [Codeberg](https://codeberg.org/nooble/prvt) or contacting the maintainer directly. Please do not publish details publicly until a fix is available.
