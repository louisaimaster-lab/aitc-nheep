// AITC AI Engine - Real-World Tracker, Importance Evaluator & Pruning System
// ponytail: minimal stdlib/native fetch, universal browser/node export

const IMPORTANCE_THRESHOLD = 7.0; // Minimum score to qualify as "decently or more important"

/**
 * Valid categories for AI movements
 */
const CATEGORIES = {
  models: { label: "Frontier Models", icon: "🧠" },
  opensource: { label: "Open Source", icon: "🌐" },
  agents: { label: "AI Agents", icon: "🤖" },
  hardware: { label: "Compute & Chips", icon: "⚡" },
  research: { label: "Research & Benchmarks", icon: "🔬" },
  policy: { label: "Policy & Safety", icon: "⚖️" }
};

/**
 * Evaluates whether a new item is important enough to be added.
 * @param {Object} item 
 * @returns {boolean}
 */
function isImportantEnough(item) {
  return typeof item.importance === 'number' && item.importance >= IMPORTANCE_THRESHOLD;
}

/**
 * Check if candidate item supersedes or makes an existing item outdated.
 * @param {Object} existingItem 
 * @param {Object} candidateItem 
 * @returns {{ superseded: boolean, reason: string|null }}
 */
function checkSuperseded(existingItem, candidateItem) {
  if (existingItem.id === candidateItem.id) {
    return { superseded: false, reason: null };
  }

  // Same category and direct lineage check (e.g., v2 -> v3, preview -> GA)
  const existingLower = (existingItem.title + " " + existingItem.id).toLowerCase();
  const candidateLower = (candidateItem.title + " " + candidateItem.id).toLowerCase();

  // Pattern 1: Same model family version upgrade
  const families = ['deepseek', 'claude', 'gemini', 'gpt', 'llama', 'mistral', 'qwen', 'blackwell'];
  for (const fam of families) {
    if (existingLower.includes(fam) && candidateLower.includes(fam)) {
      if (candidateItem.importance >= existingItem.importance) {
        return {
          superseded: true,
          reason: `Superseded by newer release in the ${fam.toUpperCase()} line: "${candidateItem.title}"`
        };
      }
    }
  }

  // Pattern 2: Explicit supersededBy link
  if (candidateItem.supersedes && candidateItem.supersedes.includes(existingItem.id)) {
    return {
      superseded: true,
      reason: `Directly replaced by next-generation breakthrough: "${candidateItem.title}"`
    };
  }

  return { superseded: false, reason: null };
}

/**
 * Core AI cycle: merges candidates, prunes outdated/superseded items, and returns updated active items and prune log.
 * @param {Array} currentItems 
 * @param {Array} candidates 
 * @returns {{ activeItems: Array, prunedItems: Array, log: Array }}
 */
