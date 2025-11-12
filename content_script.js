// content_script.js
// ページのロード時にホストが許可されたパターンリストに含まれるかチェックし、含まれていればマーカーを表示する

(async function() {
  try {
    const host = location.hostname;
    const url = location.href;
    console.debug('[env-marker][content] Initializing content script for:', url);

    // ストレージから全設定を取得
    const data = await chrome.storage.sync.get({
      patterns: [],
      color: '#ff6666',
      bannerPosition: 'top',
      bannerSize: 40
    });
    console.debug('[env-marker][content] Loaded settings on init:', data);
    
    const { patterns, color, bannerPosition, bannerSize } = data;

    // パターンにマッチするかチェック
    const matchedPattern = patterns.find(pattern => {
      if (pattern.trim() === '') return false;
      return url.includes(pattern) || host === pattern;
    });

    if (!matchedPattern) {
      console.debug('[env-marker][content] No pattern matched.');
      return;
    }

    // マッチした場合はバナー表示
    console.info('[env-marker][content] Pattern matched. Showing banner.', { matchedPattern, ...data });
    showBanner(matchedPattern, color, bannerPosition, bannerSize);
  } catch (e) {
    console.error(e);
  }
})();

// バナー表示の共通関数
function showBanner(text, color, position, size) {
  try {
    console.debug('[env-marker][content] showBanner called with:', { text, color, position, size });
    let banner = document.getElementById('env-marker-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'env-marker-banner';
      banner.style.position = 'fixed';
      banner.style.zIndex = '2147483647';
      banner.style.pointerEvents = 'none';
      document.documentElement.appendChild(banner);
    }

    // スタイルをリセット
    banner.style.cssText = 'position: fixed; z-index: 2147483647; pointer-events: none;';

    const bannerColor = color || '#ff6666';
    const bannerSize = `${size || 4}px`;
    console.debug('[env-marker][content] Applying banner size:', bannerSize);

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

    // タイトルプレフィックス
    const prefix = `[${text}]`;
    if (!document.title.startsWith(prefix)) {
      document.title = `${prefix} ${document.title}`;
    }
    
    // ファビコン
    setFavicon(color);
  } catch (e) {
    console.error(e);
  }
}

// ファビコン生成
function setFavicon(color) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
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

// バックグラウンドからのメッセージ受信
chrome.runtime.onMessage.addListener(async (msg) => {
  console.debug('[env-marker][content] Received message:', msg);
  if (msg && msg.type === 'show-env-marker-banner' && msg.text) {
    const data = await chrome.storage.sync.get({ bannerPosition: 'top', bannerSize: 4 });
    console.info('[env-marker][content] Message requests banner. Loaded data:', data);
    showBanner(msg.text, msg.color, data.bannerPosition, data.bannerSize);
  }
});
