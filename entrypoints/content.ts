import { matchesPattern } from '../src/ipMatcher';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',

  main: async () => {
    // ページのロード時にすべての有効な設定をチェックし、マッチするものがあればマーカーを表示する
    try {
      const host = location.hostname;
      // --- temporary global error handlers for debugging SVG path errors ---
      try {
        window.addEventListener('error', (ev: ErrorEvent) => {
          try {
            console.error('[env-marker][content][dbg] window.onerror', ev.message, ev.filename, ev.lineno, ev.colno, ev.error && ev.error.stack);
            const paths = Array.from(document.querySelectorAll('path')).slice(0, 20).map(p => ({ d: p.getAttribute('d'), outer: (p.outerHTML || '').slice(0, 300) }));
            console.debug('[env-marker][content][dbg] paths sample', paths);
            const target = ev && (ev as any).target;
            if (target && target instanceof Element) {
              try { console.debug('[env-marker][content][dbg] error target outerHTML', (target.outerHTML || '').slice(0, 800)); } catch(e) {}
            }
          } catch (e) {
            console.error('[env-marker][content][dbg] handler error', e);
          }
        }, true);

        window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
          try {
            const reason = (ev && (ev as any).reason) || ev;
            console.error('[env-marker][content][dbg] unhandledrejection', reason && (reason.stack || reason));
            const paths = Array.from(document.querySelectorAll('path')).slice(0, 20).map(p => ({ d: p.getAttribute('d'), outer: (p.outerHTML || '').slice(0, 300) }));
            console.debug('[env-marker][content][dbg] paths sample', paths);
          } catch (e) {
            console.error('[env-marker][content][dbg] unhandledrejection handler error', e);
          }
        }, true);
      } catch (e) {
        console.error('[env-marker][content][dbg] failed to attach global handlers', e);
      }
      // --- end temporary handlers ---
      const url = location.href;
      console.debug('[env-marker][content] Initializing content script for:', url);

      // Ensure we can receive messages from background even if main() returns early
      try {
        chrome.runtime.onMessage.addListener((msg: any) => {
          try {
            console.debug('[env-marker][content] Early Received message:', msg);
            if (msg && msg.type === 'show-env-marker-banner' && msg.text) {
              // Prefer position/size provided in the message (injected helper/background)
              // If not present, fall back to reading storage. Use an async IIFE so we
              // don't block the message channel synchronously.
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
            // If options page notifies settings changed, update existing banner without reload
            if (msg && msg.type === 'env-marker-settings-changed') {
              try {
                updateBannerFromStorageForLast();
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

      // Evaluate patterns and show banner if needed
      await evaluatePatternsAndShow();
    } catch (e) {
      console.error(e);
    }

    // バックグラウンドからのメッセージ受信
    chrome.runtime.onMessage.addListener(async (msg: any) => {
      console.debug('[env-marker][content] Received message:', msg);
      if (msg && msg.type === 'show-env-marker-banner' && msg.text) {
        // Get current setting profile
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

    // Evaluate all settings for current URL and show banner if a pattern matches
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

// バナー表示の共通関数
function showBanner(text: string, color: string, position: string, size: number) {
  try {
    console.debug('[env-marker][content] showBanner called with:', { text, color, position, size });
    let banner = document.getElementById('env-marker-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'env-marker-banner';
      // create hidden initially to avoid layout flicker while styles are applied
      banner.style.visibility = 'hidden';
      document.documentElement.appendChild(banner);
      // バナーが新しく作成されたときに一度だけイベントリスナーを追加
      banner.addEventListener('click', () => {
        const b = document.getElementById('env-marker-banner');
        if (b) b.remove();
      });
    }

    if (!banner) return;

    // スタイルをリセットし、クリック可能にする
    banner.style.cssText = 'position: fixed; z-index: 2147483647; cursor: pointer; pointer-events: auto;';
    banner.textContent = ''; // テキストをリセット

    const bannerColor = color || '#ff6666';
    const bannerSize = `${size || 4}px`;
    const isRibbon = position.includes('-left') || position.includes('-right');

    if (isRibbon) {
      // --- リボン用のスタイル ---
      banner.style.width = '200px';
      banner.style.padding = '4px 0';
      banner.style.textAlign = 'center';
      banner.style.background = bannerColor;
      banner.style.color = 'white';
      banner.style.fontSize = '14px';
      banner.style.fontWeight = 'bold';
      banner.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
      banner.textContent = text;

      switch (position) {
        case 'top-right':
          banner.style.top = '25px';
          banner.style.right = '-50px';
          banner.style.transform = 'rotate(45deg)';
          break;
        case 'top-left':
          banner.style.top = '25px';
          banner.style.left = '-50px';
          banner.style.transform = 'rotate(-45deg)';
          break;
        case 'bottom-right':
          banner.style.bottom = '25px';
          banner.style.right = '-50px';
          banner.style.transform = 'rotate(-45deg)';
          break;
        case 'bottom-left':
          banner.style.bottom = '25px';
          banner.style.left = '-50px';
          banner.style.transform = 'rotate(45deg)';
          break;
      }
    } else {
      // --- 従来の帯・枠用のスタイル ---
      switch (position) {
        case 'bottom':
          banner.style.bottom = '0';
          banner.style.left = '0';
          banner.style.width = '100%';
          banner.style.height = bannerSize;
          banner.style.background = bannerColor;
          break;
        case 'left':
          banner.style.top = '0';
          banner.style.left = '0';
          banner.style.width = bannerSize;
          banner.style.height = '100vh';
          banner.style.background = bannerColor;
          break;
        case 'right':
          banner.style.top = '0';
          banner.style.right = '0';
          banner.style.width = bannerSize;
          banner.style.height = '100vh';
          banner.style.background = bannerColor;
          break;
        case 'frame':
          banner.style.top = '0';
          banner.style.left = '0';
          banner.style.width = '100vw';
          banner.style.height = '100vh';
          banner.style.border = `${bannerSize} solid ${bannerColor}`;
          banner.style.boxSizing = 'border-box';
          break;
        case 'top':
        default:
          banner.style.top = '0';
          banner.style.left = '0';
          banner.style.width = '100%';
          banner.style.height = bannerSize;
          banner.style.background = bannerColor;
          break;
      }
    }

    // タイトルプレフィックス
    const prefix = `[${text}]`;
    if (!document.title.startsWith(prefix)) {
      document.title = `${prefix} ${document.title}`;
    }
    
    // ファビコン
    setFavicon(color);

    // Styles applied, show the banner to avoid initial flicker
    try {
      banner.style.visibility = 'visible';
    } catch (e) {}
    // remember last shown banner info so storage changes can update it without reload
    try {
      (window as any).__env_marker_lastBanner = { text, color, position, size };
    } catch (e) {}
  } catch (e) {
    console.error(e);
  }
}

// Update an existing banner based on current storage for the matching pattern
async function updateBannerFromStorageForLast() {
  try {
    const last = (window as any).__env_marker_lastBanner;
    if (!last || !last.text) return;
    // load all settings and find which one contains the pattern text
    const allSettings = ['setting1', 'setting2', 'setting3', 'setting4', 'setting5'];
    for (const key of allSettings) {
      const data = await chrome.storage.sync.get({
        [`${key}_patterns`]: [],
        [`${key}_color`]: '#ff6666',
        [`${key}_bannerPosition`]: 'top',
        [`${key}_bannerSize`]: 40,
      });
      const any = data as any;
      const patterns: string[] = any[`${key}_patterns`] || [];
      if (patterns.find(p => p === last.text)) {
        const color = (any[`${key}_color`] as string) || last.color || '#ff6666';
        const position = (any[`${key}_bannerPosition`] as string) || last.position || 'top';
        const size = (any[`${key}_bannerSize`] as number) || last.size || 40;
        // apply to existing banner without recreating to avoid flicker
        const banner = document.getElementById('env-marker-banner');
        if (!banner) return;
        try {
          // reuse the same styling logic from showBanner but only update styles
          banner.style.transition = 'none';
          banner.style.background = color;
          // ribbon vs bar
          const isRibbon = position.includes('-left') || position.includes('-right');
          if (isRibbon) {
            banner.style.width = '200px';
            banner.style.padding = '4px 0';
            banner.style.textAlign = 'center';
            banner.style.color = 'white';
            banner.style.fontSize = '14px';
            banner.style.fontWeight = 'bold';
            banner.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
            banner.textContent = last.text;
            banner.style.top = '';
            banner.style.bottom = '';
            banner.style.left = '';
            banner.style.right = '';
            banner.style.transform = '';
            switch (position) {
              case 'top-right': banner.style.top = '25px'; banner.style.right = '-50px'; banner.style.transform = 'rotate(45deg)'; break;
              case 'top-left': banner.style.top = '25px'; banner.style.left = '-50px'; banner.style.transform = 'rotate(-45deg)'; break;
              case 'bottom-right': banner.style.bottom = '25px'; banner.style.right = '-50px'; banner.style.transform = 'rotate(-45deg)'; break;
              case 'bottom-left': banner.style.bottom = '25px'; banner.style.left = '-50px'; banner.style.transform = 'rotate(45deg)'; break;
            }
          } else {
            const bannerSize = `${size}px`;
            // clear ribbon placements
            banner.style.top = '';
            banner.style.bottom = '';
            banner.style.left = '';
            banner.style.right = '';
            banner.style.transform = '';
            switch (position) {
              case 'bottom': banner.style.bottom = '0'; banner.style.left = '0'; banner.style.width = '100%'; banner.style.height = bannerSize; break;
              case 'left': banner.style.top = '0'; banner.style.left = '0'; banner.style.width = bannerSize; banner.style.height = '100vh'; break;
              case 'right': banner.style.top = '0'; banner.style.right = '0'; banner.style.width = bannerSize; banner.style.height = '100vh'; break;
              case 'frame': banner.style.top = '0'; banner.style.left = '0'; banner.style.width = '100vw'; banner.style.height = '100vh'; banner.style.border = `${bannerSize} solid ${color}`; banner.style.boxSizing = 'border-box'; break;
              case 'top': default: banner.style.top = '0'; banner.style.left = '0'; banner.style.width = '100%'; banner.style.height = bannerSize; break;
            }
          }
          // update favicon/title
          try { setFavicon(color); } catch (e) {}
          try { document.title = `[${last.text}] ${document.title.replace(/\[.*?\]\s*/, '')}`; } catch (e) {}
          // update remembered values
          (window as any).__env_marker_lastBanner = { text: last.text, color, position, size };
        } catch (e) {
          console.error('[env-marker][content] updateBannerFromStorageForLast error', e);
        }
        return;
      }
    }
  } catch (e) {
    console.error('[env-marker][content] updateBannerFromStorageForLast failed', e);
  }
}

// Listen for storage changes and update the banner when relevant
try {
  chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
    try {
      // call update which will find the matching setting by pattern
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