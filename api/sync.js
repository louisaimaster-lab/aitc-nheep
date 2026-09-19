// Vercel Serverless Function: AITC Real-World Sync & Gemini Proxy
// ponytail: stdlib Node.js HTTP handler, zero dependencies

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (req.method === 'POST') {
    const { clientKey } = req.body || {};
    const activeKey = apiKey || clientKey;

    if (!activeKey) {
      res.status(400).json({ error: 'No GEMINI_API_KEY configured in environment or request body.' });
      return;
    }

    try {
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
        res.status(response.status).json({ error: errorData.error?.message || 'Gemini upstream error' });
        return;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());

      res.status(200).json({ success: true, candidates: parsed });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  // GET: Health check & engine status
  res.status(200).json({
    status: 'online',
    engine: 'AITC-v1.0',
    geminiConfigured: Boolean(apiKey),
    timestamp: new Date().toISOString()
  });
}
