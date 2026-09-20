// Cloudflare Pages Function: /api/feed
// Returns live active AI items and pruned ledger directly from Cloudflare KV Edge storage

export async function onRequest(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=15, s-maxage=30"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let activeItems = [];
    let prunedItems = [];
    let lastSync = new Date().toISOString();

    if (env.AITC_STORAGE) {
      const rawActive = await env.AITC_STORAGE.get("active_items", "json");
      const rawPruned = await env.AITC_STORAGE.get("pruned_items", "json");
      const rawSync = await env.AITC_STORAGE.get("last_sync");

      if (Array.isArray(rawActive) && rawActive.length > 0) {
        activeItems = rawActive;
      }
      if (Array.isArray(rawPruned)) {
        prunedItems = rawPruned;
      }
      if (rawSync) {
        lastSync = rawSync;
      }
    }

    // If KV not yet seeded in this region, fetch from worker endpoint
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
        console.warn("Fallback fetch notice:", e);
      }
    }

    return new Response(JSON.stringify({
      status: "online",
      source: "Cloudflare KV Edge & 24/7 Background Agent",
      model: "Google Gemini 3.8 Flash (Live Grounded)",
      activeItems,
      prunedItems,
      lastSync
    }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message
    }), { status: 500, headers: corsHeaders });
  }
}
