// options.js
'use strict';

const settingSelectorEl = document.getElementById('setting-selector');
const patternsEl = document.getElementById('patterns');
const colorEl = document.getElementById('color');
const colorPresetsEl = document.getElementById('color-presets');
const bannerSizeEl = document.getElementById('bannerSize');
const positionOptions = document.getElementById('position-options');

async function load() {
  // Get current setting selection (defaults to setting1)
  const { currentSetting } = await chrome.storage.sync.get({currentSetting: 'setting1'});
  settingSelectorEl.value = currentSetting;
  
  // Load settings for the current profile
  await loadSettingProfile(currentSetting);
}

async function loadSettingProfile(settingKey) {
  // Load from sync storage with defaults
  const defaultSettings = {
    [`${settingKey}_patterns`]: [],
    [`${settingKey}_color`]: '#ff6666',
    [`${settingKey}_bannerPosition`]: 'top',
    [`${settingKey}_bannerSize`]: 4
  };
  
  const data = await chrome.storage.sync.get(defaultSettings);
  let patterns = data[`${settingKey}_patterns`];
  let color = data[`${settingKey}_color`];
  let bannerPosition = data[`${settingKey}_bannerPosition`];
  let bannerSize = data[`${settingKey}_bannerSize`];

  // Fallback to local storage if sync is empty
  if (!patterns || patterns.length === 0) {
    const fallback = await chrome.storage.local.get(defaultSettings);
    console.debug('[env-marker][options] Trying to load from local storage fallback.');
    patterns = fallback[`${settingKey}_patterns`] || patterns;
    color = fallback[`${settingKey}_color`] || color;
    bannerPosition = fallback[`${settingKey}_bannerPosition`] || bannerPosition;
    bannerSize = fallback[`${settingKey}_bannerSize`] || bannerSize;
  }
  
  console.debug('[env-marker][options] Loaded data:', { settingKey, patterns, color, bannerPosition, bannerSize });

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
  const currentSetting = settingSelectorEl.value;
  const patterns = patternsEl.value.split(/\s+/).filter(Boolean);
  const color = colorEl.value;
  const bannerPosition = document.querySelector('input[name="position"]:checked').value;
  
  let bannerSize = parseInt(bannerSizeEl.value, 10);
  if (isNaN(bannerSize) || bannerSize < 1) {
    bannerSize = 4; // 不正な値や1未満の場合はデフォルト値にフォールバック
  }

  console.debug('[env-marker][options] Saving bannerSize:', bannerSize);

  // Save with setting-specific keys
  const settingsData = {
    [`${currentSetting}_patterns`]: patterns,
    [`${currentSetting}_color`]: color,
    [`${currentSetting}_bannerPosition`]: bannerPosition,
    [`${currentSetting}_bannerSize`]: bannerSize
  };

  // sync と local の両方に保存してフォールバックを安定させる
  await chrome.storage.sync.set(settingsData);
  await chrome.storage.local.set(settingsData);
  console.info('[env-marker][options] Settings auto-saved.', settingsData);
}

// --- イベントリスナー ---

// Setting selector change - save current setting preference and load new profile
settingSelectorEl.addEventListener('change', async () => {
  const newSetting = settingSelectorEl.value;
  await chrome.storage.sync.set({ currentSetting: newSetting });
  await chrome.storage.local.set({ currentSetting: newSetting });
  await loadSettingProfile(newSetting);
  console.info('[env-marker][options] Switched to:', newSetting);
});

// プリセットカラーが選択されたら、カラーピッカーの値を更新して保存をトリガー
colorPresetsEl.addEventListener('change', () => {
  const selectedColor = colorPresetsEl.value;
  if (selectedColor) {
    colorEl.value = selectedColor;
    // カラーピッカーのchangeイベントを発火させて、自動保存ロジックを呼び出す
    colorEl.dispatchEvent(new Event('change'));
  }
});

// 各要素の変更イベントをリッスンして自動保存
patternsEl.addEventListener('change', save);
colorEl.addEventListener('change', save);
bannerSizeEl.addEventListener('change', save);
positionOptions.addEventListener('change', save);

// 初回ロード
load().catch(e => console.error(e));
