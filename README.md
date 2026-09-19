# AITC // AI Tracker & Chronicle

Autonomous, real-world artificial intelligence movement tracker, breakthrough curator, and obsolescence pruning system built for **Cloudflare Pages** at **aitc.nheep.com**.

---

## Design & Philosophy

- **Clean, White & Minimal**: Designed with high-contrast typography, crisp borders, subtle monochromatic badges, and ample whitespace. No visual clutter, dark presets, or glowing distractions.
- **Interactive "Box" Tiles**: Every tracked movement sits in an understated card displaying its category, status, impact rating, and timeline. Clicking a card opens an editorial detail modal with executive summary, technical innovations, and primary sources.
- **Autonomous AI Engine**:
  - **Importance Thresholding**: Filters incoming real-world AI news, admitting only high-impact developments ($\ge 7.0 / 10$).
  - **Obsolescence Pruning**: Automatically flags and moves superseded or obsolete models/frameworks to the **Pruned Ledger**, with the AI's deprecation reasoning attached.
  - **Dual-Mode**: Runs with an immediate curated baseline of verified AI movements, or connects to Google Gemini for real-time web-grounded monitoring.

---

## Cloudflare Pages Deployment & `aitc.nheep.com`

Because `nheep.com` is hosted directly on Cloudflare DNS:

### Connecting via Cloudflare Dashboard (Recommended)
1. Go to your **Cloudflare Dashboard** &rarr; **Workers & Pages** &rarr; **Create application** &rarr; **Pages** &rarr; **Connect to Git**.
2. Select repository: `louisaimaster-lab/aitc-nheep`.
3. Set build configuration:
   - **Framework preset**: None
   - **Build command**: None
   - **Build output directory**: `.`
4. Click **Save and Deploy**.
5. Once deployed, go to **Custom domains** &rarr; **Set up a custom domain** &rarr; enter `aitc.nheep.com`.
   - Cloudflare will configure the DNS record automatically in one click!

### Local Development & Testing
Run tests:
```powershell
node test/engine.test.js
```

Serve locally:
```powershell
python -m http.server 3000
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Repository Structure

```
aitc-nheep/
├── index.html         # Clean, white minimal UI layout & dialogs
├── style.css          # Minimalist, high-contrast light theme
├── app.js             # Client controller, state sync & dialog handlers
├── ai-engine.js       # Scoring, web grounding & pruning logic
├── seed-data.json     # Curated initial catalog of verified movements
├── wrangler.toml      # Cloudflare Pages configuration
├── functions/
│   └── api/
│       └── sync.js    # Cloudflare Pages Function (Gemini API & feed proxy)
└── test/
    └── engine.test.js # Engine validation test suite
```
