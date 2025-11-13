var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const definition = defineBackground({
    main() {
      chrome.runtime.onInstalled.addListener(() => {
        console.log("Env Marker installed");
      });
      chrome.action.onClicked.addListener(() => {
        chrome.runtime.openOptionsPage();
      });
      chrome.webRequest.onCompleted.addListener(async (details) => {
        try {
          const remoteIp = details.ip;
          console.debug("[env-marker][background] onCompleted", { url: details.url, tabId: details.tabId, remoteIp, details });
          if (!remoteIp) {
            console.debug("[env-marker][background] no remote IP available for request");
            return;
          }
          const allSettings = ["setting1", "setting2", "setting3", "setting4", "setting5"];
          let matchedResult = null;
          for (const settingKey of allSettings) {
            const data = await chrome.storage.sync.get({
              [`${settingKey}_patterns`]: [],
              [`${settingKey}_color`]: "#ff6666",
              [`${settingKey}_enabled`]: true
            });
            const enabled = data[`${settingKey}_enabled`];
            if (!enabled) {
              console.debug(`[env-marker][background] ${settingKey} is disabled, skipping`);
              continue;
            }
            let patterns = data[`${settingKey}_patterns`] || [];
            let color = data[`${settingKey}_color`] || "#ff6666";
            if (!patterns || patterns.length === 0 || !color) {
              const fallback = await chrome.storage.local.get({
                [`${settingKey}_patterns`]: [],
                [`${settingKey}_color`]: "#ff6666"
              });
              if ((!patterns || patterns.length === 0) && fallback[`${settingKey}_patterns`] && fallback[`${settingKey}_patterns`].length > 0) {
                console.debug("[env-marker][background] sync empty, using local storage patterns", fallback[`${settingKey}_patterns`]);
                patterns = fallback[`${settingKey}_patterns`];
              }
              if ((!color || color === "") && fallback[`${settingKey}_color`]) {
                color = fallback[`${settingKey}_color`];
              }
            }
            const matchedPattern = patterns.find((pattern) => {
              if (pattern.trim() === "") return false;
              try {
                const regexPattern = pattern.replace(/[.+?^${}()|[\\]/g, "\\$&").replace(/\*/g, ".*");
                const regex = new RegExp(regexPattern);
                return regex.test(details.url) || remoteIp && regex.test(remoteIp);
              } catch (e) {
                console.error(`[env-marker][background] Invalid regex pattern from user input: "${pattern}"`, e);
                return false;
              }
            });
            if (matchedPattern) {
              console.info(`[env-marker][background] Matched with ${settingKey}:`, matchedPattern);
              matchedResult = { pattern: matchedPattern, color };
              break;
            }
          }
          if (!matchedResult) {
            console.debug("[env-marker][background] no pattern matched", { url: details.url, remoteIp });
            return;
          }
          if (details.tabId && details.tabId !== -1) {
            console.info("[env-marker][background] match found, sending message to tab", { tabId: details.tabId, pattern: matchedResult.pattern, color: matchedResult.color });
            chrome.tabs.sendMessage(details.tabId, { type: "show-env-marker-banner", text: matchedResult.pattern, color: matchedResult.color });
            try {
              chrome.action.setBadgeText({ text: "ENV", tabId: details.tabId });
              chrome.action.setBadgeBackgroundColor({ color: matchedResult.color, tabId: details.tabId });
            } catch (e) {
              console.debug("[env-marker][background] unable to set badge", e);
            }
          } else {
            console.debug("[env-marker][background] matched IP but no tabId available", { ip: remoteIp, tabId: details.tabId });
          }
        } catch (e) {
          console.error(e);
        }
      }, { urls: ["<all_urls>"] });
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === "loading" || changeInfo.status === "complete" || changeInfo.url) {
          try {
            chrome.action.setBadgeText({ text: "", tabId });
          } catch (e) {
          }
        }
      });
      chrome.storage.onChanged.addListener((changes, namespace) => {
        for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
          console.log(
            `[env-marker][storage] Storage key "${key}" in namespace "${namespace}" changed.`,
            `Old value was:`,
            oldValue,
            `New value is:`,
            newValue
          );
        }
      });
    }
  });
  function initPlugins() {
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  var _MatchPattern = class {
    constructor(matchPattern) {
      if (matchPattern === "<all_urls>") {
        this.isAllUrls = true;
        this.protocolMatches = [..._MatchPattern.PROTOCOLS];
        this.hostnameMatch = "*";
        this.pathnameMatch = "*";
      } else {
        const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
        if (groups == null)
          throw new InvalidMatchPattern(matchPattern, "Incorrect format");
        const [_, protocol, hostname, pathname] = groups;
        validateProtocol(matchPattern, protocol);
        validateHostname(matchPattern, hostname);
        this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
        this.hostnameMatch = hostname;
        this.pathnameMatch = pathname;
      }
    }
    includes(url) {
      if (this.isAllUrls)
        return true;
      const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
      return !!this.protocolMatches.find((protocol) => {
        if (protocol === "http")
          return this.isHttpMatch(u);
        if (protocol === "https")
          return this.isHttpsMatch(u);
        if (protocol === "file")
          return this.isFileMatch(u);
        if (protocol === "ftp")
          return this.isFtpMatch(u);
        if (protocol === "urn")
          return this.isUrnMatch(u);
      });
    }
    isHttpMatch(url) {
      return url.protocol === "http:" && this.isHostPathMatch(url);
    }
    isHttpsMatch(url) {
      return url.protocol === "https:" && this.isHostPathMatch(url);
    }
    isHostPathMatch(url) {
      if (!this.hostnameMatch || !this.pathnameMatch)
        return false;
      const hostnameMatchRegexs = [
        this.convertPatternToRegex(this.hostnameMatch),
        this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))
      ];
      const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
      return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
    }
    isFileMatch(url) {
      throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
    }
    isFtpMatch(url) {
      throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
    }
    isUrnMatch(url) {
      throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
    }
    convertPatternToRegex(pattern) {
      const escaped = this.escapeForRegex(pattern);
      const starsReplaced = escaped.replace(/\\\*/g, ".*");
      return RegExp(`^${starsReplaced}$`);
    }
    escapeForRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };
  var MatchPattern = _MatchPattern;
  MatchPattern.PROTOCOLS = ["http", "https", "file", "ftp", "urn"];
  var InvalidMatchPattern = class extends Error {
    constructor(matchPattern, reason) {
      super(`Invalid match pattern "${matchPattern}": ${reason}`);
    }
  };
  function validateProtocol(matchPattern, protocol) {
    if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*")
      throw new InvalidMatchPattern(
        matchPattern,
        `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`
      );
  }
  function validateHostname(matchPattern, hostname) {
    if (hostname.includes(":"))
      throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
    if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*."))
      throw new InvalidMatchPattern(
        matchPattern,
        `If using a wildcard (*), it must go at the start of the hostname`
      );
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  let ws;
  function getDevServerWebSocket() {
    if (ws == null) {
      const serverUrl = "ws://localhost:3000";
      logger.debug("Connecting to dev server @", serverUrl);
      ws = new WebSocket(serverUrl, "vite-hmr");
      ws.addWxtEventListener = ws.addEventListener.bind(ws);
      ws.sendCustom = (event, payload) => ws?.send(JSON.stringify({ type: "custom", event, payload }));
      ws.addEventListener("open", () => {
        logger.debug("Connected to dev server");
      });
      ws.addEventListener("close", () => {
        logger.debug("Disconnected from dev server");
      });
      ws.addEventListener("error", (event) => {
        logger.error("Failed to connect to dev server", event);
      });
      ws.addEventListener("message", (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === "custom") {
            ws?.dispatchEvent(
              new CustomEvent(message.event, { detail: message.data })
            );
          }
        } catch (err) {
          logger.error("Failed to handle message", err);
        }
      });
    }
    return ws;
  }
  function keepServiceWorkerAlive() {
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, 5e3);
  }
  function reloadContentScript(payload) {
    const manifest = browser.runtime.getManifest();
    if (manifest.manifest_version == 2) {
      void reloadContentScriptMv2();
    } else {
      void reloadContentScriptMv3(payload);
    }
  }
  async function reloadContentScriptMv3({
    registration,
    contentScript
  }) {
    if (registration === "runtime") {
      await reloadRuntimeContentScriptMv3(contentScript);
    } else {
      await reloadManifestContentScriptMv3(contentScript);
    }
  }
  async function reloadManifestContentScriptMv3(contentScript) {
    const id = `wxt:${contentScript.js[0]}`;
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const existing = registered.find((cs) => cs.id === id);
    if (existing) {
      logger.debug("Updating content script", existing);
      await browser.scripting.updateContentScripts([
        {
          ...contentScript,
          id,
          css: contentScript.css ?? []
        }
      ]);
    } else {
      logger.debug("Registering new content script...");
      await browser.scripting.registerContentScripts([
        {
          ...contentScript,
          id,
          css: contentScript.css ?? []
        }
      ]);
    }
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadRuntimeContentScriptMv3(contentScript) {
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const matches = registered.filter((cs) => {
      const hasJs = contentScript.js?.find((js) => cs.js?.includes(js));
      const hasCss = contentScript.css?.find((css) => cs.css?.includes(css));
      return hasJs || hasCss;
    });
    if (matches.length === 0) {
      logger.log(
        "Content script is not registered yet, nothing to reload",
        contentScript
      );
      return;
    }
    await browser.scripting.updateContentScripts(matches);
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadTabsForContentScript(contentScript) {
    const allTabs = await browser.tabs.query({});
    const matchPatterns = contentScript.matches.map(
      (match) => new MatchPattern(match)
    );
    const matchingTabs = allTabs.filter((tab) => {
      const url = tab.url;
      if (!url) return false;
      return !!matchPatterns.find((pattern) => pattern.includes(url));
    });
    await Promise.all(
      matchingTabs.map(async (tab) => {
        try {
          await browser.tabs.reload(tab.id);
        } catch (err) {
          logger.warn("Failed to reload tab:", err);
        }
      })
    );
  }
  async function reloadContentScriptMv2(_payload) {
    throw Error("TODO: reloadContentScriptMv2");
  }
  {
    try {
      const ws2 = getDevServerWebSocket();
      ws2.addWxtEventListener("wxt:reload-extension", () => {
        browser.runtime.reload();
      });
      ws2.addWxtEventListener("wxt:reload-content-script", (event) => {
        reloadContentScript(event.detail);
      });
      if (true) {
        ws2.addEventListener(
          "open",
          () => ws2.sendCustom("wxt:background-initialized")
        );
        keepServiceWorkerAlive();
      }
    } catch (err) {
      logger.error("Failed to setup web socket connection with dev server", err);
    }
    browser.commands.onCommand.addListener((command) => {
      if (command === "wxt:reload-extension") {
        browser.runtime.reload();
      }
    });
  }
  let result;
  try {
    initPlugins();
    result = definition.main();
    if (result instanceof Promise) {
      console.warn(
        "The background's main() function return a promise, but it must be synchronous"
      );
    }
  } catch (err) {
    logger.error("The background crashed on startup!");
    throw err;
  }
  const result$1 = result;
  return result$1;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtYmFja2dyb3VuZC5tanMiLCIuLi8uLi9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3eHQtZGV2K2Jyb3dzZXJAMC4xLjQvbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHdlYmV4dC1jb3JlK21hdGNoLXBhdHRlcm5zQDEuMC4zL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuICBpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcbiAgcmV0dXJuIGFyZztcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoe1xuICBtYWluKCkge1xuICAgIC8vIGJhY2tncm91bmQuanNcbiAgICAvLyDjgZPjgZPjgafjga/lv4XopoHjgavlv5zjgZjjgablsIbmnaXjga7mi6HlvLXmqZ/og73jg63jgrjjg4Pjgq/jgpLov73liqDjgafjgY3jgb7jgZnjgIJcbiAgICBjaHJvbWUucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnRW52IE1hcmtlciBpbnN0YWxsZWQnKTtcbiAgICB9KTtcblxuICAgIC8vIOaLoeW8teapn+iDveOCouOCpOOCs+ODs+OCkuOCr+ODquODg+OCr+OBl+OBn+OCieioreWumueUu+mdouOCkumWi+OBj1xuICAgIGNocm9tZS5hY3Rpb24ub25DbGlja2VkLmFkZExpc3RlbmVyKCgpID0+IHtcbiAgICAgIGNocm9tZS5ydW50aW1lLm9wZW5PcHRpb25zUGFnZSgpO1xuICAgIH0pO1xuXG4gICAgLy8gd2ViUmVxdWVzdCDjga4gb25Db21wbGV0ZWQg44Gn5o6l57aa5YWI44GuIElQIOOCkuWPluW+l+OBl+OBpuOAgeebo+imluODquOCueODiOOBq+WQq+OBvuOCjOOBpuOBhOOCjOOBsOOCv+ODluOBuOmAmuefpeOBmeOCi1xuICAgIGNocm9tZS53ZWJSZXF1ZXN0Lm9uQ29tcGxldGVkLmFkZExpc3RlbmVyKGFzeW5jIChkZXRhaWxzKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBkZXRhaWxzIOOBqyByZW1vdGVJcCDjgYzlkKvjgb7jgozjgovvvIhNYW5pZmVzdCBWMyArIGhvc3RfcGVybWlzc2lvbnMg44GM5b+F6KaB77yJXG4gICAgICAgIGNvbnN0IHJlbW90ZUlwID0gZGV0YWlscy5pcDtcbiAgICAgICAgY29uc29sZS5kZWJ1ZygnW2Vudi1tYXJrZXJdW2JhY2tncm91bmRdIG9uQ29tcGxldGVkJywge3VybDogZGV0YWlscy51cmwsIHRhYklkOiBkZXRhaWxzLnRhYklkLCByZW1vdGVJcCwgZGV0YWlsc30pO1xuICAgICAgICBpZiAoIXJlbW90ZUlwKSB7XG4gICAgICAgICAgY29uc29sZS5kZWJ1ZygnW2Vudi1tYXJrZXJdW2JhY2tncm91bmRdIG5vIHJlbW90ZSBJUCBhdmFpbGFibGUgZm9yIHJlcXVlc3QnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIOOBmeOBueOBpuOBruacieWKueOBquioreWumuODl+ODreODleOCoeOCpOODq+OCkuODgeOCp+ODg+OCr1xuICAgICAgICBjb25zdCBhbGxTZXR0aW5ncyA9IFsnc2V0dGluZzEnLCAnc2V0dGluZzInLCAnc2V0dGluZzMnLCAnc2V0dGluZzQnLCAnc2V0dGluZzUnXTtcbiAgICAgICAgbGV0IG1hdGNoZWRSZXN1bHQ6IHsgcGF0dGVybjogc3RyaW5nOyBjb2xvcjogc3RyaW5nIH0gfCBudWxsID0gbnVsbDtcblxuICAgICAgICBmb3IgKGNvbnN0IHNldHRpbmdLZXkgb2YgYWxsU2V0dGluZ3MpIHtcbiAgICAgICAgICBjb25zdCBkYXRhID0gYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc3luYy5nZXQoe1xuICAgICAgICAgICAgW2Ake3NldHRpbmdLZXl9X3BhdHRlcm5zYF06IFtdLFxuICAgICAgICAgICAgW2Ake3NldHRpbmdLZXl9X2NvbG9yYF06ICcjZmY2NjY2JyxcbiAgICAgICAgICAgIFtgJHtzZXR0aW5nS2V5fV9lbmFibGVkYF06IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBcbiAgICAgICAgICBjb25zdCBlbmFibGVkID0gZGF0YVtgJHtzZXR0aW5nS2V5fV9lbmFibGVkYF07XG4gICAgICAgICAgaWYgKCFlbmFibGVkKSB7XG4gICAgICAgICAgICBjb25zb2xlLmRlYnVnKGBbZW52LW1hcmtlcl1bYmFja2dyb3VuZF0gJHtzZXR0aW5nS2V5fSBpcyBkaXNhYmxlZCwgc2tpcHBpbmdgKTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCBwYXR0ZXJuczogc3RyaW5nW10gPSBkYXRhW2Ake3NldHRpbmdLZXl9X3BhdHRlcm5zYF0gfHwgW107XG4gICAgICAgICAgbGV0IGNvbG9yOiBzdHJpbmcgPSBkYXRhW2Ake3NldHRpbmdLZXl9X2NvbG9yYF0gfHwgJyNmZjY2NjYnO1xuICAgICAgICAgIFxuICAgICAgICAgIGlmICgoIXBhdHRlcm5zIHx8IHBhdHRlcm5zLmxlbmd0aCA9PT0gMCkgfHwgIWNvbG9yKSB7XG4gICAgICAgICAgICBjb25zdCBmYWxsYmFjayA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldCh7XG4gICAgICAgICAgICAgIFtgJHtzZXR0aW5nS2V5fV9wYXR0ZXJuc2BdOiBbXSxcbiAgICAgICAgICAgICAgW2Ake3NldHRpbmdLZXl9X2NvbG9yYF06ICcjZmY2NjY2J1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoKCFwYXR0ZXJucyB8fCBwYXR0ZXJucy5sZW5ndGggPT09IDApICYmIGZhbGxiYWNrW2Ake3NldHRpbmdLZXl9X3BhdHRlcm5zYF0gJiYgZmFsbGJhY2tbYCR7c2V0dGluZ0tleX1fcGF0dGVybnNgXS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUuZGVidWcoJ1tlbnYtbWFya2VyXVtiYWNrZ3JvdW5kXSBzeW5jIGVtcHR5LCB1c2luZyBsb2NhbCBzdG9yYWdlIHBhdHRlcm5zJywgZmFsbGJhY2tbYCR7c2V0dGluZ0tleX1fcGF0dGVybnNgXSk7XG4gICAgICAgICAgICAgIHBhdHRlcm5zID0gZmFsbGJhY2tbYCR7c2V0dGluZ0tleX1fcGF0dGVybnNgXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICgoIWNvbG9yIHx8IGNvbG9yID09PSAnJykgJiYgZmFsbGJhY2tbYCR7c2V0dGluZ0tleX1fY29sb3JgXSkge1xuICAgICAgICAgICAgICBjb2xvciA9IGZhbGxiYWNrW2Ake3NldHRpbmdLZXl9X2NvbG9yYF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgbWF0Y2hlZFBhdHRlcm4gPSBwYXR0ZXJucy5maW5kKChwYXR0ZXJuOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICAgIGlmIChwYXR0ZXJuLnRyaW0oKSA9PT0gJycpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlZ2V4UGF0dGVybiA9IHBhdHRlcm5cbiAgICAgICAgICAgICAgICAucmVwbGFjZSgvWy4rP14ke30oKXxbXFxcXF0vZywgJ1xcXFwkJicpIC8vIC4g44KEICsg44Gq44Gp44Gu5paH5a2X44KS44Ko44K544Kx44O844OXXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcKi9nLCAnLionKTsgLy8g44Ki44K544K/44Oq44K544Kv44KS44Ov44Kk44Or44OJ44Kr44O844OJ44Gr5aSJ5o+bXG4gICAgICAgICAgICAgIFxuICAgICAgICAgICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAocmVnZXhQYXR0ZXJuKTtcbiAgICAgICAgICAgICAgLy8gVVJMIOOBvuOBn+OBryBJUOOCouODieODrOOCueOBq+WvvuOBl+OBpuato+imj+ihqOePvuODhuOCueODiOOCkuWun+ihjFxuICAgICAgICAgICAgICByZXR1cm4gcmVnZXgudGVzdChkZXRhaWxzLnVybCkgfHwgKHJlbW90ZUlwICYmIHJlZ2V4LnRlc3QocmVtb3RlSXApKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgW2Vudi1tYXJrZXJdW2JhY2tncm91bmRdIEludmFsaWQgcmVnZXggcGF0dGVybiBmcm9tIHVzZXIgaW5wdXQ6IFwiJHtwYXR0ZXJufVwiYCwgZSk7XG4gICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChtYXRjaGVkUGF0dGVybikge1xuICAgICAgICAgICAgY29uc29sZS5pbmZvKGBbZW52LW1hcmtlcl1bYmFja2dyb3VuZF0gTWF0Y2hlZCB3aXRoICR7c2V0dGluZ0tleX06YCwgbWF0Y2hlZFBhdHRlcm4pO1xuICAgICAgICAgICAgbWF0Y2hlZFJlc3VsdCA9IHsgcGF0dGVybjogbWF0Y2hlZFBhdHRlcm4sIGNvbG9yOiBjb2xvciB9O1xuICAgICAgICAgICAgYnJlYWs7IC8vIOacgOWIneOBq+ODnuODg+ODgeOBl+OBn+ioreWumuOCkuS9v+eUqFxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbWF0Y2hlZFJlc3VsdCkge1xuICAgICAgICAgIGNvbnNvbGUuZGVidWcoJ1tlbnYtbWFya2VyXVtiYWNrZ3JvdW5kXSBubyBwYXR0ZXJuIG1hdGNoZWQnLCB7dXJsOiBkZXRhaWxzLnVybCwgcmVtb3RlSXB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyDlr77osaHjgr/jg5bjgavjg6Hjg4Pjgrvjg7zjgrjpgIHkv6HjgZfjgabjg5Djg4rjg7zjgpLooajnpLrjgZXjgZvjgotcbiAgICAgICAgaWYgKGRldGFpbHMudGFiSWQgJiYgZGV0YWlscy50YWJJZCAhPT0gLTEpIHtcbiAgICAgICAgICBjb25zb2xlLmluZm8oJ1tlbnYtbWFya2VyXVtiYWNrZ3JvdW5kXSBtYXRjaCBmb3VuZCwgc2VuZGluZyBtZXNzYWdlIHRvIHRhYicsIHt0YWJJZDogZGV0YWlscy50YWJJZCwgcGF0dGVybjogbWF0Y2hlZFJlc3VsdC5wYXR0ZXJuLCBjb2xvcjogbWF0Y2hlZFJlc3VsdC5jb2xvcn0pO1xuICAgICAgICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKGRldGFpbHMudGFiSWQsIHt0eXBlOiAnc2hvdy1lbnYtbWFya2VyLWJhbm5lcicsIHRleHQ6IG1hdGNoZWRSZXN1bHQucGF0dGVybiwgY29sb3I6IG1hdGNoZWRSZXN1bHQuY29sb3J9KTtcbiAgICAgICAgICAvLyDmi6HlvLXjga7jgqLjgqTjgrPjg7Pjgavjg5Djg4PjgrjjgpLooajnpLpcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY2hyb21lLmFjdGlvbi5zZXRCYWRnZVRleHQoe3RleHQ6ICdFTlYnLCB0YWJJZDogZGV0YWlscy50YWJJZH0pO1xuICAgICAgICAgICAgLy8g44OQ44OD44K46Imy44GvIHN0b3JhZ2Ug44GuIGNvbG9yIOOCkuS9v+OBhu+8iGNocm9tZSBhY2NlcHRzIFtyLGcsYixhXSBvciBDU1Mgc3RyaW5n77yJXG4gICAgICAgICAgICBjaHJvbWUuYWN0aW9uLnNldEJhZGdlQmFja2dyb3VuZENvbG9yKHtjb2xvcjogbWF0Y2hlZFJlc3VsdC5jb2xvciwgdGFiSWQ6IGRldGFpbHMudGFiSWR9KTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmRlYnVnKCdbZW52LW1hcmtlcl1bYmFja2dyb3VuZF0gdW5hYmxlIHRvIHNldCBiYWRnZScsIGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmRlYnVnKCdbZW52LW1hcmtlcl1bYmFja2dyb3VuZF0gbWF0Y2hlZCBJUCBidXQgbm8gdGFiSWQgYXZhaWxhYmxlJywge2lwOiByZW1vdGVJcCwgdGFiSWQ6IGRldGFpbHMudGFiSWR9KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgfVxuICAgIH0sIHt1cmxzOiBbXCI8YWxsX3VybHM+XCJdfSk7XG5cbiAgICAvLyDjgr/jg5bjgYzmm7TmlrDvvIjjg4rjg5PjgrLjg7zjgrfjg6fjg7PnrYnvvInjgZXjgozjgZ/jgonjg5Djg4PjgrjjgpLjgq/jg6rjgqLjgZnjgotcbiAgICBjaHJvbWUudGFicy5vblVwZGF0ZWQuYWRkTGlzdGVuZXIoKHRhYklkLCBjaGFuZ2VJbmZvLCB0YWIpID0+IHtcbiAgICAgIC8vIOODmuODvOOCuOOBruiqreOBv+i+vOOBv+mWi+Wniy/lrozkuobmmYLjgavjg5Djg4PjgrjjgpLjgq/jg6rjgqLjgZnjgotcbiAgICAgIGlmIChjaGFuZ2VJbmZvLnN0YXR1cyA9PT0gJ2xvYWRpbmcnIHx8IGNoYW5nZUluZm8uc3RhdHVzID09PSAnY29tcGxldGUnIHx8IGNoYW5nZUluZm8udXJsKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY2hyb21lLmFjdGlvbi5zZXRCYWRnZVRleHQoe3RleHQ6ICcnLCB0YWJJZH0pO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgLy8gaWdub3JlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIOOCueODiOODrOODvOOCuOOBruWkieabtOOCkuebo+imluOBl+OBpuODh+ODkOODg+OCsOODreOCsOOCkuWHuuWKm1xuICAgIGNocm9tZS5zdG9yYWdlLm9uQ2hhbmdlZC5hZGRMaXN0ZW5lcigoY2hhbmdlcywgbmFtZXNwYWNlKSA9PiB7XG4gICAgICBmb3IgKGxldCBba2V5LCB7IG9sZFZhbHVlLCBuZXdWYWx1ZSB9XSBvZiBPYmplY3QuZW50cmllcyhjaGFuZ2VzKSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICBgW2Vudi1tYXJrZXJdW3N0b3JhZ2VdIFN0b3JhZ2Uga2V5IFwiJHtrZXl9XCIgaW4gbmFtZXNwYWNlIFwiJHtuYW1lc3BhY2V9XCIgY2hhbmdlZC5gLFxuICAgICAgICAgIGBPbGQgdmFsdWUgd2FzOmAsIG9sZFZhbHVlLFxuICAgICAgICAgIGBOZXcgdmFsdWUgaXM6YCwgbmV3VmFsdWVcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufSk7XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCIvLyBzcmMvaW5kZXgudHNcbnZhciBfTWF0Y2hQYXR0ZXJuID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4pIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuID09PSBcIjxhbGxfdXJscz5cIikge1xuICAgICAgdGhpcy5pc0FsbFVybHMgPSB0cnVlO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBbLi4uX01hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG4gICAgICBpZiAoZ3JvdXBzID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuICAgICAgY29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuICAgICAgdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcbiAgICAgIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG4gICAgICB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBwcm90b2NvbCA9PT0gXCIqXCIgPyBbXCJodHRwXCIsIFwiaHR0cHNcIl0gOiBbcHJvdG9jb2xdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBwYXRobmFtZTtcbiAgICB9XG4gIH1cbiAgaW5jbHVkZXModXJsKSB7XG4gICAgaWYgKHRoaXMuaXNBbGxVcmxzKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgdSA9IHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIgPyBuZXcgVVJMKHVybCkgOiB1cmwgaW5zdGFuY2VvZiBMb2NhdGlvbiA/IG5ldyBVUkwodXJsLmhyZWYpIDogdXJsO1xuICAgIHJldHVybiAhIXRoaXMucHJvdG9jb2xNYXRjaGVzLmZpbmQoKHByb3RvY29sKSA9PiB7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwc1wiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZmlsZVwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0ZpbGVNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGdHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJ1cm5cIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcbiAgICB9KTtcbiAgfVxuICBpc0h0dHBNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHA6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0h0dHBzTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwczpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcbiAgICBpZiAoIXRoaXMuaG9zdG5hbWVNYXRjaCB8fCAhdGhpcy5wYXRobmFtZU1hdGNoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGhvc3RuYW1lTWF0Y2hSZWdleHMgPSBbXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gpLFxuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoLnJlcGxhY2UoL15cXCpcXC4vLCBcIlwiKSlcbiAgICBdO1xuICAgIGNvbnN0IHBhdGhuYW1lTWF0Y2hSZWdleCA9IHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCk7XG4gICAgcmV0dXJuICEhaG9zdG5hbWVNYXRjaFJlZ2V4cy5maW5kKChyZWdleCkgPT4gcmVnZXgudGVzdCh1cmwuaG9zdG5hbWUpKSAmJiBwYXRobmFtZU1hdGNoUmVnZXgudGVzdCh1cmwucGF0aG5hbWUpO1xuICB9XG4gIGlzRmlsZU1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmaWxlOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc0Z0cE1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmdHA6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzVXJuTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgY29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKTtcbiAgICBjb25zdCBzdGFyc1JlcGxhY2VkID0gZXNjYXBlZC5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG4gICAgcmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG4gIH1cbiAgZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG4gIH1cbn07XG52YXIgTWF0Y2hQYXR0ZXJuID0gX01hdGNoUGF0dGVybjtcbk1hdGNoUGF0dGVybi5QUk9UT0NPTFMgPSBbXCJodHRwXCIsIFwiaHR0cHNcIiwgXCJmaWxlXCIsIFwiZnRwXCIsIFwidXJuXCJdO1xudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuLCByZWFzb24pIHtcbiAgICBzdXBlcihgSW52YWxpZCBtYXRjaCBwYXR0ZXJuIFwiJHttYXRjaFBhdHRlcm59XCI6ICR7cmVhc29ufWApO1xuICB9XG59O1xuZnVuY3Rpb24gdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKSB7XG4gIGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYEhvc3RuYW1lIGNhbm5vdCBpbmNsdWRlIGEgcG9ydGApO1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCIqXCIpICYmIGhvc3RuYW1lLmxlbmd0aCA+IDEgJiYgIWhvc3RuYW1lLnN0YXJ0c1dpdGgoXCIqLlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpIHtcbiAgcmV0dXJuO1xufVxuZXhwb3J0IHtcbiAgSW52YWxpZE1hdGNoUGF0dGVybixcbiAgTWF0Y2hQYXR0ZXJuXG59O1xuIl0sIm5hbWVzIjpbImJyb3dzZXIiLCJfYnJvd3NlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxXQUFZLFFBQU8sRUFBRSxNQUFNLElBQUc7QUFDaEUsV0FBTztBQUFBLEVBQ1Q7QUNIQSxRQUFBLGFBQUEsaUJBQUE7QUFBQSxJQUFnQyxPQUFBO0FBSTVCLGFBQUEsUUFBQSxZQUFBLFlBQUEsTUFBQTtBQUNFLGdCQUFBLElBQUEsc0JBQUE7QUFBQSxNQUFrQyxDQUFBO0FBSXBDLGFBQUEsT0FBQSxVQUFBLFlBQUEsTUFBQTtBQUNFLGVBQUEsUUFBQSxnQkFBQTtBQUFBLE1BQStCLENBQUE7QUFJakMsYUFBQSxXQUFBLFlBQUEsWUFBQSxPQUFBLFlBQUE7QUFDRSxZQUFBO0FBRUUsZ0JBQUEsV0FBQSxRQUFBO0FBQ0Esa0JBQUEsTUFBQSx3Q0FBQSxFQUFBLEtBQUEsUUFBQSxLQUFBLE9BQUEsUUFBQSxPQUFBLFVBQUEsUUFBQSxDQUFBO0FBQ0EsY0FBQSxDQUFBLFVBQUE7QUFDRSxvQkFBQSxNQUFBLDZEQUFBO0FBQ0E7QUFBQSxVQUFBO0FBSUYsZ0JBQUEsY0FBQSxDQUFBLFlBQUEsWUFBQSxZQUFBLFlBQUEsVUFBQTtBQUNBLGNBQUEsZ0JBQUE7QUFFQSxxQkFBQSxjQUFBLGFBQUE7QUFDRSxrQkFBQSxPQUFBLE1BQUEsT0FBQSxRQUFBLEtBQUEsSUFBQTtBQUFBLGNBQTJDLENBQUEsR0FBQSxVQUFBLFdBQUEsR0FBQSxDQUFBO0FBQUEsY0FDWixDQUFBLEdBQUEsVUFBQSxRQUFBLEdBQUE7QUFBQSxjQUNKLENBQUEsR0FBQSxVQUFBLFVBQUEsR0FBQTtB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SyxJQUFJLFFBQVE7QUFBQSxJQUNoSDtBQUFBLElBQ0EsWUFBWSxLQUFLO0FBQ2YsWUFBTSxNQUFNLHFFQUFxRTtBQUFBLElBQ25GO0FBQUEsSUFDQSxXQUFXLEtBQUs7QUFDZCxZQUFNLE1BQU0sb0VBQW9FO0FBQUEsSUFDbEY7QUFBQSxJQUNBLFdBQVcsS0FBSztBQUNkLFlBQU0sTUFBTSxvRUFBb0U7QUFBQSxJQUNsRjtBQUFBLElBQ0Esc0JBQXNCLFNBQVM7QUFDN0IsWUFBTSxVQUFVLEtBQUssZUFBZSxPQUFPO0FBQzNDLFlBQU0sZ0JBQWdCLFFBQVEsUUFBUSxTQUFTLElBQUk7QUFDbkQsYUFBTyxPQUFPLElBQUksYUFBYSxHQUFHO0FBQUEsSUFDcEM7QUFBQSxJQUNBLGVBQWUsUUFBUTtBQUNyQixhQUFPLE9BQU8sUUFBUSx1QkFBdUIsTUFBTTtBQUFBLElBQ3JEO0FBQUEsRUFDRjtBQUNBLE1BQUksZUFBZTtBQUNuQixlQUFhLFlBQVksQ0FBQyxRQUFRLFNBQVMsUUFBUSxPQUFPLEtBQUs7QUFDL0QsTUFBSSxzQkFBc0IsY0FBYyxNQUFNO0FBQUEsSUFDNUMsWUFBWSxjQUFjLFFBQVE7QUFDaEMsWUFBTSwwQkFBMEIsWUFBWSxNQUFNLE1BQU0sRUFBRTtBQUFBLElBQzVEO0FBQUEsRUFDRjtBQUNBLFdBQVMsaUJBQWlCLGNBQWMsVUFBVTtBQUNoRCxRQUFJLENBQUMsYUFBYSxVQUFVLFNBQVMsUUFBUSxLQUFLLGFBQWE7QUFDN0QsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0EsR0FBRyxRQUFRLDBCQUEwQixhQUFhLFVBQVUsS0FBSyxJQUFJLENBQUM7QUFBQSxNQUM1RTtBQUFBLEVBQ0E7QUFDQSxXQUFTLGlCQUFpQixjQUFjLFVBQVU7QUFDaEQsUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN2QixZQUFNLElBQUksb0JBQW9CLGNBQWMsZ0NBQWdDO0FBQzlFLFFBQUksU0FBUyxTQUFTLEdBQUcsS0FBSyxTQUFTLFNBQVMsS0FBSyxDQUFDLFNBQVMsV0FBVyxJQUFJO0FBQzVFLFlBQU0sSUFBSTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsTUFDTjtBQUFBLEVBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwyLDMsNF19
