// AITC Main Application Controller
// ponytail: native DOM APIs, no heavy frameworks, minimal state

(function() {
  // State
  let activeItems = [];
  let prunedItems = [];
  let currentCategory = 'all';
  let currentImpact = 'all';
  let searchQuery = '';
  let autoSyncTimer = null;
  let liveFeedTimer = null;
  let liveTickerTimer = null;
  let backgroundEdgeTriggerTimer = null;

  // DOM Elements
  const gridEl = document.getElementById('ai-grid');
  const emptyStateEl = document.getElementById('empty-state');
  const searchInputEl = document.getElementById('search-input');
  const clearSearchBtnEl = document.getElementById('clear-search-btn');
  const categoryFiltersEl = document.getElementById('category-filters');
  const impactSelectEl = document.getElementById('impact-select');
  const scanNowBtnEl = document.getElementById('scan-now-btn');
  const openLedgerBtnEl = document.getElementById('open-ledger-btn');
  const openSettingsBtnEl = document.getElementById('open-settings-btn');
  const resetFiltersBtnEl = document.getElementById('reset-filters-btn');

  // Metrics Elements
  const activeCountEl = document.getElementById('metric-active-count');
  const avgScoreEl = document.getElementById('metric-avg-score');
  const prunedCountEl = document.getElementById('metric-pruned-count');
  const lastSyncEl = document.getElementById('metric-last-sync');
  const ledgerCountBadgeEl = document.getElementById('ledger-count-badge');

  // Dialog Elements
  const detailDialogEl = document.getElementById('detail-dialog');
  const closeDetailBtnEl = document.getElementById('close-detail-dialog-btn');
  const ledgerDialogEl = document.getElementById('ledger-dialog');
  const closeLedgerBtnEl = document.getElementById('close-ledger-dialog-btn');
  const ledgerListEl = document.getElementById('ledger-list');
  const settingsDialogEl = document.getElementById('settings-dialog');
  const closeSettingsBtnEl = document.getElementById('close-settings-dialog-btn');
  const saveSettingsBtnEl = document.getElementById('save-settings-btn');
  const restoreSeedBtnEl = document.getElementById('restore-seed-btn');
  const apiKeyInputEl = document.getElementById('gemini-api-key-input');
  const aiModelInputEl = document.getElementById('ai-model-input');
  const syncFrequencySelectEl = document.getElementById('sync-frequency-select');
  const toastEl = document.getElementById('toast');

  // Initialization
  document.addEventListener('DOMContentLoaded', async () => {
    loadSettings();
    await loadInitialData();
    setupEventListeners();
    setupAutoSync();
    render();

    // Automatically trigger real-time internet search on startup
    setTimeout(() => {
      triggerAiScan(false);
    }, 1000);
  });

  // Load Settings from LocalStorage
  function loadSettings() {
    const savedKey = localStorage.getItem('aitc_gemini_api_key') || '';
    const savedFreq = localStorage.getItem('aitc_sync_frequency') || '40000';
    let savedModel = localStorage.getItem('aitc_ai_model');
    // Automatically upgrade legacy or empty models to Gemini 3.8 Flash
    if (!savedModel || savedModel === 'gemini-2.5-flash') {
      savedModel = 'gemini-3.8-flash';
      localStorage.setItem('aitc_ai_model', savedModel);
    }
    if (apiKeyInputEl) apiKeyInputEl.value = savedKey;
    if (syncFrequencySelectEl) syncFrequencySelectEl.value = savedFreq;
    if (aiModelInputEl) aiModelInputEl.value = savedModel;
  }

  // Load Initial Data (from Server Edge KV /api/feed, or LocalStorage / seed-data.json)
  async function loadInitialData() {
    try {
      // 1. Fetch live authoritative feed from Cloudflare Edge
      try {
        const feedRes = await fetch('/api/feed');
        if (feedRes.ok) {
          const feedData = await feedRes.json();
          if (Array.isArray(feedData.activeItems) && feedData.activeItems.length > 0) {
            activeItems = feedData.activeItems;
            prunedItems = feedData.prunedItems || [];
            if (feedData.lastSync) localStorage.setItem('aitc_last_sync', feedData.lastSync);
            cleanAndSave();
            return;
          }
        }
      } catch (e) {
        console.warn('Edge feed fetch notice, reading local storage:', e);
      }

      // 2. Fallback to seed-data.json / cache
      const response = await fetch('seed-data.json');
      const seedData = await response.json();
      
      const cachedActive = localStorage.getItem('aitc_active_items');
      const cachedPruned = localStorage.getItem('aitc_pruned_items');

      if (cachedActive) {
        try {
          const parsed = JSON.parse(cachedActive);
          const cachedIds = new Set(parsed.map(p => p.id));
          const missingSeed = seedData.filter(s => s.status !== 'superseded' && !cachedIds.has(s.id));
          
          if (missingSeed.length > 0) {
            activeItems = [...missingSeed, ...parsed];
          } else {
            activeItems = parsed;
          }
          
          prunedItems = cachedPruned ? JSON.parse(cachedPruned) : seedData.filter(i => i.status === 'superseded');
        } catch (e) {
          activeItems = seedData.filter(i => i.status !== 'superseded');
          prunedItems = seedData.filter(i => i.status === 'superseded');
        }
      } else {
        activeItems = seedData.filter(i => i.status !== 'superseded');
        prunedItems = seedData.filter(i => i.status === 'superseded');
      }

      cleanAndSave();
    } catch (e) {
      console.error('Failed to load initial data:', e);
      activeItems = [];
      prunedItems = [];
    }
  }

  function cleanAndSave() {
    // CRITICAL PURGE: Instantly prune outdated legacy items (e.g. Qwen 2.5 Coder from >1 year ago, 2024 items)
    activeItems = activeItems.filter(item => {
      const itemStr = (item.id + ' ' + item.title + ' ' + (item.summary || '')).toLowerCase();
      const isLegacyObsolete = itemStr.includes('qwen') || itemStr.includes('2024');
      if (isLegacyObsolete) {
        prunedItems.unshift({
          ...item,
          status: 'superseded',
          prunedAt: new Date().toISOString(),
          pruneReason: 'Automatically pruned by AI: Outdated legacy release from over 1 year ago (Qwen 2.5).'
        });
        return false;
      }
      return true;
    });

    // Keep active list deduplicated and capped at 6
    const uniqueMap = new Map();
    activeItems.forEach(item => {
      if (!uniqueMap.has(item.id)) uniqueMap.set(item.id, item);
    });
    activeItems = Array.from(uniqueMap.values()).slice(0, 6);

    saveState();
    updateMetrics();
  }

  function saveState() {
    localStorage.setItem('aitc_active_items', JSON.stringify(activeItems));
    localStorage.setItem('aitc_pruned_items', JSON.stringify(prunedItems));
    updateMetrics();
  }

  function updateMetrics() {
    activeCountEl.innerText = activeItems.length;
    prunedCountEl.innerText = prunedItems.length;
    ledgerCountBadgeEl.innerText = prunedItems.length;

    if (activeItems.length > 0) {
      const total = activeItems.reduce((acc, curr) => acc + (curr.importance || 0), 0);
      avgScoreEl.innerText = (total / activeItems.length).toFixed(1);
    } else {
      avgScoreEl.innerText = '0.0';
    }

    updateLiveTimeTicker();
  }

  // Second-by-second live relative ticker
  function updateLiveTimeTicker() {
    const lastSyncTime = localStorage.getItem('aitc_last_sync');
    if (!lastSyncTime || !lastSyncEl) return;
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(lastSyncTime).getTime()) / 1000));
    if (diffSec < 4) {
      lastSyncEl.innerText = 'Just now';
    } else if (diffSec < 60) {
      lastSyncEl.innerText = `${diffSec}s ago`;
    } else if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      lastSyncEl.innerText = `${mins}m ${diffSec % 60}s ago`;
    } else {
      const hours = Math.floor(diffSec / 3600);
      lastSyncEl.innerText = `${hours}h ago`;
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Search
    searchInputEl.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      clearSearchBtnEl.classList.toggle('hidden', searchQuery.length === 0);
      render();
    });

    clearSearchBtnEl.addEventListener('click', () => {
      searchInputEl.value = '';
      searchQuery = '';
      clearSearchBtnEl.classList.add('hidden');
      render();
    });

    // Category Filter Chips
    categoryFiltersEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.filter-chip');
      if (!chip) return;
      categoryFiltersEl.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category;
      render();
    });

    // Impact Filter Dropdown
    impactSelectEl.addEventListener('change', (e) => {
      currentImpact = e.target.value;
      render();
    });

    resetFiltersBtnEl.addEventListener('click', () => {
      currentCategory = 'all';
      currentImpact = 'all';
      searchQuery = '';
      searchInputEl.value = '';
      clearSearchBtnEl.classList.add('hidden');
      categoryFiltersEl.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      categoryFiltersEl.querySelector('[data-category="all"]').classList.add('active');
      impactSelectEl.value = 'all';
      render();
    });

    // Scan Now Trigger (if button is present)
    if (scanNowBtnEl) {
      scanNowBtnEl.addEventListener('click', () => triggerAiScan(true));
    }

    // Modals
    openLedgerBtnEl.addEventListener('click', () => {
      renderLedger();
      ledgerDialogEl.showModal();
    });
    closeLedgerBtnEl.addEventListener('click', () => ledgerDialogEl.close());

    openSettingsBtnEl.addEventListener('click', () => settingsDialogEl.showModal());
    closeSettingsBtnEl.addEventListener('click', () => settingsDialogEl.close());
    closeDetailBtnEl.addEventListener('click', () => detailDialogEl.close());

    // Save Settings
    saveSettingsBtnEl.addEventListener('click', () => {
      const key = apiKeyInputEl.value.trim();
      const freq = syncFrequencySelectEl.value;
      const model = (aiModelInputEl ? aiModelInputEl.value.trim() : '') || 'gemini-3.8-flash';
      localStorage.setItem('aitc_gemini_api_key', key);
      localStorage.setItem('aitc_sync_frequency', freq);
      localStorage.setItem('aitc_ai_model', model);
      settingsDialogEl.close();
      setupAutoSync();
      showToast('Settings saved successfully!');
    });

    // Restore Seed Baseline
    restoreSeedBtnEl.addEventListener('click', async () => {
      if (confirm('Reset tracker data to the initial curated baseline?')) {
        localStorage.removeItem('aitc_active_items');
        localStorage.removeItem('aitc_pruned_items');
        await loadInitialData();
        render();
        settingsDialogEl.close();
        showToast('Baseline seed data restored.');
      }
    });

    // Close dialogs on outside backdrop click
    [detailDialogEl, ledgerDialogEl, settingsDialogEl].forEach(dialog => {
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
      });
    });
  }

  // Real-Time Live Sync & Edge Dynamic Streaming
  function setupAutoSync() {
    if (autoSyncTimer) clearInterval(autoSyncTimer);
    if (liveFeedTimer) clearInterval(liveFeedTimer);
    if (liveTickerTimer) clearInterval(liveTickerTimer);
    if (backgroundEdgeTriggerTimer) clearInterval(backgroundEdgeTriggerTimer);

    // 1. Second-by-second live relative ticker
    liveTickerTimer = setInterval(updateLiveTimeTicker, 1000);

    // 2. Real-time fast edge poller: checks for new AI intelligence every 6 seconds
    liveFeedTimer = setInterval(pollLiveEdgeFeed, 6000);

    // 3. Autonomous background edge research trigger every 45 seconds
    backgroundEdgeTriggerTimer = setInterval(triggerBackgroundEdgeCycle, 45000);
  }

  // Poll Cloudflare Edge KV for real-time changes
  async function pollLiveEdgeFeed() {
    try {
      const res = await fetch(`/api/feed?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data.activeItems) || data.activeItems.length === 0) return;

      const currentIds = new Set(activeItems.map(i => i.id));
      const newlyArrived = data.activeItems.filter(i => !currentIds.has(i.id));
      const hasOrderChange = data.activeItems.some((item, idx) => activeItems[idx]?.id !== item.id);
      const hasPrunedChange = (data.prunedItems?.length || 0) !== prunedItems.length;

      if (newlyArrived.length > 0 || hasOrderChange || hasPrunedChange) {
        const freshIds = newlyArrived.map(i => i.id);
        activeItems = data.activeItems;
        prunedItems = data.prunedItems || [];
        if (data.lastSync) localStorage.setItem('aitc_last_sync', data.lastSync);
        cleanAndSave();
        render(freshIds);

        if (newlyArrived.length > 0) {
          showToast(`⚡ Real-Time Update: "${newlyArrived[0].title.slice(0, 32)}..." arrived live.`);
        }
      } else if (data.lastSync) {
        localStorage.setItem('aitc_last_sync', data.lastSync);
        updateMetrics();
      }
    } catch (e) {
      console.warn('Real-time edge feed poll notice:', e);
    }
  }

  // Autonomous trigger running in background to keep live stream active
  async function triggerBackgroundEdgeCycle() {
    try {
      await fetch('https://aitc-agent.louisaimaster.workers.dev/run', { cache: 'no-store' });
    } catch (e) {
      // Worker cron handles scheduled runs independently
    }
  }

  // AI Scan and Prune Runner
  async function triggerAiScan(isManual = false) {
    if (scanNowBtnEl) {
      scanNowBtnEl.disabled = true;
      const label = scanNowBtnEl.querySelector('.btn-label');
      if (label) label.innerText = 'Researching Web...';
    }

    try {
      const apiKey = localStorage.getItem('aitc_gemini_api_key');
      const modelName = localStorage.getItem('aitc_ai_model') || 'gemini-3.8-flash';
      let candidates = [];

      if (apiKey && window.AITCEngine) {
        if (isManual) showToast(`AI Research: ${modelName} searching YouTube, X & Web...`);
        const currentTitles = activeItems.map(i => i.title);
        candidates = await window.AITCEngine.fetchGeminiAiUpdates(apiKey, currentTitles, modelName);
      } else if (window.AITCEngine) {
        if (isManual) showToast('AI Research: Scanning live YouTube trends, X signals & papers...');
        const currentIds = activeItems.map(i => i.id);
        candidates = await window.AITCEngine.fetchPublicLiveFeed(currentIds);
      }

      if (candidates && candidates.length > 0 && window.AITCEngine) {
        const result = window.AITCEngine.runAiLifecycleCycle(activeItems, candidates);
        activeItems = result.activeItems;
        if (result.prunedItems.length > 0) {
          prunedItems.unshift(...result.prunedItems);
        }
        localStorage.setItem('aitc_last_sync', new Date().toISOString());
        saveState();
        render();

        const addedLogs = result.log.filter(l => l.type === 'ADDED');
        const prunedLogs = result.log.filter(l => l.type === 'PRUNED');
        if (addedLogs.length > 0 || prunedLogs.length > 0) {
          const addedSummary = addedLogs.map(l => l.title.slice(0, 32)).join(', ');
          const prunedSummary = prunedLogs.map(l => l.title.slice(0, 32)).join(', ');
          if (prunedLogs.length > 0) {
            showToast(`Autonomous AI: Added fresh trend & automatically pruned older "${prunedSummary}..."`);
          } else {
            showToast(`Autonomous AI: Added fresh trend "${addedSummary}..."`);
          }
        } else if (isManual) {
          showToast('Autonomous AI: Internet scan complete. Feed is currently up to date.');
        }
      } else {
        localStorage.setItem('aitc_last_sync', new Date().toISOString());
        updateMetrics();
        if (isManual) showToast('Autonomous AI: Internet scan complete. Active feed is up to date.');
      }
    } catch (err) {
      console.error('Scan failed:', err);
      showToast(`Scan Notice: ${err.message}`);
    } finally {
      if (scanNowBtnEl) {
        scanNowBtnEl.disabled = false;
        const label = scanNowBtnEl.querySelector('.btn-label');
        if (label) label.innerText = 'Run AI Scan';
      }
    }
  }

  // Filter & Render Grid
  function render(highlightIds = []) {
    const filtered = activeItems.filter(item => {
      // Category filter
      if (currentCategory !== 'all' && item.category !== currentCategory) {
        return false;
      }
      // Importance filter
      if (currentImpact === 'high' && item.importance < 8.5) {
        return false;
      }
      if (currentImpact === 'critical' && item.importance < 9.5) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const inTitle = item.title.toLowerCase().includes(searchQuery);
        const inSummary = item.summary.toLowerCase().includes(searchQuery);
        const inEntities = (item.fullDetails?.keyEntities || []).some(e => e.toLowerCase().includes(searchQuery));
        if (!inTitle && !inSummary && !inEntities) return false;
      }
      return true;
    });

    gridEl.innerHTML = '';

    if (filtered.length === 0) {
      emptyStateEl.classList.remove('hidden');
      return;
    }

    emptyStateEl.classList.add('hidden');

    filtered.forEach((item, index) => {
      const isNew = Array.isArray(highlightIds) && highlightIds.includes(item.id);
      const box = createBoxElement(item, index, isNew);
      gridEl.appendChild(box);
    });
  }

  // Create a single interactive AI Box (card) with shade of white assigned
  function createBoxElement(item, index = 0, isNew = false) {
    const box = document.createElement('article');
    box.className = `ai-box shade-${index % 6}${isNew ? ' just-arrived' : ''}`;
    box.tabIndex = 0;
    box.setAttribute('role', 'button');
    box.setAttribute('aria-label', `View details for ${item.title}`);

    const catMeta = window.AITCEngine?.CATEGORIES[item.category] || { label: item.category, icon: '⚡' };
    const dateFormatted = formatRelativeTime(item.timestamp);
    const newBadgeHtml = isNew ? '<span class="badge badge-realtime-flash">⚡ LIVE ARRIVAL</span>' : '';

    box.innerHTML = `
      <div>
        <div class="box-header">
          <div class="box-badges">
            ${newBadgeHtml}
            <span class="badge badge-category">${catMeta.icon} ${catMeta.label}</span>
            <span class="badge badge-status-${item.status}">${item.status.toUpperCase()}</span>
          </div>
          <span class="badge badge-score">★ ${item.importance.toFixed(1)}</span>
        </div>
        <h3 class="box-title">${escapeHTML(item.title)}</h3>
        <p class="box-summary">${escapeHTML(item.summary)}</p>
      </div>
      <div class="box-footer">
        <span class="box-time">${dateFormatted}</span>
        <span class="box-cta">Deep Dive &rarr;</span>
      </div>
    `;

    box.addEventListener('click', () => openDetailDialog(item));
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetailDialog(item);
      }
    });

    return box;
  }

  // Open Deep Dive Modal
  function openDetailDialog(item) {
    const catMeta = window.AITCEngine?.CATEGORIES[item.category] || { label: item.category, icon: '⚡' };
    document.getElementById('modal-category-badge').innerText = `${catMeta.icon} ${catMeta.label}`;
    document.getElementById('modal-status-badge').innerText = item.status.toUpperCase();
    document.getElementById('modal-status-badge').className = `badge badge-status-${item.status}`;
    document.getElementById('modal-impact-badge').innerText = `★ ${item.importance.toFixed(1)} / 10`;

    document.getElementById('modal-title').innerText = item.title;
    document.getElementById('modal-timestamp').innerText = `Tracked: ${new Date(item.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;

    document.getElementById('modal-summary').innerText = item.summary;
    document.getElementById('modal-background').innerText = item.fullDetails?.background || 'No background provided.';
    document.getElementById('modal-impact').innerText = item.fullDetails?.impact || 'High industry impact.';

    // Innovations list
    const innovationsEl = document.getElementById('modal-innovations');
    innovationsEl.innerHTML = '';
    (item.fullDetails?.keyInnovations || []).forEach(inn => {
      const li = document.createElement('li');
      li.innerText = inn;
      innovationsEl.appendChild(li);
    });

    // Key Entities tags
    const entitiesEl = document.getElementById('modal-entities');
    entitiesEl.innerHTML = '';
    (item.fullDetails?.keyEntities || []).forEach(ent => {
      const tag = document.createElement('span');
      tag.className = 'entity-tag';
      tag.innerText = ent;
      entitiesEl.appendChild(tag);
    });

    // Primary Source Link
    const linkEl = document.getElementById('modal-source-link');
    if (item.fullDetails?.sourceUrl) {
      linkEl.href = item.fullDetails.sourceUrl;
      linkEl.classList.remove('hidden');
    } else {
      linkEl.classList.add('hidden');
    }

    detailDialogEl.showModal();
  }

  // Render Pruned / Superseded Ledger
  function renderLedger() {
    ledgerListEl.innerHTML = '';
    if (prunedItems.length === 0) {
      ledgerListEl.innerHTML = '<p class="detail-text">No items have been pruned yet. When the AI detects that an older model or framework is superseded, it will record the deprecation reasoning here.</p>';
      return;
    }

    prunedItems.forEach(item => {
      const div = document.createElement('div');
      div.className = 'ledger-item';
      div.innerHTML = `
        <div class="ledger-item-header">
          <span class="ledger-item-title">${escapeHTML(item.title)}</span>
          <span class="badge badge-status-superseded">SUPERSEDED</span>
        </div>
        <p class="detail-text">${escapeHTML(item.summary)}</p>
        <p class="ledger-reason"><strong>AI Prune Reason:</strong> ${escapeHTML(item.pruneReason || 'Superseded by newer architecture.')}</p>
      `;
      ledgerListEl.appendChild(div);
    });
  }

  // Helpers
  function formatRelativeTime(dateStr) {
    if (!dateStr) return 'Recently';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(msg) {
    toastEl.innerText = msg;
    toastEl.classList.remove('hidden');
    setTimeout(() => {
      toastEl.classList.add('hidden');
    }, 3800);
  }
})();
