// options.ts
'use strict';

const settingSelectorEl = document.getElementById('setting-selector') as HTMLSelectElement | null;
const settingNameEl = document.getElementById('setting-name') as HTMLInputElement | null;
const patternsEl = document.getElementById('patterns') as HTMLTextAreaElement | null;
const colorEl = document.getElementById('color') as HTMLInputElement | null;
const colorPresetsEl = document.getElementById('color-presets') as HTMLSelectElement | null;
const bannerSizeEl = document.getElementById('bannerSize') as HTMLInputElement | null;
const positionOptions = document.getElementById('position-options') as HTMLElement | null;
const enabledEl = document.getElementById('enabled') as HTMLInputElement | null;

// 初回ロード時にすべての設定名を読み込んでセレクトボックスを更新
async function loadAllSettingNames(): Promise<void> {
  const allSettings = ['setting1', 'setting2', 'setting3', 'setting4', 'setting5'];
  
  for (const settingKey of allSettings) {
    const data = await chrome.storage.sync.get({ [`${settingKey}_name`]: settingKey }) as Record<string, any>;
    const name = data[`${settingKey}_name`] || settingKey;
    updateSelectorDisplay(settingKey, name);
  }
}

async function load(): Promise<void> {
  // すべての設定名を読み込む
  await loadAllSettingNames();
  
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
  const defaultName = settingKey; // デフォルト名はsettingKeyと同じ
  const defaultSettings = {
    [`${settingKey}_patterns`]: [],
    [`${settingKey}_color`]: '#ff6666',
    [`${settingKey}_bannerPosition`]: 'top',
    [`${settingKey}_bannerSize`]: 4,
    [`${settingKey}_enabled`]: true,
    [`${settingKey}_name`]: defaultName
  };
  
  const data = await chrome.storage.sync.get(defaultSettings) as Record<string, any>;
  let patterns: string[] = data[`${settingKey}_patterns`];
  let color: string = data[`${settingKey}_color`];
  let bannerPosition: string = data[`${settingKey}_bannerPosition`];
  let bannerSize: number = data[`${settingKey}_bannerSize`];
  let enabled: boolean = data[`${settingKey}_enabled`] !== false;
  let name: string = data[`${settingKey}_name`] || defaultName;

  // Fallback to local storage if sync is empty
  if (!patterns || patterns.length === 0) {
    const fallback = await chrome.storage.local.get(defaultSettings) as Record<string, any>;
    console.debug('[env-marker][options] Trying to load from local storage fallback.');
    patterns = fallback[`${settingKey}_patterns`] || patterns;
    color = fallback[`${settingKey}_color`] || color;
    bannerPosition = fallback[`${settingKey}_bannerPosition`] || bannerPosition;
    bannerSize = fallback[`${settingKey}_bannerSize`] || bannerSize;
    enabled = fallback[`${settingKey}_enabled`] !== false;
    name = fallback[`${settingKey}_name`] || defaultName;
  }
  
  console.debug('[env-marker][options] Loaded data:', { settingKey, patterns, color, bannerPosition, bannerSize, enabled, name });

  if (patternsEl) {
    patternsEl.value = (patterns || []).join('\n');
  }
  if (colorEl) {
    colorEl.value = color || '#ff6666';
  }
  if (bannerSizeEl) {
    bannerSizeEl.value = String(bannerSize || 4);
  }
  if (enabledEl) {
    enabledEl.checked = enabled;
  }
  if (settingNameEl) {
    settingNameEl.value = name;
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
  if (!settingSelectorEl || !patternsEl || !colorEl || !bannerSizeEl || !enabledEl || !settingNameEl) return;

  const currentSetting = settingSelectorEl.value;
  const patterns = patternsEl.value.split(/\s+/).filter(Boolean);
  const color = colorEl.value;
  const enabled = enabledEl.checked;
  const name = settingNameEl.value.trim();
  
  const checkedPositionEl = document.querySelector('input[name="position"]:checked') as HTMLInputElement | null;
  const bannerPosition = checkedPositionEl ? checkedPositionEl.value : 'top';
  
  let bannerSize = parseInt(bannerSizeEl.value, 10);
  if (isNaN(bannerSize) || bannerSize < 1) {
    bannerSize = 4; // 不正な値や1未満の場合はデフォルト値にフォールバック
  }

  console.debug('[env-marker][options] Saving settings:', { currentSetting, patterns, color, bannerPosition, bannerSize, enabled, name });

  // Save with setting-specific keys
  const settingsData: Record<string, any> = {
    [`${currentSetting}_patterns`]: patterns,
    [`${currentSetting}_color`]: color,
    [`${currentSetting}_bannerPosition`]: bannerPosition,
    [`${currentSetting}_bannerSize`]: bannerSize,
    [`${currentSetting}_enabled`]: enabled,
    [`${currentSetting}_name`]: name
  };

  // sync と local の両方に保存してフォールバックを安定させる
  await chrome.storage.sync.set(settingsData);
  await chrome.storage.local.set(settingsData);
  console.info('[env-marker][options] Settings auto-saved.', settingsData);
  
  // セレクトボックスの表示を更新
  updateSelectorDisplay(currentSetting, name);
  
  // すべてのタブに設定変更を通知して即座に反映
  await notifyAllTabs();
}

// セレクトボックスの表示を更新
function updateSelectorDisplay(settingKey: string, name: string): void {
  if (!settingSelectorEl) return;
  
  const option = settingSelectorEl.querySelector(`option[value="${settingKey}"]`) as HTMLOptionElement | null;
  if (option) {
    const defaultName = option.getAttribute('data-default-name') || settingKey;
    option.textContent = name ? name : defaultName;
  }
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
      // 色を変更したら即座に保存
      save();
    }
  });
}

// フォーカスが外れたときに保存
if (patternsEl) patternsEl.addEventListener('blur', save);
if (colorEl) colorEl.addEventListener('blur', save);
if (bannerSizeEl) bannerSizeEl.addEventListener('blur', save);
if (settingNameEl) settingNameEl.addEventListener('blur', save);

// チェックボックスとラジオボタンは即座に保存
if (positionOptions) positionOptions.addEventListener('change', save);
if (enabledEl) enabledEl.addEventListener('change', save);

// 初回ロード
load().catch(e => console.error(e));
