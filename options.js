// options.js
'use strict';

const patternsEl = document.getElementById('patterns');
const colorEl = document.getElementById('color');
const saveBtn = document.getElementById('save');
const loadBtn = document.getElementById('load');

async function load() {
  // sync を優先して読み込み、空なら local をフォールバック
  const data = await chrome.storage.sync.get({patterns: [], color: '#ff6666'});
  let patterns = data.patterns || [];
  let color = data.color || '#ff6666';
  if ((!patterns || patterns.length === 0) || !color) {
    const fallback = await chrome.storage.local.get({patterns: [], color: '#ff6666'});
    if ((!patterns || patterns.length === 0) && fallback.patterns && fallback.patterns.length) {
      patterns = fallback.patterns;
      console.debug('[env-marker][options] loaded patterns from local fallback', patterns);
    }
    if ((!color || color === '') && fallback.color) {
      color = fallback.color;
    }
  }
  patternsEl.value = (patterns || []).join('\n');
  colorEl.value = color || '#ff6666';
}

saveBtn.addEventListener('click', async () => {
  const patterns = patternsEl.value.split(/\s+/).filter(Boolean);
  const color = colorEl.value;
  // sync と local の両方に保存してフォールバックを安定させる
  await chrome.storage.sync.set({patterns, color});
  await chrome.storage.local.set({patterns, color});
  console.info('[env-marker][options] saved patterns to sync and local', patterns, color);
  alert('保存しました');
});

loadBtn.addEventListener('click', load);
// 初回ロード
load().catch(e => console.error(e));