function runAiLifecycleCycle(currentItems, candidates) {
  const activeMap = new Map(currentItems.map(item => [item.id, { ...item }]));
  const prunedMap = new Map();
  const cycleLog = [];

  // 1. Process candidate items
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

    // Check if already in active list
    if (activeMap.has(cand.id)) {
      continue;
    }

    // Check if this candidate supersedes any current active item
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

    // Add new candidate to active
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

  // Convert map back to array, sorted by importance desc, then timestamp desc
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
 * Fetch real-world AI updates using Gemini API with Search Grounding or fallback generator
 * @param {string} apiKey Gemini API Key
 * @param {Array} currentTitles Current active titles to avoid duplicates
 * @returns {Promise<Array>}
 */
async function fetchGeminiAiUpdates(apiKey, currentTitles = []) {
  if (!apiKey) {
    throw new Error("Gemini API key required for live AI Search Grounding.");
  }

  const prompt = `You are AITC, an autonomous real-world Artificial Intelligence Tracker and Curator.
Track the latest real-world movements, breakthroughs, models, chips, and agent frameworks in AI.
Currently tracked titles: ${JSON.stringify(currentTitles.slice(0, 8))}.

Return a JSON array of 1 to 4 FRESH or BREAKING real-world AI events that are decently or highly important (importance >= 7.0).
Strictly output a JSON array of objects with the following schema:
[
  {
    "id": "unique-kebab-case-slug",
    "title": "Clear concise headline",
    "category": "models|opensource|agents|hardware|research|policy",
    "importance": 7.0 to 10.0,
    "timestamp": "${new Date().toISOString()}",
    "status": "trending",
    "summary": "1-2 sentence high-impact summary",
    "fullDetails": {
      "background": "Context and problem addressed",
      "keyInnovations": ["bullet 1", "bullet 2", "bullet 3"],
      "impact": "Industry/real-world implications",
      "keyEntities": ["Entity 1", "Entity 2"],
      "sourceUrl": "https://...",
      "supersededBy": null,
      "pruneReason": null
    }
  }
]
Do not include any markdown formatting other than raw JSON or a json codeblock.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API call failed with status ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return [];

  try {
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    console.error("Failed to parse Gemini output:", rawText);
    return [];
  }
}

/**
 * Simulated/Public live feed fetcher for testing without an API key
 */
async function fetchPublicLiveFeed() {
  // Public real-world candidate simulation pool
  const realWorldCandidates = [
    {
      id: "groq-lpu-inference-breakthrough-v2",
      title: "Ultra-Fast LPU Inference Speeds Exceed 1,000 Tokens/Sec",
      category: "hardware",
      importance: 8.7,
      timestamp: new Date().toISOString(),
      status: "trending",
      summary: "Language Processing Unit (LPU) architectures achieved record sustained speeds of 1,000+ tokens per second on open-weight 70B models with single-digit millisecond time-to-first-token.",
      fullDetails: {
        background: "Real-time conversational agents require sub-human response latencies that traditional GPU HBM memory bandwidth struggled to deliver.",
        "keyInnovations": [
          "SRAM-based deterministic compute avoiding memory bus bottlenecks",
          "Sub-10ms time-to-first-token for ultra-responsive agent loops",
          "Massive throughput scaling for synchronous tool-calling chains"
        ],
        "impact": "Makes speech-to-speech agents and multi-step reflective reasoning feel instant for end users.",
        "keyEntities": ["Groq", "LPU Systems"],
        "sourceUrl": "https://groq.com",
        "supersededBy": null,
        "pruneReason": null
      }
    },
    {
      id: "qwen-2-5-coder-frontier-release",
      title: "Qwen 2.5 Coder Emerges as Open Benchmark Leader",
      category: "opensource",
      importance: 9.1,
      timestamp: new Date().toISOString(),
      status: "trending",
      summary: "Alibaba Cloud released Qwen 2.5 Coder (32B), achieving coding benchmark parity with proprietary frontier models while running comfortably on single-GPU developer machines.",
      fullDetails: {
        background: "Developers needed an open, self-hostable coding model capable of multi-file reasoning, repo-level indexing, and syntax-accurate refactoring.",
        "keyInnovations": [
          "Trained on over 5.5 trillion tokens of multi-language code and synthetic diffs",
          "128k context window support with native code-editing instructions",
          "Near-parity with top proprietary models on HumanEval, LiveCodeBench, and EvalPlus"
        ],
        "impact": "Allows enterprises to run private, secure code-completion and refactoring pipelines locally without data leaving their firewalls.",
        "keyEntities": ["Alibaba Cloud", "Qwen Team", "Hugging Face"],
        "sourceUrl": "https://github.com/QwenLM/Qwen2.5-Coder",
        "supersededBy": null,
        "pruneReason": null
      }
    }
  ];

  return realWorldCandidates;
}

// Universal export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    IMPORTANCE_THRESHOLD,
    CATEGORIES,
    isImportantEnough,
    checkSuperseded,
    runAiLifecycleCycle,
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
    fetchGeminiAiUpdates,
    fetchPublicLiveFeed
  };
}
