import { matchesPattern } from '../ipMatcher';

export function showBanner(text: string, color: string, position: string, size: number) {
  try {
    let banner = document.getElementById('env-marker-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'env-marker-banner';
      banner.style.visibility = 'hidden';
      document.documentElement.appendChild(banner);
      banner.addEventListener('click', () => {
        const b = document.getElementById('env-marker-banner');
        if (b) b.remove();
        removeFrameCloseButton();
      });
    }
    if (!banner) return;

    banner.style.cssText = 'position: fixed; z-index: 2147483647; cursor: pointer; pointer-events: auto;';
    banner.textContent = '';

    const bannerColor = color || '#ff6666';
    const bannerSize = `${size || 4}px`;
    const isRibbon = position.includes('-left') || position.includes('-right');

    if (isRibbon) {
      banner.style.width = '200px';
      banner.style.padding = '4px 0';
      banner.style.textAlign = 'center';
      banner.style.background = bannerColor;
      banner.style.color = 'white';
      banner.style.fontSize = '14px';
      banner.style.fontWeight = 'bold';
      banner.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
      banner.textContent = text;
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
      switch (position) {
        case 'bottom':
          banner.style.bottom = '0'; banner.style.left = '0'; banner.style.width = '100%'; banner.style.height = bannerSize; banner.style.background = bannerColor; break;
        case 'left':
          banner.style.top = '0'; banner.style.left = '0'; banner.style.width = bannerSize; banner.style.height = '100vh'; banner.style.background = bannerColor; break;
        case 'right':
          banner.style.top = '0'; banner.style.right = '0'; banner.style.width = bannerSize; banner.style.height = '100vh'; banner.style.background = bannerColor; break;
        case 'frame':
          banner.style.top = '0'; banner.style.left = '0'; banner.style.width = '100vw'; banner.style.height = '100vh'; banner.style.border = `${bannerSize} solid ${bannerColor}`; banner.style.boxSizing = 'border-box'; banner.style.pointerEvents = 'none'; banner.style.background = 'transparent'; createFrameBorderClickers(bannerColor, size); break;
        case 'top':
        default:
          banner.style.top = '0'; banner.style.left = '0'; banner.style.width = '100%'; banner.style.height = bannerSize; banner.style.background = bannerColor; break;
      }
    }

    const prefix = `[${text}]`;
    if (!document.title.startsWith(prefix)) {
      document.title = `${prefix} ${document.title}`;
    }
    setFavicon(color);
    try { banner.style.visibility = 'visible'; } catch (e) {}
    try { if (position !== 'frame') { banner.style.pointerEvents = 'auto'; removeFrameCloseButton(); } } catch (e) {}
    try { (window as any).__env_marker_lastBanner = { text, color, position, size, timestamp: Date.now() }; } catch (e) {}
  } catch (e) {
    console.error('[env-marker][banner] showBanner error', e);
  }
}

