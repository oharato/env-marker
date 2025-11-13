// options.ts
'use strict';

const settingSelectorEl = document.getElementById('setting-selector') as HTMLSelectElement | null;
const patternsEl = document.getElementById('patterns') as HTMLTextAreaElement | null;
const colorEl = document.getElementById('color') as HTMLInputElement | null;
const colorPresetsEl = document.getElementById('color-presets') as HTMLSelectElement | null;
const bannerSizeEl = document.getElementById('bannerSize') as HTMLInputElement | null;
const positionOptions = document.getElementById('position-options') as HTMLElement | null;

async function load(): Promise<void> {
  // Get current setting selection (defaults to setting1)
  const { currentSetting } = await chrome.storage.sync.get({currentSetting: 'setting1'}) as { currentSetting: string };
  if (settingSelectorEl) {
    settingSelectorEl.value = currentSetting;
  }
  
  // Load settings for the current profile
  await loadSettingProfile(currentSetting);
}

async function loadSettingProfile(settingKey: string): Promise<void> {
  // Load from sync storage with defaults
  const defaultSettings = {
    [`${settingKey}_patterns`]: [],
    [`${settingKey}_color`]: '#ff6666',
    [`${settingKey}_bannerPosition`]: 'top',
    [`${settingKey}_bannerSize`]: 4
  };
  
  const data = await chrome.storage.sync.get(defaultSettings) as Record<string, any>;
  let patterns: string[] = data[`${settingKey}_patterns`];
  let color: string = data[`${settingKey}_color`];
  let bannerPosition: string = data[`${settingKey}_bannerPosition`];
  let bannerSize: number = data[`${settingKey}_bannerSize`];

  // Fallback to local storage if sync is empty
  if (!patterns || patterns.length === 0) {
    const fallback = await chrome.storage.local.get(defaultSettings) as Record<string, any>;
    console.debug('[env-marker][options] Trying to load from local storage fallback.');
    patterns = fallback[`${settingKey}_patterns`] || patterns;
    color = fallback[`${settingKey}_color`] || color;
    bannerPosition = fallback[`${settingKey}_bannerPosition`] || bannerPosition;
    bannerSize = fallback[`${settingKey}_bannerSize`] || bannerSize;
  }
  
  console.debug('[env-marker][options] Loaded data:', { settingKey, patterns, color, bannerPosition, bannerSize });

  if (patternsEl) {
    patternsEl.value = (patterns || []).join('\n');
  }
  if (colorEl) {
    colorEl.value = color || '#ff6666';
  }
  if (bannerSizeEl) {
    bannerSizeEl.value = String(bannerSize || 4);
  }
  
  const positionToSet = bannerPosition || 'top';
  const positionRadio = document.querySelector(`input[name="position"][value="${positionToSet}"]`) as HTMLInputElement | null;
  
  if (positionRadio) {
    positionRadio.checked = true;
  } else {
    // もし該当するラジオボタンがなければ、安全のために 'top' を選択状態にする
    console.warn(`[env-marker][options] Could not find radio button for position: "${positionToSet}", defaulting to "top".`);
    const topRadio = document.querySelector('input[name="position"][value="top"]') as HTMLInputElement | null;
    if (topRadio) {
      topRadio.checked = true;
    }
  }
}

async function save(): Promise<void> {
  if (!settingSelectorEl || !patternsEl || !colorEl || !bannerSizeEl) return;

  const currentSetting = settingSelectorEl.value;
  const patterns = patternsEl.value.split(/\n/).filter(Boolean);
  const color = colorEl.value;
  
  const checkedPositionEl = document.querySelector('input[name="position"]:checked') as HTMLInputElement | null;
  const bannerPosition = checkedPositionEl ? checkedPositionEl.value : 'top';
  
  let bannerSize = parseInt(bannerSizeEl.value, 10);
  if (isNaN(bannerSize) || bannerSize < 1) {
    bannerSize = 4; // 不正な値や1未満の場合はデフォルト値にフォールバック
  }

  console.debug('[env-marker][options] Saving settings:', { currentSetting, patterns, color, bannerPosition, bannerSize });

  // Save with setting-specific keys
  const settingsData: Record<string, any> = {
    [`${currentSetting}_patterns`]: patterns,
    [`${currentSetting}_color`]: color,
    [`${currentSetting}_bannerPosition`]: bannerPosition,
    [`${currentSetting}_bannerSize`]: bannerSize
  };

  // sync と local の両方に保存してフォールバックを安定させる
  await chrome.storage.sync.set(settingsData);
  await chrome.storage.local.set(settingsData);
  console.info('[env-marker][options] Settings auto-saved.', settingsData);
  
  // すべてのタブに設定変更を通知して即座に反映
  await notifyAllTabs();
}

// すべてのタブに設定変更を通知
async function notifyAllTabs(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        // タブをリロード
        chrome.tabs.reload(tab.id).catch(() => {
          // エラーは無視（タブが閉じられた場合など）
        });
      }
    }
    console.debug('[env-marker][options] Notified all tabs to reload');
  } catch (e) {
    console.error('[env-marker][options] Failed to notify tabs:', e);
  }
}

// --- イベントリスナー ---

if (settingSelectorEl) {
  settingSelectorEl.addEventListener('change', async () => {
    const newSetting = settingSelectorEl.value;
    await chrome.storage.sync.set({ currentSetting: newSetting });
    await chrome.storage.local.set({ currentSetting: newSetting });
    await loadSettingProfile(newSetting);
    console.info('[env-marker][options] Switched to:', newSetting);
  });
}

if (colorPresetsEl) {
  colorPresetsEl.addEventListener('change', () => {
    const selectedColor = colorPresetsEl.value;
    if (selectedColor && colorEl) {
      colorEl.value = selectedColor;
      // カラーピッカーのchangeイベントを発火させて、自動保存ロジックを呼び出す
      colorEl.dispatchEvent(new Event('change'));
    }
  });
}

if (patternsEl) patternsEl.addEventListener('change', save);
if (colorEl) colorEl.addEventListener('change', save);
if (bannerSizeEl) bannerSizeEl.addEventListener('change', save);
if (positionOptions) positionOptions.addEventListener('change', save);

// 初回ロード
load().catch(e => console.error(e));
