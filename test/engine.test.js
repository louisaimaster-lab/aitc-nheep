// Test suite for AITC AI Engine
// ponytail: assert-based runnable check, zero external test dependencies

const assert = require('assert');
const {
  IMPORTANCE_THRESHOLD,
  isImportantEnough,
  checkSuperseded,
  runAiLifecycleCycle
} = require('../ai-engine.js');

console.log('Running AITC Engine verification tests...\n');

// Test 1: Importance Threshold filter
const lowImportanceItem = {
  id: 'trivial-chatbot-wrapper',
  title: 'Yet Another Chatbot UI Wrapper',
  importance: 4.5,
  category: 'agents'
};
const highImportanceItem = {
  id: 'gpt-5-frontier',
  title: 'Frontier Architecture Leap',
  importance: 9.9,
  category: 'models'
};

assert.strictEqual(isImportantEnough(lowImportanceItem), false, 'Low importance item should be rejected');
assert.strictEqual(isImportantEnough(highImportanceItem), true, 'High importance item should be accepted');
console.log('✓ Test 1 Passed: Importance thresholding behaves correctly (< 7.0 rejected, >= 7.0 accepted).');

// Test 2: Superseded detection
const existingItem = {
  id: 'deepseek-v2-moe',
  title: 'DeepSeek V2 Mixture-of-Experts',
  importance: 8.0,
  category: 'opensource'
};
const candidateNewItem = {
  id: 'deepseek-v3-moe',
  title: 'DeepSeek V3 671B MoE Upgrade',
  importance: 9.0,
  category: 'opensource'
};

const checkResult = checkSuperseded(existingItem, candidateNewItem);
assert.strictEqual(checkResult.superseded, true, 'Older DeepSeek model should be flagged as superseded');
assert(checkResult.reason.includes('Superseded by newer release'), 'Reason must explain the version upgrade');
console.log('✓ Test 2 Passed: Superseded model detection functions properly.');

// Test 3: Lifecycle cycle execution (Add high-impact, prune obsolete, reject trivial)
const seedItems = [
  {
    id: 'deepseek-v2-moe',
    title: 'DeepSeek V2 Model',
    importance: 8.0,
    timestamp: '2024-05-01T00:00:00Z',
    category: 'opensource'
  },
  {
    id: 'claude-3-5-sonnet',
    title: 'Claude 3.5 Sonnet Model',
    importance: 9.2,
    timestamp: '2024-06-20T00:00:00Z',
    category: 'models'
  }
];

const candidates = [
  // Candidate 1: High importance, supersedes deepseek-v2
  {
    id: 'deepseek-v3-moe',
    title: 'DeepSeek V3 Model',
    importance: 9.1,
    timestamp: '2025-12-26T00:00:00Z',
    category: 'opensource'
  },
  // Candidate 2: Low importance, should be rejected
  {
    id: 'spammy-crypto-ai-agent',
    title: 'Crypto AI Token Bot',
    importance: 3.2,
    timestamp: '2026-01-01T00:00:00Z',
    category: 'agents'
  }
];

const { activeItems, prunedItems, log } = runAiLifecycleCycle(seedItems, candidates);

// Check that low importance was rejected
const rejectedLog = log.find(l => l.type === 'REJECTED');
assert(rejectedLog, 'Must log rejected item');
assert.strictEqual(rejectedLog.id, 'spammy-crypto-ai-agent');

// Check that deepseek-v2 was pruned
const prunedV2 = prunedItems.find(p => p.id === 'deepseek-v2-moe');
assert(prunedV2, 'DeepSeek V2 must be in pruned items');
assert.strictEqual(prunedV2.status, 'superseded');

// Check that active items contain deepseek-v3 and claude-3-5
const activeIds = activeItems.map(a => a.id);
assert(activeIds.includes('deepseek-v3-moe'), 'DeepSeek V3 must be active');
assert(activeIds.includes('claude-3-5-sonnet'), 'Claude 3.5 Sonnet must be active');
assert(!activeIds.includes('deepseek-v2-moe'), 'DeepSeek V2 must NOT be in active items');
assert(!activeIds.includes('spammy-crypto-ai-agent'), 'Low importance item must NOT be active');

console.log('✓ Test 3 Passed: AI Lifecycle cycle accurately ingests, prunes, and updates active items.');
console.log('\nAll AITC Engine verification tests passed successfully! 🚀');
