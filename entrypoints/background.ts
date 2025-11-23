import { matchesPattern } from '../src/ipMatcher';
import { loadAllEnabledSettings } from '../src/settings';

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
    chrome.webRequest.onCompleted.addListener(async (details: any) => {
      try {
        // details に remoteIp が含まれる（Manifest V3 + host_permissions が必要）
        const remoteIp = details.ip;
        console.debug('[env-marker][background] onCompleted', {url: details.url, tabId: details.tabId, remoteIp, details});
        if (!remoteIp) {
          console.debug('[env-marker][background] no remote IP available for request');
          return;
        }
        
        // すべての有効な設定プロファイルをチェック
        const allSettings = await loadAllEnabledSettings();
        let matchedResult: { pattern: string; color: string; position: string; size: number } | null = null;

        for (const setting of allSettings) {
          const matchedPattern = setting.patterns.find((pattern: string) => {
            if (!pattern || pattern.trim() === '') return false;
            try {
              return matchesPattern(pattern, remoteIp ? String(remoteIp) : undefined, details.url);
            } catch (e) {
              console.error('[env-marker][background] matchesPattern threw', e);
              return false;
            }
          });

          if (matchedPattern) {
            console.info(`[env-marker][background] Matched with ${setting.key}:`, matchedPattern);
            matchedResult = { 
              pattern: matchedPattern, 
              color: setting.color, 
              position: setting.bannerPosition, 
              size: setting.bannerSize 
            };
            break; // 最初にマッチした設定を使用
          }
        }

        if (!matchedResult) {
          console.debug('[env-marker][background] no pattern matched', {url: details.url, remoteIp});
          return;
        }

        // 対象タブにメッセージ送信してバナーを表示させる
          if (details.tabId && details.tabId !== -1) {
          console.info('[env-marker][background] match found, preparing to send message to tab', {tabId: details.tabId, pattern: matchedResult.pattern, color: matchedResult.color, url: details.url});
          // Do not send messages to extension/internal pages (they don't have content script listeners)
          const targetUrl = details.url || '';
          if (targetUrl.startsWith('chrome-extension://') || targetUrl.startsWith('chrome://') || targetUrl.startsWith('about:') ) {
            console.debug('[env-marker][background] skip sending message to internal/extension page', {tabId: details.tabId, url: targetUrl});
          } else {
            const msg = {type: 'show-env-marker-banner', text: matchedResult.pattern, color: matchedResult.color, position: matchedResult.position, size: matchedResult.size};

            // helper: attempt sendMessage with limited retries if the tab hasn't yet registered a listener
            const sendWithRetry = (tabId: number, attemptsLeft = 5, delayMs = 250) => {
              try {
                chrome.tabs.sendMessage(tabId, msg, (resp: any) => {
                  if (chrome.runtime.lastError) {
                    console.debug('[env-marker][background] sendMessage: no receiver in tab', {tabId, err: chrome.runtime.lastError && chrome.runtime.lastError.message, attemptsLeft});
                    // inspect tab info to decide whether to retry
                    try {
                      chrome.tabs.get(tabId, (tabInfo: any) => {
                        if (chrome.runtime.lastError) {
                          console.debug('[env-marker][background] chrome.tabs.get failed', {tabId, err: chrome.runtime.lastError && chrome.runtime.lastError.message});
                          return;
                        }
                        console.debug('[env-marker][background] tab info at sendMessage failure', {tabId, tabUrl: tabInfo?.url, tabStatus: tabInfo?.status, tabActive: tabInfo?.active});
                        // If tab is still loading and we have attempts left, retry after delay
                        if (attemptsLeft > 0 && tabInfo && tabInfo.status !== 'complete') {
                              setTimeout(() => sendWithRetry(tabId, attemptsLeft - 1, Math.min(2000, delayMs * 2)), delayMs);
                            } else {
                          // give up; content script listener not present or tab not responsive
                          console.debug('[env-marker][background] give up sending message, no content script listener found', {tabId});
                        }
                      });
                    } catch (e) {
                      console.debug('[env-marker][background] tabs.get threw', e);
                    }
                  } else {
                    console.debug('[env-marker][background] sendMessage succeeded', {tabId, resp});
                  }
                });
              } catch (e) {
                console.debug('[env-marker][background] sendMessage threw', e);
              }
            };
            // initial attempt
            sendWithRetry(details.tabId, 5, 200);
          }
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
    chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: any, tab: any) => {
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
    chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, namespace: string) => {
      for (let [key, { oldValue, newValue }] of Object.entries(changes) as Array<[string, chrome.storage.StorageChange]>) {
        console.log(
          `[env-marker][storage] Storage key "${key}" in namespace "${namespace}" changed.`,
          `Old value was:`, oldValue,
          `New value is:`, newValue
        );
      }
    });
  }
});