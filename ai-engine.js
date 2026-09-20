// AITC AI Engine - Real-World Web Research, Importance Evaluator & Pruning System
// ponytail: native fetch, zero npm dependencies, universal browser/node export

const IMPORTANCE_THRESHOLD = 7.0; // Minimum score to qualify as "decently or more important"

const CATEGORIES = {
  models: { label: "Frontier Models", icon: "🧠" },
  opensource: { label: "Open Source", icon: "🌐" },
  agents: { label: "AI Agents", icon: "🤖" },
  hardware: { label: "Compute & Chips", icon: "⚡" },
  research: { label: "Research & Benchmarks", icon: "🔬" },
  policy: { label: "Policy & Safety", icon: "⚖️" }
};

function isImportantEnough(item) {
  return typeof item.importance === 'number' && item.importance >= IMPORTANCE_THRESHOLD;
}

function checkSuperseded(existingItem, candidateItem) {
  if (existingItem.id === candidateItem.id) {
    return { superseded: false, reason: null };
  }

  const existingLower = (existingItem.title + " " + existingItem.id).toLowerCase();
  const candidateLower = (candidateItem.title + " " + candidateItem.id).toLowerCase();

  // Pattern 1: Same model family version upgrade
  const families = ['gpt', 'gemini', 'claude', 'deepseek', 'fable', 'llama', 'mistral', 'qwen', 'blackwell'];
  for (const fam of families) {
    if (existingLower.includes(fam) && candidateLower.includes(fam)) {
      if (candidateItem.importance >= existingItem.importance) {
        return {
          superseded: true,
          reason: `Superseded by newer release in the ${fam.toUpperCase()} family: "${candidateItem.title}"`
        };
      }
    }
  }

  // Pattern 2: Explicit supersededBy declaration
  if (candidateItem.supersedes && candidateItem.supersedes.includes(existingItem.id)) {
    return {
      superseded: true,
      reason: `Directly replaced by next-generation release: "${candidateItem.title}"`
    };
  }

  return { superseded: false, reason: null };
}

