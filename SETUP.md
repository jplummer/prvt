# Setup Guide

This guide covers everything you need to self-host prvt. It is written for people who are comfortable with a terminal but haven't necessarily deployed a Cloudflare Worker or Docker container before.

---

## Registering a domain privately

Your domain registrant record is a real identity leak. By default it's publicly visible in WHOIS — your name, email, address, and phone number. This section explains how to minimize what's exposed and to whom.

### What actually leaks

| Data point | Who sees it | How to limit it |
|---|---|---|
| Name, email, address in WHOIS | Anyone, publicly | Enable WHOIS privacy (free at most registrars) |
| Your real email address | The registrar | Use an email alias service |
| Payment method | The registrar + payment processor | Pay with crypto or a virtual card |
| IP address at signup | The registrar | Use a VPN or Tor Browser when creating your account |

**The honest baseline:** You cannot be fully anonymous as a domain registrant — the registrar always has your payment record. What you can achieve is *pseudonymity*: your real identity isn't publicly visible, and the registrar holding your info is in a jurisdiction with limited exposure to aggressive law enforcement.

---

### Step 1: Get a masked email address

Do not use your real email address for the registrar account. Use an alias service that forwards to your inbox without exposing it:

- **[SimpleLogin](https://simplelogin.io)** — open source, privacy-focused, free tier available, integrates with Proton accounts
- **[Addy.io](https://addy.io)** — open source, similar to SimpleLogin, generous free tier
- **New ProtonMail account** — create one with no personal info, used only for this project

Create the alias *before* creating your registrar account. The registrar will only ever see the alias address.

---

### Step 2: Choose a registrar

Two paths, depending on how much you want to minimize the number of accounts and services involved.

#### Option A — Cloudflare one-stop (simplest)

Register your domain at **[Cloudflare Registrar](https://cloudflare.com/products/registrar/)**, then deploy the Worker in the same account. Because domain and Worker are in the same Cloudflare account, DNS wiring is automatic — no nameserver changes, no waiting for propagation.

- At-cost pricing (no registrar markup — typically the cheapest available price for the TLD)
- Free WHOIS privacy
- Masked email works fine for the account
- One account to manage instead of two

**Tradeoffs:** Credit/debit card only (no crypto). US jurisdiction. Limited TLD selection — `.pw` is not available at Cloudflare Registrar; use a 4-character `.xyz` or `.com` if you go this route.

#### Option B — Separate registrar + Cloudflare Workers (more control)

Register the domain at a privacy-focused registrar, then point its nameservers at Cloudflare to run the Worker. Adds one setup step but gives you more options for payment method and jurisdiction.

| Registrar | Country | WHOIS privacy | Crypto payment | Best for |
|---|---|---|---|---|
| **[Porkbun](https://porkbun.com)** | US | Free | Yes | Best prices on `.pw` and `.xyz`, accepts crypto |
| **[inwx.de](https://inwx.de)** | Germany (EU) | Free | No | Maximum jurisdiction protection — GDPR, harder for US legal reach |
| **[Namecheap](https://namecheap.com)** | US | Free | Yes | Well-known, crypto accepted, solid track record |
| **[Gandi](https://gandi.net)** | France (EU) | Free | No | EU jurisdiction, strong privacy reputation |

Always enable WHOIS privacy during checkout. It is free at all of the above and should be on by default, but confirm it before completing the order.

---

### Step 3: Pay in a way that limits the link to your identity

In order of privacy:

1. **Cryptocurrency** — Namecheap and Porkbun accept it. Monero (XMR) offers stronger privacy than Bitcoin; Litecoin and Ethereum are also accepted. The registrar still has your email and IP, but not your bank details.
2. **[Privacy.com](https://privacy.com) virtual card** — generates a one-time card number linked to your real bank account. The registrar sees a virtual number, not your actual card. US residents only.
3. **Prepaid gift card** — bought with cash, works at some registrars. Address verification (AVS) increasingly blocks these for online purchases.
4. **Regular credit/debit card** — the most common path. The registrar and payment processor have your card details. Acceptable if the other steps (email alias, WHOIS privacy, VPN) are in place.

---

### Step 4: Register from a VPN or Tor

Use a VPN you trust, or Tor Browser, when creating your registrar account and completing the domain purchase. This prevents the registrar from logging your real IP address.

You don't need to use the VPN for ongoing management — just at account creation and domain registration time.

---

### Choosing a short domain

The shorter the domain, the more compact the QR code. The slug path is already kept short (4 uppercase characters), so the domain is where remaining length savings come from.

**Target:** Domain + path ≤ 15 characters total. Example: `FNVK.XYZ/AB3X` = 13 characters — still compact enough to stay in QR alphanumeric mode.

#### The premium domain trap

Short domains (2–3 characters) on popular TLDs like `.xyz` are designated **premium** by the registry itself — not the registrar. The same domain costs $300–$3000+/year at every registrar, because the price is set upstream. You will see this at Porkbun, Namecheap, and everywhere else. This is not a sale situation; the price doesn't come down.

The workaround: **use 4 characters, or use a TLD where squatters haven't focused their attention.**

#### Recommended: 4 random consonants + `.xyz`

A 4-character SLD on `.xyz` is almost always at flat registry pricing (~$10/year). Squatters don't bother with unpronounceable strings. Pick a random consonant-heavy combo — `fnvk.xyz`, `qrpx.xyz`, `btvn.xyz` — and you'll almost certainly find it available at standard price.

`FNVK.XYZ/AB3X` is 13 characters. That's short. QR codes at this length are still compact.

#### If you want 2–3 characters

Try **`.pw`** (Palau) at Porkbun. `.pw` has flat pricing across all name lengths including 2–3 characters, WHOIS privacy is available, and it's not heavily targeted by squatters. `qr.pw` or `fn.pw` may be available at ~$6–8/year.

Use **[instantdomainsearch.com](https://instantdomainsearch.com)** to check a short string across dozens of TLDs at once. It shows standard pricing — a result showing as available on `.xyz` may still be premium, so click through to the registrar to confirm the actual price before committing.

Other low-traffic TLDs with flat pricing worth checking: `.click`, `.fyi`, `.lol` — less predictable availability but less squatted.

#### Other options

| TLD | Annual cost | WHOIS privacy | Notes |
|---|---|---|---|
| `.xyz` (4-char SLD) | ~$10 | Yes | Best overall — flat pricing at 4 chars, cheap, private |
| `.pw` (Palau) | ~$6–8 | Yes | Flat pricing even at 2–3 chars; less squatted |
| `.link` | ~$10 | Yes | Readable; 4-char SLD availability is good |
| `.to` (Tonga) | ~$35 | Yes | Shorter TLD; higher cost; flat pricing |
| `.sh` (St. Helena) | ~$40 | Yes | Popular with developers; flat pricing |
| `.is` (Iceland) | ~$35 | Partial — name/org may be visible; check ISNIC policy | |
| `.com` | ~$10 | Yes | 4-char combos available; 2–3 char mostly premium or taken |

#### Picking a name

For a privacy tool, a **nonsense or opaque name** is better than a descriptive one. `go.xyz` reads as a redirect service and is almost certainly premium-priced; `fnvk.xyz` does not and costs $10. The slug (`AB3X`) already communicates nothing about the destination — the domain name should too.

Have two or three candidate strings ready. Check availability at your chosen registrar and verify the price shown is standard (not premium) before purchasing.

---

### ccTLD WHOIS notes

Country-code TLDs (`.to`, `.is`, `.sh`) have their own registries with their own rules. Some national registries require real registrant data and publish it regardless of what your registrar offers. Always verify current policy for any ccTLD before registering:

- Search `[tld] WHOIS privacy policy` before purchasing
- ccTLD policies change — what was private last year may not be now

Standard gTLDs (`.xyz`, `.link`, `.com`, `.org`) follow ICANN rules and WHOIS privacy works reliably.

---

*This guide will be expanded with deployment instructions for both the Cloudflare Workers path and the Docker/VPS path.*
