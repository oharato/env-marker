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
          const { currentSetting } = await chrome.storage.sync.get({ currentSetting: "setting1" });
          const settingKey = currentSetting;
          const storageKeys = {
            patterns: `${settingKey}_patterns`,
            color: `${settingKey}_color`
          };
          let data = await chrome.storage.sync.get({
            [storageKeys.patterns]: [],
            [storageKeys.color]: "#ff6666"
          });
          let patterns = data[storageKeys.patterns] || [];
          let color = data[storageKeys.color] || "#ff6666";
          if (!patterns || patterns.length === 0 || !color) {
            const fallback = await chrome.storage.local.get({
              [storageKeys.patterns]: [],
              [storageKeys.color]: "#ff6666"
            });
            if ((!patterns || patterns.length === 0) && fallback[storageKeys.patterns] && fallback[storageKeys.patterns].length > 0) {
              console.debug("[env-marker][background] sync empty, using local storage patterns", fallback[storageKeys.patterns]);
              patterns = fallback[storageKeys.patterns];
            }
            if ((!color || color === "") && fallback[storageKeys.color]) {
              color = fallback[storageKeys.color];
            }
          }
          console.debug("[env-marker][background] stored patterns", patterns);
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
          if (!matchedPattern) {
            console.debug("[env-marker][background] no pattern matched", { url: details.url, remoteIp });
            return;
          }
          if (details.tabId && details.tabId !== -1) {
            console.info("[env-marker][background] match found, sending message to tab", { tabId: details.tabId, pattern: matchedPattern, color });
            chrome.tabs.sendMessage(details.tabId, { type: "show-env-marker-banner", text: matchedPattern, color });
            try {
              chrome.action.setBadgeText({ text: "ENV", tabId: details.tabId });
              chrome.action.setBadgeBackgroundColor({ color, tabId: details.tabId });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtYmFja2dyb3VuZC5tanMiLCIuLi8uLi9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3eHQtZGV2K2Jyb3dzZXJAMC4xLjQvbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvYnJvd3Nlci5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHdlYmV4dC1jb3JlK21hdGNoLXBhdHRlcm5zQDEuMC4zL25vZGVfbW9kdWxlcy9Ad2ViZXh0LWNvcmUvbWF0Y2gtcGF0dGVybnMvbGliL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuICBpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcbiAgcmV0dXJuIGFyZztcbn1cbiIsImV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoe1xuICBtYWluKCkge1xuICAgIC8vIGJhY2tncm91bmQuanNcbiAgICAvLyDjgZPjgZPjgafjga/lv4XopoHjgavlv5zjgZjjgablsIbmnaXjga7mi6HlvLXmqZ/og73jg63jgrjjg4Pjgq/jgpLov73liqDjgafjgY3jgb7jgZnjgIJcbiAgICBjaHJvbWUucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4gICAgICBjb25zb2xlLmxvZygnRW52IE1hcmtlciBpbnN0YWxsZWQnKTtcbiAgICB9KTtcblxuICAgIC8vIOaLoeW8teapn+iDveOCouOCpOOCs+ODs+OCkuOCr+ODquODg+OCr+OBl+OBn+OCieioreWumueUu+mdouOCkumWi+OBj1xuICAgIGNocm9tZS5hY3Rpb24ub25DbGlja2VkLmFkZExpc3RlbmVyKCgpID0+IHtcbiAgICAgIGNocm9tZS5ydW50aW1lLm9wZW5PcHRpb25zUGFnZSgpO1xuICAgIH0pO1xuXG4gICAgLy8gd2ViUmVxdWVzdCDjga4gb25Db21wbGV0ZWQg44Gn5o6l57aa5YWI44GuIElQIOOCkuWPluW+l+OBl+OBpuOAgeebo+imluODquOCueODiOOBq+WQq+OBvuOCjOOBpuOBhOOCjOOBsOOCv+ODluOBuOmAmuefpeOBmeOCi1xuICAgIGNocm9tZS53ZWJSZXF1ZXN0Lm9uQ29tcGxldGVkLmFkZExpc3RlbmVyKGFzeW5jIChkZXRhaWxzKSA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICAvLyBkZXRhaWxzIOOBqyByZW1vdGVJcCDjgYzlkKvjgb7jgozjgovvvIhNYW5pZmVzdCBWMyArIGhvc3RfcGVybWlzc2lvbnMg44GM5b+F6KaB77yJXG4gICAgICAgIGNvbnN0IHJlbW90ZUlwID0gZGV0YWlscy5pcDtcbiAgICAgICAgY29uc29sZS5kZWJ1ZygnW2Vudi1tYXJrZXJdW2JhY2tncm91bmRdIG9uQ29tcGxldGVkJywge3VybDogZGV0YWlscy51cmwsIHRhYklkOiBkZXRhaWxzLnRhYklkLCByZW1vdGVJcCwgZGV0YWlsc30pO1xuICAgICAgICBpZiAoIXJlbW90ZUlwKSB7XG4gICAgICAgICAgY29uc29sZS5kZWJ1ZygnW2Vudi1tYXJrZXJdW2JhY2tncm91bmRdIG5vIHJlbW90ZSBJUCBhdmFpbGFibGUgZm9yIHJlcXVlc3QnKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgXG4gICAgICAgIC8vIEdldCBjdXJyZW50IHNldHRpbmcgcHJvZmlsZVxuICAgICAgICBjb25zdCB7IGN1cnJlbnRTZXR0aW5nIH0gPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zeW5jLmdldCh7Y3VycmVudFNldHRpbmc6ICdzZXR0aW5nMSd9KSBhcyB7IGN1cnJlbnRTZXR0aW5nOiBzdHJpbmcgfTtcbiAgICAgICAgY29uc3Qgc2V0dGluZ0tleSA9IGN1cnJlbnRTZXR0aW5nO1xuICAgICAgICBcbiAgICAgICAgY29uc3Qgc3RvcmFnZUtleXMgPSB7XG4gICAgICAgICAgcGF0dGVybnM6IGAke3NldHRpbmdLZXl9X3BhdHRlcm5zYCxcbiAgICAgICAgICBjb2xvcjogYCR7c2V0dGluZ0tleX1fY29sb3JgLFxuICAgICAgICB9O1xuICAgICAgICBcbiAgICAgICAgbGV0IGRhdGEgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zeW5jLmdldCh7XG4gICAgICAgICAgW3N0b3JhZ2VLZXlzLnBhdHRlcm5zXTogW10sXG4gICAgICAgICAgW3N0b3JhZ2VLZXlzLmNvbG9yXTogJyNmZjY2NjYnXG4gICAgICAgIH0pO1xuICAgICAgICBcbiAgICAgICAgbGV0IHBhdHRlcm5zOiBzdHJpbmdbXSA9IGRhdGFbc3RvcmFnZUtleXMucGF0dGVybnNdIHx8IFtdO1xuICAgICAgICBsZXQgY29sb3I6IHN0cmluZyA9IGRhdGFbc3RvcmFnZUtleXMuY29sb3JdIHx8ICcjZmY2NjY2JztcbiAgICAgICAgXG4gICAgICAgIGlmICgoIXBhdHRlcm5zIHx8IHBhdHRlcm5zLmxlbmd0aCA9PT0gMCkgfHwgIWNvbG9yKSB7XG4gICAgICAgICAgY29uc3QgZmFsbGJhY2sgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoe1xuICAgICAgICAgICAgW3N0b3JhZ2VLZXlzLnBhdHRlcm5zXTogW10sXG4gICAgICAgICAgICBbc3RvcmFnZUtleXMuY29sb3JdOiAnI2ZmNjY2NidcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpZiAoKCFwYXR0ZXJucyB8fCBwYXR0ZXJucy5sZW5ndGggPT09IDApICYmIGZhbGxiYWNrW3N0b3JhZ2VLZXlzLnBhdHRlcm5zXSAmJiBmYWxsYmFja1tzdG9yYWdlS2V5cy5wYXR0ZXJuc10ubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgY29uc29sZS5kZWJ1ZygnW2Vudi1tYXJrZXJdW2JhY2tncm91bmRdIHN5bmMgZW1wdHksIHVzaW5nIGxvY2FsIHN0b3JhZ2UgcGF0dGVybnMnLCBmYWxsYmFja1tzdG9yYWdlS2V5cy5wYXR0ZXJuc10pO1xuICAgICAgICAgICAgcGF0dGVybnMgPSBmYWxsYmFja1tzdG9yYWdlS2V5cy5wYXR0ZXJuc107XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoIWNvbG9yIHx8IGNvbG9yID09PSAnJykgJiYgZmFsbGJhY2tbc3RvcmFnZUtleXMuY29sb3JdKSB7XG4gICAgICAgICAgICBjb2xvciA9IGZhbGxiYWNrW3N0b3JhZ2VLZXlzLmNvbG9yXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc29sZS5kZWJ1ZygnW2Vudi1tYXJrZXJdW2JhY2tncm91bmRdIHN0b3JlZCBwYXR0ZXJucycsIHBhdHRlcm5zKTtcblxuICAgICAgICBjb25zdCBtYXRjaGVkUGF0dGVybiA9IHBhdHRlcm5zLmZpbmQoKHBhdHRlcm46IHN0cmluZykgPT4ge1xuICAgICAgICAgIGlmIChwYXR0ZXJuLnRyaW0oKSA9PT0gJycpIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVnZXhQYXR0ZXJuID0gcGF0dGVyblxuICAgICAgICAgICAgICAucmVwbGFjZSgvWy4rP14ke30oKXxbXFxcXF0vZywgJ1xcXFwkJicpIC8vIC4g44KEICsg44Gq44Gp44Gu5paH5a2X44KS44Ko44K544Kx44O844OXXG4gICAgICAgICAgICAgIC5yZXBsYWNlKC9cXCovZywgJy4qJyk7IC8vIOOCouOCueOCv+ODquOCueOCr+OCkuODr+OCpOODq+ODieOCq+ODvOODieOBq+WkieaPm1xuICAgICAgICAgICAgXG4gICAgICAgICAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAocmVnZXhQYXR0ZXJuKTtcbiAgICAgICAgICAgIC8vIFVSTCDjgb7jgZ/jga8gSVDjgqLjg4njg6zjgrnjgavlr77jgZfjgabmraPopo/ooajnj77jg4bjgrnjg4jjgpLlrp/ooYxcbiAgICAgICAgICAgIHJldHVybiByZWdleC50ZXN0KGRldGFpbHMudXJsKSB8fCAocmVtb3RlSXAgJiYgcmVnZXgudGVzdChyZW1vdGVJcCkpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtlbnYtbWFya2VyXVtiYWNrZ3JvdW5kXSBJbnZhbGlkIHJlZ2V4IHBhdHRlcm4gZnJvbSB1c2VyIGlucHV0OiBcIiR7cGF0dGVybn1cImAsIGUpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKCFtYXRjaGVkUGF0dGVybikge1xuICAgICAgICAgIGNvbnNvbGUuZGVidWcoJ1tlbnYtbWFya2VyXVtiYWNrZ3JvdW5kXSBubyBwYXR0ZXJuIG1hdGNoZWQnLCB7dXJsOiBkZXRhaWxzLnVybCwgcmVtb3RlSXB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyDlr77osaHjgr/jg5bjgavjg6Hjg4Pjgrvjg7zjgrjpgIHkv6HjgZfjgabjg5Djg4rjg7zjgpLooajnpLrjgZXjgZvjgotcbiAgICAgICAgaWYgKGRldGFpbHMudGFiSWQgJiYgZGV0YWlscy50YWJJZCAhPT0gLTEpIHtcbiAgICAgICAgICBjb25zb2xlLmluZm8oJ1tlbnYtbWFya2VyXVtiYWNrZ3JvdW5kXSBtYXRjaCBmb3VuZCwgc2VuZGluZyBtZXNzYWdlIHRvIHRhYicsIHt0YWJJZDogZGV0YWlscy50YWJJZCwgcGF0dGVybjogbWF0Y2hlZFBhdHRlcm4sIGNvbG9yfSk7XG4gICAgICAgICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UoZGV0YWlscy50YWJJZCwge3R5cGU6ICdzaG93LWVudi1tYXJrZXItYmFubmVyJywgdGV4dDogbWF0Y2hlZFBhdHRlcm4sIGNvbG9yfSk7XG4gICAgICAgICAgLy8g5ouh5by144Gu44Ki44Kk44Kz44Oz44Gr44OQ44OD44K444KS6KGo56S6XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHt0ZXh0OiAnRU5WJywgdGFiSWQ6IGRldGFpbHMudGFiSWR9KTtcbiAgICAgICAgICAgIC8vIOODkOODg+OCuOiJsuOBryBzdG9yYWdlIOOBriBjb2xvciDjgpLkvb/jgYbvvIhjaHJvbWUgYWNjZXB0cyBbcixnLGIsYV0gb3IgQ1NTIHN0cmluZ++8iVxuICAgICAgICAgICAgY2hyb21lLmFjdGlvbi5zZXRCYWRnZUJhY2tncm91bmRDb2xvcih7Y29sb3I6IGNvbG9yLCB0YWJJZDogZGV0YWlscy50YWJJZH0pO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZGVidWcoJ1tlbnYtbWFya2VyXVtiYWNrZ3JvdW5kXSB1bmFibGUgdG8gc2V0IGJhZGdlJywgZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZGVidWcoJ1tlbnYtbWFya2VyXVtiYWNrZ3JvdW5kXSBtYXRjaGVkIElQIGJ1dCBubyB0YWJJZCBhdmFpbGFibGUnLCB7aXA6IHJlbW90ZUlwLCB0YWJJZDogZGV0YWlscy50YWJJZH0pO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICB9XG4gICAgfSwge3VybHM6IFtcIjxhbGxfdXJscz5cIl19KTtcblxuICAgIC8vIOOCv+ODluOBjOabtOaWsO+8iOODiuODk+OCsuODvOOCt+ODp+ODs+etie+8ieOBleOCjOOBn+OCieODkOODg+OCuOOCkuOCr+ODquOCouOBmeOCi1xuICAgIGNocm9tZS50YWJzLm9uVXBkYXRlZC5hZGRMaXN0ZW5lcigodGFiSWQsIGNoYW5nZUluZm8sIHRhYikgPT4ge1xuICAgICAgLy8g44Oa44O844K444Gu6Kqt44G/6L6844G/6ZaL5aeLL+WujOS6huaZguOBq+ODkOODg+OCuOOCkuOCr+ODquOCouOBmeOCi1xuICAgICAgaWYgKGNoYW5nZUluZm8uc3RhdHVzID09PSAnbG9hZGluZycgfHwgY2hhbmdlSW5mby5zdGF0dXMgPT09ICdjb21wbGV0ZScgfHwgY2hhbmdlSW5mby51cmwpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjaHJvbWUuYWN0aW9uLnNldEJhZGdlVGV4dCh7dGV4dDogJycsIHRhYklkfSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAvLyBpZ25vcmVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8g44K544OI44Os44O844K444Gu5aSJ5pu044KS55uj6KaW44GX44Gm44OH44OQ44OD44Kw44Ot44Kw44KS5Ye65YqbXG4gICAgY2hyb21lLnN0b3JhZ2Uub25DaGFuZ2VkLmFkZExpc3RlbmVyKChjaGFuZ2VzLCBuYW1lc3BhY2UpID0+IHtcbiAgICAgIGZvciAobGV0IFtrZXksIHsgb2xkVmFsdWUsIG5ld1ZhbHVlIH1dIG9mIE9iamVjdC5lbnRyaWVzKGNoYW5nZXMpKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbZW52LW1hcmtlcl1bc3RvcmFnZV0gU3RvcmFnZSBrZXkgXCIke2tleX1cIiBpbiBuYW1lc3BhY2UgXCIke25hbWVzcGFjZX1cIiBjaGFuZ2VkLmAsXG4gICAgICAgICAgYE9sZCB2YWx1ZSB3YXM6YCwgb2xkVmFsdWUsXG4gICAgICAgICAgYE5ldyB2YWx1ZSBpczpgLCBuZXdWYWx1ZVxuICAgICAgICApO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59KTtcbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsIi8vIHNyYy9pbmRleC50c1xudmFyIF9NYXRjaFBhdHRlcm4gPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybikge1xuICAgIGlmIChtYXRjaFBhdHRlcm4gPT09IFwiPGFsbF91cmxzPlwiKSB7XG4gICAgICB0aGlzLmlzQWxsVXJscyA9IHRydWU7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IFsuLi5fTWF0Y2hQYXR0ZXJuLlBST1RPQ09MU107XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBncm91cHMgPSAvKC4qKTpcXC9cXC8oLio/KShcXC8uKikvLmV4ZWMobWF0Y2hQYXR0ZXJuKTtcbiAgICAgIGlmIChncm91cHMgPT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBcIkluY29ycmVjdCBmb3JtYXRcIik7XG4gICAgICBjb25zdCBbXywgcHJvdG9jb2wsIGhvc3RuYW1lLCBwYXRobmFtZV0gPSBncm91cHM7XG4gICAgICB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpO1xuICAgICAgdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKTtcbiAgICAgIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSk7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuICAgIH1cbiAgfVxuICBpbmNsdWRlcyh1cmwpIHtcbiAgICBpZiAodGhpcy5pc0FsbFVybHMpXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG4gICAgcmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZ0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcInVyblwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuICAgIH0pO1xuICB9XG4gIGlzSHR0cE1hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSHR0cHNNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIb3N0UGF0aE1hdGNoKHVybCkge1xuICAgIGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgaG9zdG5hbWVNYXRjaFJlZ2V4cyA9IFtcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gucmVwbGFjZSgvXlxcKlxcLi8sIFwiXCIpKVxuICAgIF07XG4gICAgY29uc3QgcGF0aG5hbWVNYXRjaFJlZ2V4ID0gdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5wYXRobmFtZU1hdGNoKTtcbiAgICByZXR1cm4gISFob3N0bmFtZU1hdGNoUmVnZXhzLmZpbmQoKHJlZ2V4KSA9PiByZWdleC50ZXN0KHVybC5ob3N0bmFtZSkpICYmIHBhdGhuYW1lTWF0Y2hSZWdleC50ZXN0KHVybC5wYXRobmFtZSk7XG4gIH1cbiAgaXNGaWxlTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZpbGU6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzRnRwTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNVcm5NYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogdXJuOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBjb252ZXJ0UGF0dGVyblRvUmVnZXgocGF0dGVybikge1xuICAgIGNvbnN0IGVzY2FwZWQgPSB0aGlzLmVzY2FwZUZvclJlZ2V4KHBhdHRlcm4pO1xuICAgIGNvbnN0IHN0YXJzUmVwbGFjZWQgPSBlc2NhcGVkLnJlcGxhY2UoL1xcXFxcXCovZywgXCIuKlwiKTtcbiAgICByZXR1cm4gUmVnRXhwKGBeJHtzdGFyc1JlcGxhY2VkfSRgKTtcbiAgfVxuICBlc2NhcGVGb3JSZWdleChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbiAgfVxufTtcbnZhciBNYXRjaFBhdHRlcm4gPSBfTWF0Y2hQYXR0ZXJuO1xuTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUyA9IFtcImh0dHBcIiwgXCJodHRwc1wiLCBcImZpbGVcIiwgXCJmdHBcIiwgXCJ1cm5cIl07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuICAgIHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG4gIH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcbiAgaWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgJHtwcm90b2NvbH0gbm90IGEgdmFsaWQgcHJvdG9jb2wgKCR7TWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5qb2luKFwiLCBcIil9KWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKSB7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIjpcIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBgSG9zdG5hbWUgY2Fubm90IGluY2x1ZGUgYSBwb3J0YCk7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIipcIikgJiYgaG9zdG5hbWUubGVuZ3RoID4gMSAmJiAhaG9zdG5hbWUuc3RhcnRzV2l0aChcIiouXCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSkge1xuICByZXR1cm47XG59XG5leHBvcnQge1xuICBJbnZhbGlkTWF0Y2hQYXR0ZXJuLFxuICBNYXRjaFBhdHRlcm5cbn07XG4iXSwibmFtZXMiOlsiYnJvd3NlciIsIl9icm93c2VyIl0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsaUJBQWlCLEtBQUs7QUFDcEMsUUFBSSxPQUFPLFFBQVEsT0FBTyxRQUFRLFdBQVksUUFBTyxFQUFFLE1BQU0sSUFBRztBQUNoRSxXQUFPO0FBQUEsRUFDVDtBQ0hBLFFBQUEsYUFBQSxpQkFBQTtBQUFBLElBQWdDLE9BQUE7QUFJNUIsYUFBQSxRQUFBLFlBQUEsWUFBQSxNQUFBO0FBQ0UsZ0JBQUEsSUFBQSxzQkFBQTtBQUFBLE1BQWtDLENBQUE7QUFJcEMsYUFBQSxPQUFBLFVBQUEsWUFBQSxNQUFBO0FBQ0UsZUFBQSxRQUFBLGdCQUFBO0FBQUEsTUFBK0IsQ0FBQTtBQUlqQyxhQUFBLFdBQUEsWUFBQSxZQUFBLE9BQUEsWUFBQTtBQUNFLFlBQUE7QUFFRSxnQkFBQSxXQUFBLFFBQUE7QUFDQSxrQkFBQSxNQUFBLHdDQUFBLEVBQUEsS0FBQSxRQUFBLEtBQUEsT0FBQSxRQUFBLE9BQUEsVUFBQSxRQUFBLENBQUE7QUFDQSxjQUFBLENBQUEsVUFBQTtBQUNFLG9CQUFBLE1BQUEsNkRBQUE7QUFDQTtBQUFBLFVBQUE7QUFJRixnQkFBQSxFQUFBLG1CQUFBLE1BQUEsT0FBQSxRQUFBLEtBQUEsSUFBQSxFQUFBLGdCQUFBLFlBQUE7QUFDQSxnQkFBQSxhQUFBO0FBRUEsZ0JBQUEsY0FBQTtBQUFBLFlBQW9CLFVBQUEsR0FBQSxVQUFBO0FBQUEsWUFDSyxPQUFBLEdBQUEsVUFBQTtBQUFBLFVBQ0g7QUFHdEIsY0FBQSxPQUFBLE1BQUEsT0FBQSxRQUFBLEtBQUEsSUFBQTtBQUFBLFlBQXlDLENBQUEsWUFBQSxRQUFBLEdBQUEsQ0FBQTtBQUFBLFlBQ2QsQ0FBQSxZQUFBLEtBQUEsR0FBQTtBQUFBLFVBQ0osQ0FBQTtBQUd2QixjQUFBLFdBQUEsS0FBQSxZQUFBLFFBQUEsS0FBQSxDQUFBO0FBQ0EsY0FBQSxRQUFBLEtBQUEsWUFBQSxLQUFBLEtBQUE7QUFFQSxjQUFBLENBQUEsWUFBQSxTQUFBLFdBQUEsS0FBQSxDQUFBLE9BQUE7QUFDRSxrQkFBQSxXQUFBLE1BQUEsT0FBQSxRQUFBLE1BQUEsSUFBQTtBQUFBLGNBQWdELENBQUEsWUFBQSxRQUFBLEdBQUEsQ0FBQTtBQUFBLGNBQ3JCLENBQUEsWUFBQSxLQUFBLEdBQUE7QUFBQSxZQUNKLENBQUE7QUFFdkIsaUJBQUEsQ0FBQSxZQUFBLFNBQUEsV0FBQSxNQUFBLFNBQUEsWUFBQSxRQUFBLEtBQUEsU0FBQSxZQUFBLFFBQUEsRUFBQSxTQUFBLEdBQUE7QUFDRSxzQkFBQSxNQUFBLHFFQUFBLFNBQUEsWUFBQSxRQUFBLENBQUE7QUFDQSx5QkFBQSxTQUFBLFlBQUEsUUFBQTtBQUFBLFlBQXdDO0FBRTFDLGlCQUFBLENBQUEsU0FBQSxVQUFBLE9BQUEsU0FBQSxZQUFBLEtBQUEsR0FBQTtBQUNFLHNCQUFBLFNBQUEsWUFBQSxLQUFBO0FBQUEsWUFBa0M7QUFBQSxVQUNwQztBQUVGLGtCQUFBLE1BQUEsNENBQUEsUUFBQTtBQUVBLGdCQUFBLGlCQUFBLFNBQUEsS0FBQSxDQUFBLFlBQUE7QUFDRSxnQkFBQSxRQUFBLFdBQUEsR0FBQSxRQUFBO0FBQ0EsZ0JBQUE7QUFDRSxvQkFBQSxlQUFBLFFBQUEsUUFBQSxvQkFBQSxNQUFBLEVBQUEsUUFBQSxPQUFBLElBQUE7QUFJQSxvQkFBQSxRQUFBLElBQUEsT0FBQSxZQUFBO0FBRUEscUJBQUEsTUFBQSxLQUFBLFFBQUEsR0FBQSxLQUFBLFlBQUEsTUFBQSxLQUFBLFFBQUE7QUFBQSxZQUFrRSxTQUFBLEdBQUE7QUFFbEUsc0JBQUEsTUFBQSxvRUFBQSxPQUFBLEtBQUEsQ0FBQTtBQUNBLHFCQUFBO0FBQUEsWUFBTztBQUFBLFVBQ1QsQ0FBQTtBQUdGLGNBQUEsQ0FBQSxnQkFBQTtBQUNFLG9CQUFBLE1BQUEsK0NBQUEsRUFBQSxLQUFBLFFBQUEsS0FBQSxVQUFBO0FBQ0E7QUFBQSxVQUFBO0FBSUYsY0FBQSxRQUFBLFNBQUEsUUFBQSxVQUFBLElBQUE7QUFDRSxvQkFBQSxLQUFBLGdFQUFBLEVBQUEsT0FBQSxRQUFBLE9BQUEsU0FBQSxnQkFBQSxPQUFBO0FBQ0EsbUJBQUEsS0FBQSxZQUFBLFFBQUEsT0FBQSxFQUFBLE1BQUEsMEJBQUEsTUFBQSxnQkFBQSxNQUFBLENBQUE7QUFFQSxnQkFBQTtBQUNFLHFCQUFBLE9BQUEsYUFBQSxFQUFBLE1BQUEsT0FBQSxPQUFBLFFBQUEsT0FBQTtBQUVBLHFCQUFBLE9BQUEsd0JBQUEsRUFBQSxPQUFBLE9BQUEsUUFBQSxPQUFBO0FBQUEsWUFBMEUsU0FBQSxHQUFBO0FBRTFFLHNCQUFBLE1BQUEsZ0RBQUEsQ0FBQTtBQUFBLFlBQStEO0FBQUEsVUFDakUsT0FBQTtBQUVBLG9CQUFBLE1BQUEsOERBQUEsRUFBQSxJQUFBLFVBQUEsT0FBQSxRQUFBLE9BQUE7QUFBQSxVQUFnSDtBQUFBLFFBQ2xILFNBQUEsR0FBQTtBQUVBLGtCQUFBLE1BQUEsQ0FBQTtBQUFBLFFBQWU7QUFBQSxNQUNqQixHQUFBLEVBQUEsTUFBQSxDQUFBLFlBQUEsRUFBQSxDQUFBO0FBSUYsYUFBQSxLQUFBLFVBQUEsWUFBQSxDQUFBLE9BQUEsWUFBQSxRQUFBO0FBRUUsWUFBQSxXQUFBLFdBQUEsYUFBQSxXQUFBLFdBQUEsY0FBQSxXQUFBLEtBQUE7QUFDRSxjQUFBO0FBQ0UsbUJBQUEsT0FBQSxhQUFBLEVBQUEsTUFBQSxJQUFBLE9BQUE7QUFBQSxVQUE0QyxTQUFBLEdBQUE7QUFBQSxVQUNsQztBQUFBLFFBRVo7QUFBQSxNQUNGLENBQUE7QUFJRixhQUFBLFFBQUEsVUFBQSxZQUFBLENBQUEsU0FBQSxjQUFBO0FBQ0UsaUJBQUEsQ0FBQSxLQUFBLEVBQUEsVUFBQSxTQUFBLENBQUEsS0FBQSxPQUFBLFFBQUEsT0FBQSxHQUFBO0FBQ0Usa0JBQUE7QUFBQSxZQUFRLHNDQUFBLEdBQUEsbUJBQUEsU0FBQTtBQUFBLFlBQytEO0FBQUEsWUFDckU7QUFBQSxZQUFrQjtBQUFBLFlBQ2xCO0FBQUEsVUFBaUI7QUFBQSxRQUNuQjtBQUFBLE1BQ0YsQ0FBQTtBQUFBLElBQ0Q7QUFBQSxFQUVMLENBQUE7OztBQ3ZITyxRQUFNQSxZQUFVLFdBQVcsU0FBUyxTQUFTLEtBQ2hELFdBQVcsVUFDWCxXQUFXO0FDRlIsUUFBTSxVQUFVQztBQ0F2QixNQUFJLGdCQUFnQixNQUFNO0FBQUEsSUFDeEIsWUFBWSxjQUFjO0FBQ3hCLFVBQUksaUJBQWlCLGNBQWM7QUFDakMsYUFBSyxZQUFZO0FBQ2pCLGFBQUssa0JBQWtCLENBQUMsR0FBRyxjQUFjLFNBQVM7QUFDbEQsYUFBSyxnQkFBZ0I7QUFDckIsYUFBSyxnQkFBZ0I7QUFBQSxNQUN2QixPQUFPO0FBQ0wsY0FBTSxTQUFTLHVCQUF1QixLQUFLLFlBQVk7QUFDdkQsWUFBSSxVQUFVO0FBQ1osZ0JBQU0sSUFBSSxvQkFBb0IsY0FBYyxrQkFBa0I7QUFDaEUsY0FBTSxDQUFDLEdBQUcsVUFBVSxVQUFVLFFBQVEsSUFBSTtBQUMxQyx5QkFBaUIsY0FBYyxRQUFRO0FBQ3ZDLHlCQUFpQixjQUFjLFFBQVE7QUFFdkMsYUFBSyxrQkFBa0IsYUFBYSxNQUFNLENBQUMsUUFBUSxPQUFPLElBQUksQ0FBQyxRQUFRO0FBQ3ZFLGFBQUssZ0JBQWdCO0FBQ3JCLGFBQUssZ0JBQWdCO0FBQUEsTUFDdkI7QUFBQSxJQUNGO0FBQUEsSUFDQSxTQUFTLEtBQUs7QUFDWixVQUFJLEtBQUs7QUFDUCxlQUFPO0FBQ1QsWUFBTSxJQUFJLE9BQU8sUUFBUSxXQUFXLElBQUksSUFBSSxHQUFHLElBQUksZUFBZSxXQUFXLElBQUksSUFBSSxJQUFJLElBQUksSUFBSTtBQUNqRyxhQUFPLENBQUMsQ0FBQyxLQUFLLGdCQUFnQixLQUFLLENBQUMsYUFBYTtBQUMvQyxZQUFJLGFBQWE7QUFDZixpQkFBTyxLQUFLLFlBQVksQ0FBQztBQUMzQixZQUFJLGFBQWE7QUFDZixpQkFBTyxLQUFLLGFBQWEsQ0FBQztBQUM1QixZQUFJLGFBQWE7QUFDZixpQkFBTyxLQUFLLFlBQVksQ0FBQztBQUMzQixZQUFJLGFBQWE7QUFDZixpQkFBTyxLQUFLLFdBQVcsQ0FBQztBQUMxQixZQUFJLGFBQWE7QUFDZixpQkFBTyxLQUFLLFdBQVcsQ0FBQztBQUFBLE1BQzVCLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFDQSxZQUFZLEtBQUs7QUFDZixhQUFPLElBQUksYUFBYSxXQUFXLEtBQUssZ0JBQWdCLEdBQUc7QUFBQSxJQUM3RDtBQUFBLElBQ0EsYUFBYSxLQUFLO0FBQ2hCLGFBQU8sSUFBSSxhQUFhLFlBQVksS0FBSyxnQkFBZ0IsR0FBRztBQUFBLElBQzlEO0FBQUEsSUFDQSxnQkFBZ0IsS0FBSztBQUNuQixVQUFJLENBQUMsS0FBSyxpQkFBaUIsQ0FBQyxLQUFLO0FBQy9CLGVBQU87QUFDVCxZQUFNLHNCQUFzQjtBQUFBLFFBQzFCLEtBQUssc0JBQXNCLEtBQUssYUFBYTtBQUFBLFFBQzdDLEtBQUssc0JBQXNCLEtBQUssY0FBYyxRQUFRLFNBQVMsRUFBRSxDQUFDO0FBQUEsTUFDeEU7QUFDSSxZQUFNLHFCQUFxQixLQUFLLHNCQUFzQixLQUFLLGFBQWE7QUFDeEUsYUFBTyxDQUFDLENBQUMsb0JBQW9CLEtBQUssQ0FBQyxVQUFVLE1BQU0sS0FBSyxJQUFJLFFBQVEsQ0FBQyxLQUFLLG1CQUFtQixLQUFLLElBQUksUUFBUTtBQUFBLElBQ2hIO0FBQUEsSUFDQSxZQUFZLEtBQUs7QUFDZixZQUFNLE1BQU0scUVBQXFFO0FBQUEsSUFDbkY7QUFBQSxJQUNBLFdBQVcsS0FBSztBQUNkLFlBQU0sTUFBTSxvRUFBb0U7QUFBQSxJQUNsRjtBQUFBLElBQ0EsV0FBVyxLQUFLO0FBQ2QsWUFBTSxNQUFNLG9FQUFvRTtBQUFBLElBQ2xGO0FBQUEsSUFDQSxzQkFBc0IsU0FBUztBQUM3QixZQUFNLFVBQVUsS0FBSyxlQUFlLE9BQU87QUFDM0MsWUFBTSxnQkFBZ0IsUUFBUSxRQUFRLFNBQVMsSUFBSTtBQUNuRCxhQUFPLE9BQU8sSUFBSSxhQUFhLEdBQUc7QUFBQSxJQUNwQztBQUFBLElBQ0EsZUFBZSxRQUFRO0FBQ3JCLGFBQU8sT0FBTyxRQUFRLHVCQUF1QixNQUFNO0FBQUEsSUFDckQ7QUFBQSxFQUNGO0FBQ0EsTUFBSSxlQUFlO0FBQ25CLGVBQWEsWUFBWSxDQUFDLFFBQVEsU0FBUyxRQUFRLE9BQU8sS0FBSztBQUMvRCxNQUFJLHNCQUFzQixjQUFjLE1BQU07QUFBQSxJQUM1QyxZQUFZLGNBQWMsUUFBUTtBQUNoQyxZQUFNLDBCQUEwQixZQUFZLE1BQU0sTUFBTSxFQUFFO0FBQUEsSUFDNUQ7QUFBQSxFQUNGO0FBQ0EsV0FBUyxpQkFBaUIsY0FBYyxVQUFVO0FBQ2hELFFBQUksQ0FBQyxhQUFhLFVBQVUsU0FBUyxRQUFRLEtBQUssYUFBYTtBQUM3RCxZQUFNLElBQUk7QUFBQSxRQUNSO0FBQUEsUUFDQSxHQUFHLFFBQVEsMEJBQTBCLGFBQWEsVUFBVSxLQUFLLElBQUksQ0FBQztBQUFBLE1BQzVFO0FBQUEsRUFDQTtBQUNBLFdBQVMsaUJBQWlCLGNBQWMsVUFBVTtBQUNoRCxRQUFJLFNBQVMsU0FBUyxHQUFHO0FBQ3ZCLFlBQU0sSUFBSSxvQkFBb0IsY0FBYyxnQ0FBZ0M7QUFDOUUsUUFBSSxTQUFTLFNBQVMsR0FBRyxLQUFLLFNBQVMsU0FBUyxLQUFLLENBQUMsU0FBUyxXQUFXLElBQUk7QUFDNUUsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNOO0FBQUEsRUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDIsMyw0XX0=
