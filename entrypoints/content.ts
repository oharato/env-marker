import { matchesPattern } from '../src/ipMatcher';
import { showBanner, applySettingsPayload, updateBannerFromStorageForLast } from '../src/content/banner';
import { DEFAULT_SETTINGS } from '../src/constants';
import { loadAllEnabledSettings, loadSetting } from '../src/settings';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',

  main: async () => {
    try {
      const url = location.href;
      console.debug('[env-marker][content] Initializing content script for:', url);

      try {
        chrome.runtime.onMessage.addListener((msg: any) => {
          try {
            console.debug('[env-marker][content] Received message:', msg);
            if (msg && msg.type === 'show-env-marker-banner' && msg.text) {
              (async () => {
                try {
                  const msgColor = (msg && msg.color) ? String(msg.color) : DEFAULT_SETTINGS.COLOR;
                  const msgText = msg && msg.text ? String(msg.text) : '';
                  let position: string | undefined = msg.position as any;
                  let size: number | undefined = msg.size as any;
                  
                  // Fallback if position/size are missing (legacy support or direct calls)
                  if (!position || !size) {
                    const { currentSetting } = await chrome.storage.sync.get({ currentSetting: 'setting1' });
                    const setting = await loadSetting(currentSetting);
                    position = position || setting.bannerPosition;
                    size = size || setting.bannerSize;
                  }
                  showBanner(msgText, msgColor, position as string, size as number);
                } catch (e) {
                  console.error('[env-marker][content] message async handler error', e);
                }
              })();
            }

            if (msg && msg.type === 'env-marker-settings-changed') {
              try {
                if (msg.patterns || msg.settingKey) {
                  applySettingsPayload(msg);
                } else {
                  updateBannerFromStorageForLast();
                }
              } catch (e) {
                console.error('[env-marker][content] failed to handle settings-changed message', e);
              }
            }
          } catch (e) {
            console.error('[env-marker][content] message listener error', e);
          }
          // Return true if we wanted to sendResponse asynchronously, but we don't here.
        });
      } catch (e) {
        console.error('[env-marker][content] failed to attach onMessage listener', e);
      }

      await evaluatePatternsAndShow();
    } catch (e) {
      console.error(e);
    }

    async function evaluatePatternsAndShow() {
      try {
        const url = location.href;
        const allSettings = await loadAllEnabledSettings();
        
        for (const setting of allSettings) {
          const matchedPattern = setting.patterns.find((pattern: string) => matchesPattern(pattern, undefined, url));

          if (matchedPattern) {
            console.info('[env-marker][content] Pattern matched. Showing banner.', { settingKey: setting.key, matchedPattern });
            showBanner(matchedPattern, setting.color, setting.bannerPosition, setting.bannerSize);
            return;
          }
        }
        console.debug('[env-marker][content] No pattern matched.');
      } catch (e) {
        console.error('[env-marker][content] evaluatePatternsAndShow error', e);
      }
    }
  },
});

// Listen for storage changes and update the banner when relevant
try {
  chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
    try {
      updateBannerFromStorageForLast();
    } catch (e) {
      console.error('[env-marker][content] storage.onChanged handler error', e);
    }
  });
} catch (e) {
  console.error('[env-marker][content] failed to attach storage.onChanged listener', e);
}