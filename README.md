# AITC // AI Tracker & Chronicle

Autonomous, real-world artificial intelligence movement tracker, breakthrough curator, and obsolescence pruning system designed for **aitc.nheep.com**.

---

## Features

- **Autonomous Real-World Tracking**: Continuously monitors breakthrough models, open-source weights, agent architectures, hardware scaling, and international AI policy.
- **Importance Thresholding Filter**: Discards trivial noise and only accepts movements scoring $\ge 7.0/10$ across architectural leap, industry disruption, and benchmark gains.
- **Automatic Obsolescence Pruning**: Automatically detects when an older model or framework has been superseded (e.g. version transitions, preview deprecation, overtaken benchmarks), retiring it to a transparent **Pruned Ledger** with explicit AI deprecation reasoning.
- **Interactive "Box" Tiles & Modals**:
  - Crisp summary boxes on the main dashboard with category icons, live status badges, and impact scores.
  - Native accessible `<dialog>` modals with executive overviews, background context, key technical innovations, affected entities, and primary source links.
- **Dual-Mode Engine**:
  - Live Google Gemini API with Google Search Grounding for continuous real-world web monitoring.
  - Built-in public live feeds & curated baseline dataset ensuring high performance out-of-the-box without requiring an API key.
- **Zero-Dependency Architecture**: Built on pure modern web platform standards (HTML5 dialog, ES Modules, CSS Grid, native Fetch API), ensuring 100/100 Lighthouse performance and zero dependency maintenance.

---

## Domain Configuration (`aitc.nheep.com`)

The root domain `nheep.com` is hosted with Cloudflare nameservers. To point `aitc.nheep.com` to this project on Vercel:

1. Log into your **Cloudflare Dashboard**.
2. Select the **nheep.com** zone.
3. Go to **DNS** &rarr; **Records** &rarr; **Add Record**:
   - **Type**: `CNAME`
   - **Name**: `aitc`
   - **Target**: `cname.vercel-dns.com`
   - **Proxy status**: `DNS only` (or `Proxied` with SSL mode set to Full/Strict)
   - **TTL**: `Auto`
4. In Vercel, navigate to Project Settings &rarr; **Domains** &rarr; add `aitc.nheep.com`.

---

## Local Development & Testing

Run the automated engine verification suite:
```powershell
node test/engine.test.js
```

Serve locally with any static web server:
```powershell
npx serve .
# or
python -m http.server 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Architecture

```
aitc-nheep/
├── index.html         # Main dashboard, box grid, native modals, ledger
├── style.css          # Dark-mode glassmorphic design system
├── app.js             # UI controller, state sync, local storage
├── ai-engine.js       # AI scoring, search grounding, pruning algorithms
├── seed-data.json     # Curated initial catalog of verified movements
├── vercel.json        # Vercel deployment routing & headers
├── api/
│   └── sync.js        # Vercel serverless function (Gemini API & feed proxy)
└── test/
    └── engine.test.js # Self-contained Node.js validation suite
```
