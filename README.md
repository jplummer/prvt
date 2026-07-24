# prvt

A self-hosted URL shortener for people who don't want to hand their audience's behavior to a data broker.

**prvt** creates short links that self-destruct. No click tracking. No analytics. No third-party visibility into where your links go or who follows them. Public URL shorteners are surveillance businesses. This one isn't.

Built for generating compact QR codes for print and physical distribution — short URLs stay in QR alphanumeric mode, producing the smallest possible codes.

---

## How it works

- Paste a long URL, pick a lifetime (1 day to 4 weeks), get a short link and QR code
- The link redirects and then disappears when its time is up — no residual record
- No cookies, no referrer leakage, no logs of who clicked what

Runs on Cloudflare Workers + KV. The only cost is your domain.

## Self-hosting

See **[SETUP.md](SETUP.md)** for full instructions including private domain registration, Cloudflare account setup, and sharing the form with a trusted group.

Quick version:

```bash
git clone https://github.com/jplummer/prvt
cd prvt/worker
npm install
cp wrangler.toml.example wrangler.toml  # fill in your KV namespace IDs
wrangler secret put ADMIN_SECRET
wrangler secret put FORM_TOKEN
wrangler deploy
```

## Design

See **[DESIGN.md](DESIGN.md)** for the full rationale: stack decisions, QR encoding details, privacy threat model, slug design, and licensing reasoning.

## License

[GNU Affero General Public License v3](LICENSE) — if you run a modified version as a hosted service, you must publish the source. See DESIGN.md for why AGPL and not MIT.
