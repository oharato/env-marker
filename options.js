// options.js
'use strict';

const patternsEl = document.getElementById('patterns');
const colorEl = document.getElementById('color');
const bannerSizeEl = document.getElementById('bannerSize');
const positionOptions = document.getElementById('position-options');

async function load() {
  // sync を優先して読み込み、空なら local をフォールバック
  const data = await chrome.storage.sync.get({patterns: [], color: '#ff6666', bannerPosition: 'top', bannerSize: 4});
  let { patterns, color, bannerPosition, bannerSize } = data;

  // syncが空、または主要なデータがなければlocalを試す
  if (!patterns || patterns.length === 0) {
    const fallback = await chrome.storage.local.get({patterns: [], color: '#ff6666', bannerPosition: 'top', bannerSize: 4});
    console.debug('[env-marker][options] Trying to load from local storage fallback.');
    patterns = fallback.patterns || patterns;
    color = fallback.color || color;
    bannerPosition = fallback.bannerPosition || bannerPosition;
    bannerSize = fallback.bannerSize || bannerSize;
  }
  
  console.debug('[env-marker][options] Loaded data:', { patterns, color, bannerPosition, bannerSize });

  patternsEl.value = (patterns || []).join('\n');
  colorEl.value = color || '#ff6666';
  bannerSizeEl.value = bannerSize || 4;
  
  const positionToSet = bannerPosition || 'top';
  const positionRadio = document.querySelector(`input[name="position"][value="${positionToSet}"]`);
  
  if (positionRadio) {
    positionRadio.checked = true;
  } else {
    // もし該当するラジオボタンがなければ、安全のために 'top' を選択状態にする
    console.warn(`[env-marker][options] Could not find radio button for position: "${positionToSet}", defaulting to "top".`);
    document.querySelector('input[name="position"][value="top"]').checked = true;
  }
}

async function save() {
  const patterns = patternsEl.value.split(/\s+/).filter(Boolean);
  const color = colorEl.value;
  const bannerPosition = document.querySelector('input[name="position"]:checked').value;
  const bannerSize = parseInt(bannerSizeEl.value, 10) || 4;

  // sync と local の両方に保存してフォールバックを安定させる
  await chrome.storage.sync.set({patterns, color, bannerPosition, bannerSize});
  await chrome.storage.local.set({patterns, color, bannerPosition, bannerSize});
  console.info('[env-marker][options] Settings auto-saved.', {patterns, color, bannerPosition, bannerSize});
}

// 各要素の変更イベントをリッスンして自動保存
patternsEl.addEventListener('change', save);
colorEl.addEventListener('change', save);
bannerSizeEl.addEventListener('change', save);
positionOptions.addEventListener('change', save);

// 初回ロード
load().catch(e => console.error(e));
