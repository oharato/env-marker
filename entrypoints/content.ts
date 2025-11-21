import { matchesPattern } from '../src/ipMatcher';
import { showBanner, applySettingsPayload, updateBannerFromStorageForLast } from '../src/content/banner';

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
            console.debug('[env-marker][content] Early Received message:', msg);
            if (msg && msg.type === 'show-env-marker-banner' && msg.text) {
              (async () => {
                try {
                  const msgColor = (msg && msg.color) ? String(msg.color) : '#ff6666';
                  const msgText = msg && msg.text ? String(msg.text) : '';
                  let position: string | undefined = msg.position as any;
                  let size: number | undefined = msg.size as any;
                  if (!position || !size) {
                    const { currentSetting } = await chrome.storage.sync.get({ currentSetting: 'setting1' });
                    const data = await chrome.storage.sync.get({
                      [`${currentSetting}_bannerPosition`]: 'top',
                      [`${currentSetting}_bannerSize`]: 40
                    });
                    const dataAny = data as any;
                    position = position || (dataAny[`${currentSetting}_bannerPosition`] as string) || 'top';
                    size = size || (dataAny[`${currentSetting}_bannerSize`] as number) || 40;
                  }
                  showBanner(msgText, msgColor, position as string, size as number);
                } catch (e) {
                  console.error('[env-marker][content] early listener async handler error', e);
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
            console.error('[env-marker][content] early listener error', e);
          }
        });
      } catch (e) {
        console.error('[env-marker][content] failed to attach early onMessage listener', e);
      }

      await evaluatePatternsAndShow();
    } catch (e) {
      console.error(e);
    }

    chrome.runtime.onMessage.addListener(async (msg: any) => {
      console.debug('[env-marker][content] Received message:', msg);
      if (msg && msg.type === 'show-env-marker-banner' && msg.text) {
        const { currentSetting } = await chrome.storage.sync.get({currentSetting: 'setting1'});
        const settingKey = currentSetting;

        const data = await chrome.storage.sync.get({ 
          [`${settingKey}_bannerPosition`]: 'top',
          [`${settingKey}_bannerSize`]: 4
        });
        const dataAny = data as any;
        const bannerPosition = (dataAny[`${settingKey}_bannerPosition`] as string) || 'top';
        const bannerSize = (dataAny[`${settingKey}_bannerSize`] as number) || 4;

        console.info('[env-marker][content] Message requests banner. Loaded data:', { bannerPosition, bannerSize });
        const msgColor = (msg && msg.color) ? String(msg.color) : '#ff6666';
        const msgText = msg && msg.text ? String(msg.text) : '';
        showBanner(msgText, msgColor, bannerPosition, bannerSize);
      }
    });

    async function evaluatePatternsAndShow() {
      try {
        const url = location.href;
        const allSettings = ['setting1', 'setting2', 'setting3', 'setting4', 'setting5'];
        for (const settingKey of allSettings) {
          const data = await chrome.storage.sync.get({
            [`${settingKey}_patterns`]: [],
            [`${settingKey}_color`]: '#ff6666',
            [`${settingKey}_bannerPosition`]: 'top',
            [`${settingKey}_bannerSize`]: 40,
            [`${settingKey}_enabled`]: true
          });
          const dataAny = data as any;
          const enabled = dataAny[`${settingKey}_enabled`];
          if (!enabled) continue;

          const patterns = (dataAny[`${settingKey}_patterns`] as string[]) || [];
          const color = (dataAny[`${settingKey}_color`] as string) || '#ff6666';
          const bannerPosition = (dataAny[`${settingKey}_bannerPosition`] as string) || 'top';
          const bannerSize = (dataAny[`${settingKey}_bannerSize`] as number) || 40;

          const matchedPattern = patterns.find((pattern: string) => matchesPattern(pattern, undefined, url));

          if (matchedPattern) {
            console.info('[env-marker][content] Pattern matched. Showing banner.', { settingKey, matchedPattern });
            showBanner(matchedPattern, color, bannerPosition, bannerSize);
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

// Banner helpers moved to `src/content/banner.ts` (imported at top).
// The content script uses those exported functions instead of local duplicates.

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

// ファビコン生成
function setFavicon(color: string) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = color || '#ff6666';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    const url = canvas.toDataURL('image/png');

    const links = document.querySelectorAll('link[rel~="icon"]');
    links.forEach(l => l.remove());
    
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
  } catch (e) {
    console.error('[env-marker][content] setFavicon error', e);
  }
}

// Create four clickable border strips for the frame overlay so clicking the frame removes it.
function createFrameBorderClickers(color: string, size: number) {
  try {
    // Remove any existing border clickers/close button first
    removeFrameCloseButton();
    const thickness = `${size || 4}px`;
    const z = 2147483648;
    // helper to create a strip
    const make = (id: string, styles: Partial<CSSStyleDeclaration>) => {
      if (document.getElementById(id)) return;
      const el = document.createElement('div');
      el.id = id;
      Object.assign(el.style, {
        position: 'fixed',
        background: color || '#ff6666',
        zIndex: String(z),
        cursor: 'pointer',
        pointerEvents: 'auto',
        userSelect: 'none'
      } as any);
      for (const k in styles) {
        try { (el.style as any)[k] = (styles as any)[k]; } catch(e){}
      }
      el.addEventListener('click', () => {
        const b = document.getElementById('env-marker-banner');
        if (b) b.remove();
        removeFrameCloseButton();
      });
      document.documentElement.appendChild(el);
    };

    // Top strip
    make('env-marker-frame-border-top', { top: '0', left: '0', right: '0', height: thickness });
    // Bottom strip
    make('env-marker-frame-border-bottom', { bottom: '0', left: '0', right: '0', height: thickness });
    // Left strip
    make('env-marker-frame-border-left', { top: '0', bottom: '0', left: '0', width: thickness });
    // Right strip
    make('env-marker-frame-border-right', { top: '0', bottom: '0', right: '0', width: thickness });
  } catch (e) {
    console.error('[env-marker][content] createFrameBorderClickers error', e);
  }
}

function removeFrameCloseButton() {
  try {
    const ids = ['env-marker-frame-close', 'env-marker-frame-border-top', 'env-marker-frame-border-bottom', 'env-marker-frame-border-left', 'env-marker-frame-border-right'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  } catch (e) {
    console.error('[env-marker][content] removeFrameCloseButton error', e);
  }
}