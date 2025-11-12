// content_script.js
// ページのロード時にホストが許可されたパターンリストに含まれるかチェックし、含まれていればマーカーを表示する

(async function() {
  try {
    const host = location.hostname;
    const url = location.href;
  console.debug('[env-marker][content] page host/url', {host, url});
    // ストレージから設定を取得（sync を優先し、空なら local をフォールバック）
    let data = await chrome.storage.sync.get({patterns: [], color: '#ff6666', bannerPosition: 'top', bannerSize: 4});
    let { patterns, color, bannerPosition, bannerSize } = data;

    if ((!patterns || patterns.length === 0) || !color || !bannerPosition) {
      const fallback = await chrome.storage.local.get({patterns: [], color: '#ff6666', bannerPosition: 'top', bannerSize: 4});
      if ((!patterns || patterns.length === 0) && fallback.patterns && fallback.patterns.length) {
        console.debug('[env-marker][content] sync empty, using local storage patterns', fallback.patterns);
        patterns = fallback.patterns;
      }
      if (!color && fallback.color) {
        color = fallback.color;
      }
      if (!bannerPosition && fallback.bannerPosition) {
        bannerPosition = fallback.bannerPosition;
      }
      if (!bannerSize && fallback.bannerSize) {
        bannerSize = fallback.bannerSize;
      }
    }
    
    // パターンにマッチするかチェック
    const matchedPattern = patterns.find(pattern => {
      if (pattern.trim() === '') return false;
      // 単純な文字列含むか、IPアドレスが一致するかで判定
      return url.includes(pattern) || host === pattern;
    });

  console.debug('[env-marker][content] storedPatterns', patterns);
    if (!matchedPattern) return;

    // マッチした場合はバナー表示
  console.info('[env-marker][content] pattern match, showing banner', {matchedPattern, color, bannerPosition, bannerSize});
  showBanner(matchedPattern, color, bannerPosition, bannerSize);
  } catch (e) {
    console.error(e);
  }
})();

// バナー表示の共通関数（background からのメッセージでも使う）
function showBanner(text, color, position, size) {
  try {
  console.debug('[env-marker][content] showBanner called with:', {text, color, position, size});
    // 既にある場合は更新
    let banner = document.getElementById('env-marker-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'env-marker-banner';
      banner.style.position = 'fixed';
      banner.style.zIndex = '2147483647';
      banner.style.pointerEvents = 'none'; // Make it non-interactive
      document.documentElement.appendChild(banner);
    }

    // Reset styles before applying new ones
    banner.style.top = 'auto';
    banner.style.bottom = 'auto';
    banner.style.left = 'auto';
    banner.style.right = 'auto';
    banner.style.width = 'auto';
    banner.style.height = 'auto';
    banner.style.background = 'none';
    banner.style.border = 'none';

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

    // タイトルにプレフィックスを付ける（重複を避ける）
    const prefix = `[${text}]`;
    if (!document.title.startsWith(prefix)) {
  console.debug('[env-marker][content] updating document.title');
      document.title = `${prefix} ${document.title}`;
    }
    // ファビコンを書き換える
    try {
      setFavicon(color);
    } catch (e) {
      console.error('[env-marker][content] setFavicon error', e);
    }
  } catch (e) {
    console.error(e);
  }
}

// 指定色で簡単なファビコンを生成して差し替える
function setFavicon(color) {
  // 16x16 のキャンバスで丸いアイコンを作る
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // 背景透明
  ctx.clearRect(0, 0, size, size);
  // 円を描く
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI*2);
  ctx.fillStyle = color || '#ff6666';
  ctx.fill();
  // テキスト（IP）を小さく載せるのは省略してシンプルにする
  const url = canvas.toDataURL('image/png');

  // 既存の favicon link を無効化して新しいものを追加
  const links = document.querySelectorAll('link[rel~="icon"]');
  links.forEach(l => l.parentNode.removeChild(l));
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = url;
  document.head.appendChild(link);
}

// background からの通知を受け取ってバナーを表示
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  console.debug('[env-marker][content] received message', msg, 'from', sender);
  if (msg && msg.type === 'show-env-marker-banner' && msg.text) {
    const data = await chrome.storage.sync.get({ bannerPosition: 'top', bannerSize: 4 });
    console.info('[env-marker][content] message requests banner. Loaded data:', data);
    showBanner(msg.text, msg.color, data.bannerPosition, data.bannerSize);
  }
});
