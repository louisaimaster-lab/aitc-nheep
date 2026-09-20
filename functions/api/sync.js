// Cloudflare Pages Function: /api/sync
// ponytail: standard web Request/Response, zero dependencies

export async function onRequest(context) {
  const { request, env } = context;
  const apiKey = env.GEMINI_API_KEY;

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
      const modelName = body.modelName || 'gemini-3.8-flash';

      if (!activeKey) {
        return new Response(
          JSON.stringify({ error: 'No GEMINI_API_KEY configured in environment or request body.' }),
          { status: 400, headers: corsHeaders }
        );
      }

      // Live internet context query across frontier and niche developer channels
      let liveContext = '';
      try {
        const hnRes = await fetch('https://hn.algolia.com/api/v1/search_by_date?query=devsplainers+OR+"coding+agent"+OR+"local+llm"+OR+"vibe+coding"+OR+mem0+OR+vllm+OR+ollama+OR+AI&tags=story&hitsPerPage=12');
        if (hnRes.ok) {
          const hnData = await hnRes.json();
          liveContext = (hnData.hits || []).map(h => `- ${h.title} (${h.url || 'HN'})`).join('\n');
        }
      } catch (e) {
        // Continue with search grounding
      }

      const prompt = `You are AITC, an autonomous real-world Artificial Intelligence Tracker and Curator.
Research the CURRENT INTERNET for the latest movements, developer tooling, and niche engineering breakdowns.
Specifically search YouTube developer channels (including channels like "Devsplainers", Matthew Berman, Fireship, and practical engineering breakdown creators), GitHub open-source repositories, and frontier AI research.
IMPORTANT: Do NOT only focus on giant frontier models. Actively discover and surface NICHE developer engineering breakthroughs and practical tooling:
- Practical AI agent architectures, memory frameworks (e.g. Mem0, Letta), and sub-agent sandboxes.
- Developer workflow tooling and coding agent showdowns (Cursor, Claude Code, Cline, Aider, OpenHands).
- Pragmatic local AI inference setups (vLLM, Ollama, quantized MoEs, hardware memory tuning).
- Viral community demos and vibe-coding toolkits highlighted on Devsplainers and developer forums.

Live internet feed signals right now:
${liveContext}

Return a JSON array of 1 to 3 FRESH, BREAKING, or NICHE real-world AI events that are decently or highly important (importance >= 7.0).
Strictly output a JSON array of objects:
[
  {
    "id": "slug",
    "title": "Title",
    "category": "models|opensource|agents|tools|hardware|research|policy",
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
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${activeKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: {
              temperature: 0.2
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
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());

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

  return new Response(
    JSON.stringify({
      status: 'online',
      platform: 'Cloudflare Pages',
      searchGrounding: 'enabled',
      geminiConfigured: Boolean(apiKey),
      timestamp: new Date().toISOString()
    }),
    { status: 200, headers: corsHeaders }
  );
}
