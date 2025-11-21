import { matchesPattern } from '../src/ipMatcher';

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
        const allSettings = ['setting1', 'setting2', 'setting3', 'setting4', 'setting5'];
        let matchedResult: { pattern: string; color: string } | null = null;

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
          if (!enabled) {
            console.debug(`[env-marker][background] ${settingKey} is disabled, skipping`);
            continue;
          }

          let patterns: string[] = (dataAny[`${settingKey}_patterns`] as string[]) || [];
          let color: string = (dataAny[`${settingKey}_color`] as string) || '#ff6666';
          let bannerPosition: string = (dataAny[`${settingKey}_bannerPosition`] as string) || 'top';
          let bannerSize: number = (dataAny[`${settingKey}_bannerSize`] as number) || 40;
          
          if ((!patterns || patterns.length === 0) || !color) {
            const fallback = await chrome.storage.local.get({
              [`${settingKey}_patterns`]: [],
              [`${settingKey}_color`]: '#ff6666'
            });
            const fallbackAny = fallback as any;
            if ((!patterns || patterns.length === 0) && fallbackAny[`${settingKey}_patterns`] && fallbackAny[`${settingKey}_patterns`].length > 0) {
              console.debug('[env-marker][background] sync empty, using local storage patterns', fallbackAny[`${settingKey}_patterns`]);
              patterns = fallbackAny[`${settingKey}_patterns`];
            }
            if ((!color || color === '') && fallbackAny[`${settingKey}_color`]) {
              color = fallbackAny[`${settingKey}_color`];
            }
            if ((!bannerPosition || bannerPosition === '') && fallbackAny[`${settingKey}_bannerPosition`]) {
              bannerPosition = fallbackAny[`${settingKey}_bannerPosition`];
            }
            if ((!bannerSize || bannerSize === 0) && fallbackAny[`${settingKey}_bannerSize`]) {
              bannerSize = fallbackAny[`${settingKey}_bannerSize`];
            }
          }

          // IPv6アドレス判定（: が含まれ、URLスキームが含まれない簡易判定）
          function isIPv6Pattern(str: string) {
            return typeof str === 'string' && str.includes(':') && !/^https?:\/\//i.test(str);
          }

          // IPv6アドレス（フル表記）を BigInt に変換
          function ipv6ToBigInt(normalizedAddr: string) {
            const hex = normalizedAddr.replace(/:/g, '');
            return BigInt('0x' + hex);
          }

              const matchedPattern = patterns.find((pattern: string) => {
              if (pattern.trim() === '') return false;
            try {
              const results: any = { cidr: false, wildcard: false, normalized: false, regex: false, error: null };
              // --- temporary detailed debug logging for IPv6 troubleshooting ---
              const patt = pattern.trim();
              const cleanPattern = patt.replace(/^\[|\]$/g, '');
              const remoteClean = remoteIp ? String(remoteIp).replace(/^\[|\]$/g, '') : remoteIp;
              console.debug('[env-marker][background][dbg] eval pattern', {patt, cleanPattern, remoteIp, remoteClean, url: details.url});
              // (debug) skip expensive normalization here; matcher handles normalization
              console.debug('[env-marker][background][dbg] eval pattern (skipping normalize)', {patt, cleanPattern, remoteIp, remoteClean, url: details.url});
              // --- end temporary logs ---
              // Use centralized matcher
              try {
                const ok = matchesPattern(pattern, remoteIp ? String(remoteIp) : undefined, details.url);
                if (ok) {
                  console.debug('[env-marker][background][dbg] pattern matched via matchesPattern', { pattern });
                  return true;
                }
                return false;
              } catch (e) {
                console.error('[env-marker][background] matchesPattern threw', e);
                return false;
              }
            } catch (e) {
              console.error(`[env-marker][background] Invalid regex pattern from user input: "${pattern}"`, e);
              return false;
            }
          });

          if (matchedPattern) {
            console.info(`[env-marker][background] Matched with ${settingKey}:`, matchedPattern);
            matchedResult = { pattern: matchedPattern, color: color, position: bannerPosition, size: bannerSize } as any;
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
            const msg = {type: 'show-env-marker-banner', text: matchedResult.pattern, color: matchedResult.color, position: (matchedResult as any).position, size: (matchedResult as any).size};

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
