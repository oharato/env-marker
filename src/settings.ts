import { DEFAULT_SETTINGS } from './constants';

export interface EnvMarkerSetting {
  key: string;
  name: string;
  patterns: string[];
  color: string;
  bannerPosition: string;
  bannerSize: number;
  enabled: boolean;
}

export const SETTING_KEYS = ['setting1', 'setting2', 'setting3', 'setting4', 'setting5'];

export async function loadSetting(key: string): Promise<EnvMarkerSetting> {
  const defaults = {
    [`${key}_patterns`]: [],
    [`${key}_color`]: DEFAULT_SETTINGS.COLOR,
    [`${key}_bannerPosition`]: DEFAULT_SETTINGS.BANNER_POSITION,
    [`${key}_bannerSize`]: DEFAULT_SETTINGS.BANNER_SIZE,
    [`${key}_enabled`]: DEFAULT_SETTINGS.ENABLED,
    [`${key}_name`]: key
  };

  const syncData = await chrome.storage.sync.get(defaults) as any;
  let patterns = syncData[`${key}_patterns`];
  let color = syncData[`${key}_color`];
  let bannerPosition = syncData[`${key}_bannerPosition`];
  let bannerSize = syncData[`${key}_bannerSize`];
  let enabled = syncData[`${key}_enabled`];
  let name = syncData[`${key}_name`];

  // Fallback to local if patterns are empty (legacy support or sync issues)
  // Check if patterns are empty
  if (!patterns || patterns.length === 0) {
    const localData = await chrome.storage.local.get(defaults) as any;
    // If local has patterns, use them
    if (localData[`${key}_patterns`] && localData[`${key}_patterns`].length > 0) {
       patterns = localData[`${key}_patterns`];
       // If we fell back for patterns, it's safer to trust local for other props too if sync was default
       color = (color === DEFAULT_SETTINGS.COLOR && localData[`${key}_color`]) ? localData[`${key}_color`] : color;
       bannerPosition = (bannerPosition === DEFAULT_SETTINGS.BANNER_POSITION && localData[`${key}_bannerPosition`]) ? localData[`${key}_bannerPosition`] : bannerPosition;
       bannerSize = (bannerSize === DEFAULT_SETTINGS.BANNER_SIZE && localData[`${key}_bannerSize`]) ? localData[`${key}_bannerSize`] : bannerSize;
       name = (name === key && localData[`${key}_name`]) ? localData[`${key}_name`] : name;
    }
  }

  return {
    key,
    name: name || key,
    patterns: patterns || [],
    color: color || DEFAULT_SETTINGS.COLOR,
    bannerPosition: bannerPosition || DEFAULT_SETTINGS.BANNER_POSITION,
    bannerSize: bannerSize || DEFAULT_SETTINGS.BANNER_SIZE,
    enabled: enabled !== false
  };
}

export async function loadAllEnabledSettings(): Promise<EnvMarkerSetting[]> {
  const settings: EnvMarkerSetting[] = [];
  for (const key of SETTING_KEYS) {
    const s = await loadSetting(key);
    if (s.enabled) {
      settings.push(s);
    }
  }
  return settings;
}