export function applySettingsPayload(msg: any) {
  try {
    if (!msg) return;
    const now = msg.timestamp || Date.now();
    const last = (window as any).__env_marker_lastBanner || {};
    if (last.timestamp && msg.timestamp && msg.timestamp < last.timestamp) return;
    const banner = document.getElementById('env-marker-banner');

    if (banner && last && last.text && Array.isArray(msg.patterns) && msg.patterns.find((p: string) => p === last.text)) {
      try {
        const color = msg.color || last.color || '#ff6666';
        const position = msg.bannerPosition || last.position || 'top';
        const size = msg.bannerSize || last.size || 4;

        banner.style.transition = 'none';
        banner.style.background = color;

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
          banner.style.height = '';
          banner.style.border = '';
          banner.style.boxSizing = '';
          banner.style.width = '200px';
          switch (position) {
            case 'top-right': banner.style.top = '25px'; banner.style.right = '-50px'; banner.style.transform = 'rotate(45deg)'; break;
            case 'top-left': banner.style.top = '25px'; banner.style.left = '-50px'; banner.style.transform = 'rotate(-45deg)'; break;
            case 'bottom-right': banner.style.bottom = '25px'; banner.style.right = '-50px'; banner.style.transform = 'rotate(-45deg)'; break;
            case 'bottom-left': banner.style.bottom = '25px'; banner.style.left = '-50px'; banner.style.transform = 'rotate(45deg)'; break;
          }
        } else {
          const bannerSize = `${size}px`;
          banner.style.top = '';
          banner.style.bottom = '';
          banner.style.left = '';
          banner.style.right = '';
          banner.style.transform = '';
          banner.style.padding = '';
          banner.style.textAlign = '';
          banner.style.color = '';
          banner.style.fontSize = '';
          banner.style.fontWeight = '';
          banner.style.boxShadow = '';
          banner.textContent = '';
          switch (position) {
            case 'bottom': banner.style.bottom = '0'; banner.style.left = '0'; banner.style.width = '100%'; banner.style.height = bannerSize; break;
            case 'left': banner.style.top = '0'; banner.style.left = '0'; banner.style.width = bannerSize; banner.style.height = '100vh'; break;
            case 'right': banner.style.top = '0'; banner.style.right = '0'; banner.style.width = bannerSize; banner.style.height = '100vh'; break;
            case 'frame': banner.style.top = '0'; banner.style.left = '0'; banner.style.width = '100vw'; banner.style.height = '100vh'; banner.style.border = `${bannerSize} solid ${color}`; banner.style.boxSizing = 'border-box'; banner.style.pointerEvents = 'none'; banner.style.background = 'transparent'; createFrameBorderClickers(color, size); break;
            case 'top': banner.style.top = '0'; banner.style.left = '0'; banner.style.width = '100%'; banner.style.height = bannerSize; break;
            default: break;
          }
          if (position !== 'frame') removeFrameCloseButton();
        }

        try { setFavicon(color); } catch (e) {}
        try { document.title = `[${last.text}] ${document.title.replace(/\[.*?\]\s*/, '')}`; } catch (e) {}
        (window as any).__env_marker_lastBanner = { text: last.text, color, position, size, timestamp: now };
      } catch (e) {
        console.error('[env-marker][banner] applySettingsPayload update existing banner error', e);
      }
      return;
    }

    if (Array.isArray(msg.patterns) && msg.patterns.length > 0) {
      try {
        const url = location.href;
        const matched = msg.patterns.find((p: string) => matchesPattern(p, undefined, url));
        if (matched) {
          const color = msg.color || '#ff6666';
          const position = msg.bannerPosition || 'top';
          const size = msg.bannerSize || 4;
          showBanner(matched, color, position, size);
          return;
        }
      } catch (e) {
        console.error('[env-marker][banner] applySettingsPayload evaluate patterns error', e);
      }
    }
  } catch (e) {
    console.error('[env-marker][banner] applySettingsPayload error', e);
  }
}

