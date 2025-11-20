import { normalizeIPv6ForMatching } from '../utils/ipv6-utils';

export default defineBackground({
  main() {
    // background.js
    // ここでは必要に応じて将来の拡張機能ロジックを追加できます。
    chrome.runtime.onInstalled.addListener(() => {
      console.log('Env Marker installed');
    });

    // 拡張機能アイコンをクリックしたら設定画面を開く
    chrome.action.onClicked.addListener(() => {
      chrome.runtime.openOptionsPage();
    });

    // webRequest の onCompleted で接続先の IP を取得して、監視リストに含まれていればタブへ通知する
    chrome.webRequest.onCompleted.addListener(async (details) => {
      try {
        // details に remoteIp が含まれる（Manifest V3 + host_permissions が必要）
        const remoteIp = details.ip;
        console.debug('[env-marker][background] onCompleted', {url: details.url, tabId: details.tabId, remoteIp, details});
        if (!remoteIp) {
          console.debug('[env-marker][background] no remote IP available for request');
          return;
        }
        
        // すべての有効な設定プロファイルをチェック
        const allSettings = ['setting1', 'setting2', 'setting3', 'setting4', 'setting5'];
        let matchedResult: { pattern: string; color: string } | null = null;

        for (const settingKey of allSettings) {
          const data = await chrome.storage.sync.get({
            [`${settingKey}_patterns`]: [],
            [`${settingKey}_color`]: '#ff6666',
            [`${settingKey}_enabled`]: true
          });
          
          const enabled = data[`${settingKey}_enabled`];
          if (!enabled) {
            console.debug(`[env-marker][background] ${settingKey} is disabled, skipping`);
            continue;
          }

          let patterns: string[] = data[`${settingKey}_patterns`] || [];
          let color: string = data[`${settingKey}_color`] || '#ff6666';
          
          if ((!patterns || patterns.length === 0) || !color) {
            const fallback = await chrome.storage.local.get({
              [`${settingKey}_patterns`]: [],
              [`${settingKey}_color`]: '#ff6666'
            });
            if ((!patterns || patterns.length === 0) && fallback[`${settingKey}_patterns`] && fallback[`${settingKey}_patterns`].length > 0) {
              console.debug('[env-marker][background] sync empty, using local storage patterns', fallback[`${settingKey}_patterns`]);
              patterns = fallback[`${settingKey}_patterns`];
            }
            if ((!color || color === '') && fallback[`${settingKey}_color`]) {
              color = fallback[`${settingKey}_color`];
            }
          }

          const matchedPattern = patterns.find((pattern: string) => {
            if (pattern.trim() === '') return false;
            try {
              // Normalize IPv6 addresses for consistent matching
              const normalizedPattern = normalizeIPv6ForMatching(pattern);
              const normalizedUrl = normalizeIPv6ForMatching(details.url);
              const normalizedIp = remoteIp ? normalizeIPv6ForMatching(remoteIp) : null;
              
              const regexPattern = normalizedPattern
                .replace(/[.+?^${}()|[\\]/g, '\\$&') // . や + などの文字をエスケープ
                .replace(/\*/g, '.*'); // アスタリスクをワイルドカードに変換
              
              const regex = new RegExp(regexPattern, 'i');
              // URL または IPアドレスに対して正規表現テストを実行
              return regex.test(normalizedUrl) || (normalizedIp && regex.test(normalizedIp));
            } catch (e) {
              console.error(`[env-marker][background] Invalid regex pattern from user input: "${pattern}"`, e);
              return false;
            }
          });

          if (matchedPattern) {
            console.info(`[env-marker][background] Matched with ${settingKey}:`, matchedPattern);
            matchedResult = { pattern: matchedPattern, color: color };
            break; // 最初にマッチした設定を使用
          }
        }

        if (!matchedResult) {
          console.debug('[env-marker][background] no pattern matched', {url: details.url, remoteIp});
          return;
        }

        // 対象タブにメッセージ送信してバナーを表示させる
        if (details.tabId && details.tabId !== -1) {
          console.info('[env-marker][background] match found, sending message to tab', {tabId: details.tabId, pattern: matchedResult.pattern, color: matchedResult.color});
          chrome.tabs.sendMessage(details.tabId, {type: 'show-env-marker-banner', text: matchedResult.pattern, color: matchedResult.color});
          // 拡張のアイコンにバッジを表示
          try {
            chrome.action.setBadgeText({text: 'ENV', tabId: details.tabId});
            // バッジ色は storage の color を使う（chrome accepts [r,g,b,a] or CSS string）
            chrome.action.setBadgeBackgroundColor({color: matchedResult.color, tabId: details.tabId});
          } catch (e) {
            console.debug('[env-marker][background] unable to set badge', e);
          }
        } else {
          console.debug('[env-marker][background] matched IP but no tabId available', {ip: remoteIp, tabId: details.tabId});
        }
      } catch (e) {
        console.error(e);
      }
    }, {urls: ["<all_urls>"]});

    // タブが更新（ナビゲーション等）されたらバッジをクリアする
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // ページの読み込み開始/完了時にバッジをクリアする
      if (changeInfo.status === 'loading' || changeInfo.status === 'complete' || changeInfo.url) {
        try {
          chrome.action.setBadgeText({text: '', tabId});
        } catch (e) {
          // ignore
        }
      }
    });

    // ストレージの変更を監視してデバッグログを出力
    chrome.storage.onChanged.addListener((changes, namespace) => {
      for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        console.log(
          `[env-marker][storage] Storage key "${key}" in namespace "${namespace}" changed.`,
          `Old value was:`, oldValue,
          `New value is:`, newValue
        );
      }
    });
  }
});