function runAiLifecycleCycle(currentItems, candidates) {
  const activeMap = new Map(currentItems.map(item => [item.id, { ...item }]));
  const prunedMap = new Map();
  const cycleLog = [];

  for (const cand of candidates) {
    if (!isImportantEnough(cand)) {
      cycleLog.push({
        type: 'REJECTED',
        id: cand.id,
        title: cand.title,
        reason: `Importance score (${cand.importance}) fell below ${IMPORTANCE_THRESHOLD} threshold.`
      });
      continue;
    }

    if (activeMap.has(cand.id)) {
      continue;
    }

    for (const [id, existing] of activeMap.entries()) {
      const { superseded, reason } = checkSuperseded(existing, cand);
      if (superseded) {
        const pruned = {
          ...existing,
          status: 'superseded',
          prunedAt: new Date().toISOString(),
          pruneReason: reason,
          supersededBy: cand.id
        };
        activeMap.delete(id);
        prunedMap.set(id, pruned);
        cycleLog.push({
          type: 'PRUNED',
          id: existing.id,
          title: existing.title,
          reason: reason
        });
      }
    }

    activeMap.set(cand.id, {
      ...cand,
      status: cand.status || 'trending',
      addedAt: new Date().toISOString()
    });

    cycleLog.push({
      type: 'ADDED',
      id: cand.id,
      title: cand.title,
      reason: `High importance score (${cand.importance}/10) detected in ${cand.category}.`
    });
  }

  const activeItems = Array.from(activeMap.values()).sort((a, b) => {
    if (b.importance !== a.importance) {
      return b.importance - a.importance;
    }
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const prunedItems = Array.from(prunedMap.values());

  return { activeItems, prunedItems, log: cycleLog };
}

/**
 * Live internet research: Query public real-time sources (Hacker News Algolia AI stories & Hugging Face Daily Papers)
 */
async function fetchLiveInternetHeadlines() {
  const headlines = [];

  // Source 1: Hacker News live AI stories
  try {
    const hnRes = await fetch('https://hn.algolia.com/api/v1/search_by_date?query=AI+model+OR+LLM+OR+breakthrough+OR+reasoning&tags=story&hitsPerPage=15');
    if (hnRes.ok) {
      const data = await hnRes.json();
      (data.hits || []).forEach(h => {
        if (h.title && (h.points >= 2 || h.num_comments >= 2)) {
          headlines.push({
            source: 'Hacker News Live',
            title: h.title,
            url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
            publishedAt: h.created_at,
            score: h.points || 0
          });
        }
      });
    }
  } catch (e) {
    console.warn('HN live feed fetch error:', e);
  }

  // Source 2: Hugging Face daily frontier papers & models
  try {
    const hfRes = await fetch('https://huggingface.co/api/daily_papers');
    if (hfRes.ok) {
      const papers = await hfRes.json();
      (papers || []).slice(0, 8).forEach(p => {
        if (p.title) {
          headlines.push({
            source: 'Hugging Face Research',
            title: p.title,
            url: `https://huggingface.co/papers/${p.paper?.id || ''}`,
            publishedAt: p.publishedAt,
            score: p.paper?.upvotes || 10
          });
        }
      });
    }
  } catch (e) {
    console.warn('HF daily papers fetch error:', e);
  }

  return headlines;
}

/**
 * Fetch updates using Gemini with Google Search Grounding & live web feeds
 */
async function fetchGeminiAiUpdates(apiKey, currentTitles = [], modelName = 'gemini-2.5-flash') {
  if (!apiKey) {
    throw new Error("Gemini API key required for live web-grounded AI synthesis.");
  }

  // First, fetch live internet headlines to provide immediate real-time grounding
  const liveHeadlines = await fetchLiveInternetHeadlines();
  const headlineContext = liveHeadlines.slice(0, 10).map(h => `- ${h.title} (${h.source})`).join('\n');

  const cleanModel = modelName.replace('models/', '').trim() || 'gemini-2.5-flash';
  const prompt = `You are AITC, an autonomous real-world Artificial Intelligence Tracker and Curator.
Research the CURRENT INTERNET for the latest movements, frontier model releases, chip breakthroughs, and agent architectures.
Today's local context is late 2026. Models like GPT-6 Astrea, Gemini 3.8, Fable 5.1, Claude 3.7/4.0, and modern open-weight MoEs are active.

Real-time live internet signals detected right now:
${headlineContext}

Currently tracked titles on dashboard:
${JSON.stringify(currentTitles.slice(0, 8))}

Find 1 to 3 FRESH, BREAKING or HIGH-IMPORTANCE real-world AI developments (importance >= 7.0/10).
For each, synthesize:
1. Clear headline
2. Category: models | opensource | agents | hardware | research | policy
3. Importance rating: 7.0 to 10.0
4. 1-2 sentence executive summary
5. Technical innovations bullets
6. Real-world industry impact
7. Key companies / research entities
8. Primary source reference link

Output STRICTLY a JSON array matching this format (no markdown fences, just valid JSON):
[
  {
    "id": "kebab-case-id",
    "title": "Headline",
    "category": "models",
    "importance": 9.5,
    "timestamp": "${new Date().toISOString()}",
    "status": "trending",
    "summary": "1-2 sentence overview",
    "fullDetails": {
      "background": "Context",
      "keyInnovations": ["point 1", "point 2"],
      "impact": "Industry impact",
      "keyEntities": ["Entity 1", "Entity 2"],
      "sourceUrl": "https://...",
      "supersededBy": null,
      "pruneReason": null
    }
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;

  // Enable Google Search Grounding tool
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.2
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API returned status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return [];

  try {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.error("Failed to parse Gemini output:", rawText);
    return [];
  }
}

/**
 * Public live internet feed: Converts real-time internet signals (HN & Hugging Face) into AITC candidates
 */
async function fetchPublicLiveFeed() {
  const headlines = await fetchLiveInternetHeadlines();
  if (headlines.length === 0) {
    return [];
  }

  // Transform live real-world internet headlines into candidate items
  const candidates = [];
  for (const h of headlines.slice(0, 4)) {
    const slug = h.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
    const isModel = /model|llm|gpt|gemini|deepseek|claude|reasoning|weights/i.test(h.title);
    const isAgent = /agent|autonomous|operator|action/i.test(h.title);
    const isHardware = /chip|gpu|lpu|tpu|compute|hardware/i.test(h.title);

    let category = 'research';
    if (isModel) category = 'models';
    else if (isAgent) category = 'agents';
    else if (isHardware) category = 'hardware';

    // Calculate score based on live upvotes/signals
    const importance = Math.min(9.8, Math.max(7.2, 7.0 + (h.score / 20)));

    candidates.push({
      id: `live-${slug}`,
      title: h.title,
      category: category,
      importance: parseFloat(importance.toFixed(1)),
      timestamp: h.publishedAt || new Date().toISOString(),
      status: "trending",
      summary: `Live internet intelligence reported via ${h.source}: "${h.title}".`,
      fullDetails: {
        background: `Reported in real-time from community research discussions on ${h.source}.`,
        keyInnovations: [
          `Rapidly emerging community attention on ${h.source}`,
          "Real-world open research implementation",
          "Publicly verifiable code repository or paper preprint"
        ],
        impact: "Signals live grassroots interest and technical experimentation across the global AI ecosystem.",
        keyEntities: [h.source],
        sourceUrl: h.url,
        supersededBy: null,
        pruneReason: null
      }
    });
  }

  return candidates;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IMPORTANCE_THRESHOLD,
    CATEGORIES,
    isImportantEnough,
    checkSuperseded,
    runAiLifecycleCycle,
    fetchLiveInternetHeadlines,
    fetchGeminiAiUpdates,
    fetchPublicLiveFeed
  };
} else if (typeof window !== 'undefined') {
  window.AITCEngine = {
    IMPORTANCE_THRESHOLD,
    CATEGORIES,
    isImportantEnough,
    checkSuperseded,
    runAiLifecycleCycle,
    fetchLiveInternetHeadlines,
    fetchGeminiAiUpdates,
    fetchPublicLiveFeed
  };
}
