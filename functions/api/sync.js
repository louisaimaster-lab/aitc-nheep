// Cloudflare Pages Function: /api/sync
// ponytail: standard web Request/Response, zero dependencies

export async function onRequest(context) {
  const { request, env } = context;
  const apiKey = env.GEMINI_API_KEY;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (request.method === 'POST') {
    try {
      const body = await request.json().catch(() => ({}));
      const activeKey = apiKey || body.clientKey;

      if (!activeKey) {
        return new Response(
          JSON.stringify({ error: 'No GEMINI_API_KEY configured in environment or request body.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      const prompt = `You are AITC, an autonomous real-world Artificial Intelligence Tracker and Curator.
Track the latest real-world movements, breakthroughs, models, chips, and agent frameworks in AI.
Return a JSON array of 1 to 4 FRESH or BREAKING real-world AI events that are decently or highly important (importance >= 7.0).
Schema:
[
  {
    "id": "slug",
    "title": "Title",
    "category": "models|opensource|agents|hardware|research|policy",
    "importance": 7.0-10.0,
    "timestamp": "${new Date().toISOString()}",
    "status": "trending",
    "summary": "1-2 sentence overview",
    "fullDetails": {
      "background": "...",
      "keyInnovations": ["..."],
      "impact": "...",
      "keyEntities": ["..."],
      "sourceUrl": "https://...",
      "supersededBy": null,
      "pruneReason": null
    }
  }
]`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: errorData.error?.message || 'Gemini upstream error' }),
          { status: response.status, headers: corsHeaders }
        );
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());

      return new Response(
        JSON.stringify({ success: true, candidates: parsed }),
        { status: 200, headers: corsHeaders }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: corsHeaders }
      );
    }
  }

  // GET: Healthcheck
  return new Response(
    JSON.stringify({
      status: 'online',
      platform: 'Cloudflare Pages',
      geminiConfigured: Boolean(apiKey),
      timestamp: new Date().toISOString()
    }),
    { status: 200, headers: corsHeaders }
  );
}