export async function updateBannerFromStorageForLast() {
  try {
    const last = (window as any).__env_marker_lastBanner;
    if (!last || !last.text) return;
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
        const banner = document.getElementById('env-marker-banner');
        if (!banner) return;
        try {
          banner.style.transition = 'none';
          banner.style.background = color;
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
            banner.style.height = '';
            banner.style.border = '';
            banner.style.boxSizing = '';
            banner.style.width = '200px';
            switch (position) {
              case 'top-right': banner.style.top = '25px'; banner.style.right = '-50px'; banner.style.transform = 'rotate(45deg)'; break;
              case 'top-left': banner.style.top = '25px'; banner.style.left = '-50px'; banner.style.transform = 'rotate(-45deg)'; break;
              case 'bottom-right': banner.style.bottom = '25px'; banner.style.right = '-50px'; banner.style.transform = 'rotate(-45deg)'; break;
              case 'bottom-left': banner.style.bottom = '25px'; banner.style.left = '-50px'; banner.style.transform = 'rotate(45deg)'; break;
            }
          } else {
            const bannerSize = `${size}px`;
            banner.style.top = '';
            banner.style.bottom = '';
            banner.style.left = '';
            banner.style.right = '';
            banner.style.transform = '';
            banner.style.padding = '';
            banner.style.textAlign = '';
            banner.style.color = '';
            banner.style.fontSize = '';
            banner.style.fontWeight = '';
            banner.style.boxShadow = '';
            banner.textContent = '';
            switch (position) {
              case 'bottom': banner.style.bottom = '0'; banner.style.left = '0'; banner.style.width = '100%'; banner.style.height = bannerSize; break;
              case 'left': banner.style.top = '0'; banner.style.left = '0'; banner.style.width = bannerSize; banner.style.height = '100vh'; break;
              case 'right': banner.style.top = '0'; banner.style.right = '0'; banner.style.width = bannerSize; banner.style.height = '100vh'; break;
              case 'frame': banner.style.top = '0'; banner.style.left = '0'; banner.style.width = '100vw'; banner.style.height = '100vh'; banner.style.border = `${bannerSize} solid ${color}`; banner.style.boxSizing = 'border-box'; banner.style.pointerEvents = 'none'; banner.style.background = 'transparent'; createFrameBorderClickers(color, size); break;
              case 'top': banner.style.top = '0'; banner.style.left = '0'; banner.style.width = '100%'; banner.style.height = bannerSize; break;
              default: break;
            }
            if (position !== 'frame') removeFrameCloseButton();
          }
          try { setFavicon(color); } catch (e) {}
          try { document.title = `[${last.text}] ${document.title.replace(/\[.*?\]\s*/, '')}`; } catch (e) {}
          (window as any).__env_marker_lastBanner = { text: last.text, color, position, size };
        } catch (e) {
          console.error('[env-marker][banner] updateBannerFromStorageForLast error', e);
        }
        return;
      }
    }
  } catch (e) {
    console.error('[env-marker][banner] updateBannerFromStorageForLast failed', e);
  }
}

function setFavicon(color: string) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = color || '#ff6666'; ctx.beginPath(); ctx.arc(32,32,28,0,Math.PI*2); ctx.fill();
    const url = canvas.toDataURL('image/png');
    const links = document.querySelectorAll('link[rel~="icon"]'); links.forEach(l => l.remove());
    const link = document.createElement('link'); link.rel = 'icon'; link.href = url; document.head.appendChild(link);
  } catch (e) { console.error('[env-marker][banner] setFavicon error', e); }
}

export function createFrameBorderClickers(color: string, size: number) {
  try {
    removeFrameCloseButton();
    const thickness = `${size || 4}px`;
    const z = 2147483648;
    const make = (id: string, styles: Partial<CSSStyleDeclaration>) => {
      if (document.getElementById(id)) return;
      const el = document.createElement('div'); el.id = id;
      Object.assign(el.style, { position: 'fixed', background: color || '#ff6666', zIndex: String(z), cursor: 'pointer', pointerEvents: 'auto', userSelect: 'none' } as any);
      for (const k in styles) { try { (el.style as any)[k] = (styles as any)[k]; } catch(e){} }
      el.addEventListener('click', () => { const b = document.getElementById('env-marker-banner'); if (b) b.remove(); removeFrameCloseButton(); });
      document.documentElement.appendChild(el);
    };
    make('env-marker-frame-border-top', { top: '0', left: '0', right: '0', height: thickness });
    make('env-marker-frame-border-bottom', { bottom: '0', left: '0', right: '0', height: thickness });
    make('env-marker-frame-border-left', { top: '0', bottom: '0', left: '0', width: thickness });
    make('env-marker-frame-border-right', { top: '0', bottom: '0', right: '0', width: thickness });
  } catch (e) { console.error('[env-marker][banner] createFrameBorderClickers error', e); }
}

export function removeFrameCloseButton() {
  try {
    const ids = ['env-marker-frame-close', 'env-marker-frame-border-top', 'env-marker-frame-border-bottom', 'env-marker-frame-border-left', 'env-marker-frame-border-right'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  } catch (e) { console.error('[env-marker][banner] removeFrameCloseButton error', e); }
}
