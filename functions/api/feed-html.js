// Cloudflare Pages Function: /api/feed-html
// Serves server-rendered HTML cards for HTMX 2.0 real-time hypermedia polling & OOB metric updates

const CATEGORIES = {
  models: { label: "Frontier Models", icon: "🧠" },
  opensource: { label: "Open Source", icon: "🌐" },
  agents: { label: "AI Agents", icon: "🤖" },
  tools: { label: "Niche Dev Tools", icon: "🛠️" },
  unconventional: { label: "Exotic & Unconventional AI", icon: "🧬" },
  hardware: { label: "Compute & Chips", icon: "⚡" },
  research: { label: "Research & Trends", icon: "🔬" },
  policy: { label: "Policy & Safety", icon: "⚖️" }
};

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const cat = url.searchParams.get("cat") || "all";
  const query = (url.searchParams.get("q") || "").toLowerCase().trim();

  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-cache, no-store, must-revalidate"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    let activeItems = [];
    let prunedItems = [];
    let lastSync = new Date().toISOString();

    if (env.AITC_STORAGE) {
      const rawActive = await env.AITC_STORAGE.get("active_items", "json");
      const rawPruned = await env.AITC_STORAGE.get("pruned_items", "json");
      const rawSync = await env.AITC_STORAGE.get("last_sync");

      if (Array.isArray(rawActive) && rawActive.length > 0) activeItems = rawActive;
      if (Array.isArray(rawPruned)) prunedItems = rawPruned;
      if (rawSync) lastSync = rawSync;
    }

    if (activeItems.length === 0) {
      try {
        const workerRes = await fetch("https://aitc-agent.louisaimaster.workers.dev/feed");
        if (workerRes.ok) {
          const data = await workerRes.json();
          if (Array.isArray(data.activeItems) && data.activeItems.length > 0) {
            activeItems = data.activeItems;
            prunedItems = data.prunedItems || [];
            lastSync = data.lastSync || lastSync;
          }
        }
      } catch (e) {
        console.warn("Worker fallback notice:", e);
      }
    }

    // Filter by category
    let filtered = activeItems;
    if (cat !== "all") {
      filtered = filtered.filter(i => i.category === cat);
    }

    // Filter by search query
    if (query) {
      filtered = filtered.filter(i => {
        const inTitle = (i.title || "").toLowerCase().includes(query);
        const inSummary = (i.summary || "").toLowerCase().includes(query);
        const inEntities = (i.fullDetails?.keyEntities || []).some(e => e.toLowerCase().includes(query));
        return inTitle || inSummary || inEntities;
      });
    }

    let cardsHtml = "";
    if (filtered.length === 0) {
      cardsHtml = `
        <div class="empty-state" style="grid-column: 1 / -1; padding: 4rem 2rem; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 1rem;">🔍</div>
          <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No AI Movements Found</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Try adjusting your search terms or category filters.</p>
        </div>
      `;
    } else {
      cardsHtml = filtered.map((item, index) => {
        const catMeta = CATEGORIES[item.category] || { label: item.category, icon: "⚡" };
        const timeFormatted = formatRelativeTime(item.timestamp);
        const jsonEncoded = encodeURIComponent(JSON.stringify(item));

        return `
          <article class="ai-box shade-${index % 6}" data-item="${jsonEncoded}" tabindex="0" role="button" aria-label="View details for ${escapeHTML(item.title)}">
            <div>
              <div class="box-header">
                <div class="box-badges">
                  <span class="badge badge-category">${catMeta.icon} ${escapeHTML(catMeta.label)}</span>
                  <span class="badge badge-status-${item.status}">${escapeHTML(item.status.toUpperCase())}</span>
                </div>
                <span class="badge badge-score">★ ${Number(item.importance).toFixed(1)}</span>
              </div>
              <h3 class="box-title">${escapeHTML(item.title)}</h3>
              <p class="box-summary">${escapeHTML(item.summary)}</p>
            </div>
            <div class="box-footer">
              <span class="box-time">${timeFormatted}</span>
              <span class="box-cta">Deep Dive &rarr;</span>
            </div>
          </article>
        `;
      }).join("\n");
    }

    // HTMX Out-Of-Band (OOB) updates for metrics counters
    const avgScore = activeItems.length > 0
      ? (activeItems.reduce((acc, curr) => acc + (curr.importance || 0), 0) / activeItems.length).toFixed(1)
      : "0.0";

    const oobHtml = `
      <span id="metric-active-count" hx-swap-oob="true" class="metric-value">${activeItems.length}</span>
      <span id="metric-avg-score" hx-swap-oob="true" class="metric-value">${avgScore}</span>
      <span id="metric-pruned-count" hx-swap-oob="true" class="metric-value">${prunedItems.length}</span>
      <span id="ledger-count-badge" hx-swap-oob="true">${prunedItems.length}</span>
      <span id="metric-last-sync" hx-swap-oob="true" class="metric-value realtime-ticker" data-sync="${lastSync}">Just now</span>
    `;

    return new Response(cardsHtml + oobHtml, { status: 200, headers });
  } catch (err) {
    return new Response(`<div class="error-notice">HTMX Feed Error: ${escapeHTML(err.message)}</div>`, { status: 500, headers });
  }
}

function formatRelativeTime(dateString) {
  if (!dateString) return "Recent";
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
  if (isNaN(diffHours)) return "Recent";
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
