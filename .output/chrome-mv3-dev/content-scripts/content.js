var content = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const definition = defineContentScript({
    matches: ["<all_urls>"],
    runAt: "document_start",
    main: async () => {
      try {
        const host = location.hostname;
        const url = location.href;
        console.debug("[env-marker][content] Initializing content script for:", url);
        const allSettings = ["setting1", "setting2", "setting3", "setting4", "setting5"];
        let matchedSetting = null;
        for (const settingKey of allSettings) {
          const data = await chrome.storage.sync.get({
            [`${settingKey}_patterns`]: [],
            [`${settingKey}_color`]: "#ff6666",
            [`${settingKey}_bannerPosition`]: "top",
            [`${settingKey}_bannerSize`]: 40,
            [`${settingKey}_enabled`]: true
          });
          const enabled = data[`${settingKey}_enabled`];
          if (!enabled) {
            console.debug(`[env-marker][content] ${settingKey} is disabled, skipping`);
            continue;
          }
          const patterns = data[`${settingKey}_patterns`] || [];
          const color = data[`${settingKey}_color`] || "#ff6666";
          const bannerPosition = data[`${settingKey}_bannerPosition`] || "top";
          const bannerSize = data[`${settingKey}_bannerSize`] || 40;
          const matchedPattern = patterns.find((pattern) => {
            if (pattern.trim() === "") return false;
            try {
              const regexPattern = pattern.replace(/[.+?^${}()|[\\]/g, "\\$&").replace(/\*/g, ".*");
              const regex = new RegExp(regexPattern);
              return regex.test(url);
            } catch (e) {
              console.error(`[env-marker] Invalid regex pattern from user input: "${pattern}"`, e);
              return false;
            }
          });
          if (matchedPattern) {
            console.info(`[env-marker][content] Matched with ${settingKey}:`, matchedPattern);
            matchedSetting = {
              pattern: matchedPattern,
              color,
              position: bannerPosition,
              size: bannerSize
            };
            break;
          }
        }
        if (!matchedSetting) {
          console.debug("[env-marker][content] No pattern matched.");
          return;
        }
        console.info("[env-marker][content] Pattern matched. Showing banner.", matchedSetting);
        showBanner(matchedSetting.pattern, matchedSetting.color, matchedSetting.position, matchedSetting.size);
      } catch (e) {
        console.error(e);
      }
      chrome.runtime.onMessage.addListener(async (msg) => {
        console.debug("[env-marker][content] Received message:", msg);
        if (msg && msg.type === "show-env-marker-banner" && msg.text) {
          const { currentSetting } = await chrome.storage.sync.get({ currentSetting: "setting1" });
          const settingKey = currentSetting;
          const data = await chrome.storage.sync.get({
            [`${settingKey}_bannerPosition`]: "top",
            [`${settingKey}_bannerSize`]: 4
          });
          const bannerPosition = data[`${settingKey}_bannerPosition`] || "top";
          const bannerSize = data[`${settingKey}_bannerSize`] || 4;
          console.info("[env-marker][content] Message requests banner. Loaded data:", { bannerPosition, bannerSize });
          showBanner(msg.text, msg.color, bannerPosition, bannerSize);
        }
      });
    }
  });
  function showBanner(text, color, position, size) {
    try {
      console.debug("[env-marker][content] showBanner called with:", { text, color, position, size });
      let banner = document.getElementById("env-marker-banner");
      if (!banner) {
        banner = document.createElement("div");
        banner.id = "env-marker-banner";
        document.documentElement.appendChild(banner);
        banner.addEventListener("click", () => {
          const b = document.getElementById("env-marker-banner");
          if (b) b.remove();
        });
      }
      if (!banner) return;
      banner.style.cssText = "position: fixed; z-index: 2147483647; cursor: pointer; pointer-events: auto;";
      banner.textContent = "";
      const bannerColor = color || "#ff6666";
      const bannerSize = `${size || 4}px`;
      const isRibbon = position.includes("-left") || position.includes("-right");
      if (isRibbon) {
        banner.style.width = "200px";
        banner.style.padding = "4px 0";
        banner.style.textAlign = "center";
        banner.style.background = bannerColor;
        banner.style.color = "white";
        banner.style.fontSize = "14px";
        banner.style.fontWeight = "bold";
        banner.style.boxShadow = "0 2px 5px rgba(0,0,0,0.3)";
        banner.textContent = text;
        switch (position) {
          case "top-right":
            banner.style.top = "25px";
            banner.style.right = "-50px";
            banner.style.transform = "rotate(45deg)";
            break;
          case "top-left":
            banner.style.top = "25px";
            banner.style.left = "-50px";
            banner.style.transform = "rotate(-45deg)";
            break;
          case "bottom-right":
            banner.style.bottom = "25px";
            banner.style.right = "-50px";
            banner.style.transform = "rotate(-45deg)";
            break;
          case "bottom-left":
            banner.style.bottom = "25px";
            banner.style.left = "-50px";
            banner.style.transform = "rotate(45deg)";
            break;
        }
      } else {
        switch (position) {
          case "bottom":
            banner.style.bottom = "0";
            banner.style.left = "0";
            banner.style.width = "100%";
            banner.style.height = bannerSize;
            banner.style.background = bannerColor;
            break;
          case "left":
            banner.style.top = "0";
            banner.style.left = "0";
            banner.style.width = bannerSize;
            banner.style.height = "100vh";
            banner.style.background = bannerColor;
            break;
          case "right":
            banner.style.top = "0";
            banner.style.right = "0";
            banner.style.width = bannerSize;
            banner.style.height = "100vh";
            banner.style.background = bannerColor;
            break;
          case "frame":
            banner.style.top = "0";
            banner.style.left = "0";
            banner.style.width = "100vw";
            banner.style.height = "100vh";
            banner.style.border = `${bannerSize} solid ${bannerColor}`;
            banner.style.boxSizing = "border-box";
            break;
          case "top":
          default:
            banner.style.top = "0";
            banner.style.left = "0";
            banner.style.width = "100%";
            banner.style.height = bannerSize;
            banner.style.background = bannerColor;
            break;
        }
      }
      const prefix = `[${text}]`;
      if (!document.title.startsWith(prefix)) {
        document.title = `${prefix} ${document.title}`;
      }
      setFavicon(color);
    } catch (e) {
      console.error(e);
    }
  }
  function setFavicon(color) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.fillStyle = color || "#ff6666";
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.fill();
      const url = canvas.toDataURL("image/png");
      const links = document.querySelectorAll('link[rel~="icon"]');
      links.forEach((l) => l.remove());
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = url;
      document.head.appendChild(link);
    } catch (e) {
      console.error("[env-marker][content] setFavicon error", e);
    }
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  function print$1(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger$1 = {
    debug: (...args) => print$1(console.debug, ...args),
    log: (...args) => print$1(console.log, ...args),
    warn: (...args) => print$1(console.warn, ...args),
    error: (...args) => print$1(console.error, ...args)
  };
  class WxtLocationChangeEvent extends Event {
    constructor(newUrl, oldUrl) {
      super(WxtLocationChangeEvent.EVENT_NAME, {});
      this.newUrl = newUrl;
      this.oldUrl = oldUrl;
    }
    static EVENT_NAME = getUniqueEventName("wxt:locationchange");
  }
  function getUniqueEventName(eventName) {
    return `${browser?.runtime?.id}:${"content"}:${eventName}`;
  }
  function createLocationWatcher(ctx) {
    let interval;
    let oldUrl;
    return {
      /**
       * Ensure the location watcher is actively looking for URL changes. If it's already watching,
       * this is a noop.
       */
      run() {
        if (interval != null) return;
        oldUrl = new URL(location.href);
        interval = ctx.setInterval(() => {
          let newUrl = new URL(location.href);
          if (newUrl.href !== oldUrl.href) {
            window.dispatchEvent(new WxtLocationChangeEvent(newUrl, oldUrl));
            oldUrl = newUrl;
          }
        }, 1e3);
      }
    };
  }
  class ContentScriptContext {
    constructor(contentScriptName, options) {
      this.contentScriptName = contentScriptName;
      this.options = options;
      this.abortController = new AbortController();
      if (this.isTopFrame) {
        this.listenForNewerScripts({ ignoreFirstEvent: true });
        this.stopOldScripts();
      } else {
        this.listenForNewerScripts();
      }
    }
    static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName(
      "wxt:content-script-started"
    );
    isTopFrame = window.self === window.top;
    abortController;
    locationWatcher = createLocationWatcher(this);
    receivedMessageIds = /* @__PURE__ */ new Set();
    get signal() {
      return this.abortController.signal;
    }
    abort(reason) {
      return this.abortController.abort(reason);
    }
    get isInvalid() {
      if (browser.runtime.id == null) {
        this.notifyInvalidated();
      }
      return this.signal.aborted;
    }
    get isValid() {
      return !this.isInvalid;
    }
    /**
     * Add a listener that is called when the content script's context is invalidated.
     *
     * @returns A function to remove the listener.
     *
     * @example
     * browser.runtime.onMessage.addListener(cb);
     * const removeInvalidatedListener = ctx.onInvalidated(() => {
     *   browser.runtime.onMessage.removeListener(cb);
     * })
     * // ...
     * removeInvalidatedListener();
     */
    onInvalidated(cb) {
      this.signal.addEventListener("abort", cb);
      return () => this.signal.removeEventListener("abort", cb);
    }
    /**
     * Return a promise that never resolves. Useful if you have an async function that shouldn't run
     * after the context is expired.
     *
     * @example
     * const getValueFromStorage = async () => {
     *   if (ctx.isInvalid) return ctx.block();
     *
     *   // ...
     * }
     */
    block() {
      return new Promise(() => {
      });
    }
    /**
     * Wrapper around `window.setInterval` that automatically clears the interval when invalidated.
     *
     * Intervals can be cleared by calling the normal `clearInterval` function.
     */
    setInterval(handler, timeout) {
      const id = setInterval(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearInterval(id));
      return id;
    }
    /**
     * Wrapper around `window.setTimeout` that automatically clears the interval when invalidated.
     *
     * Timeouts can be cleared by calling the normal `setTimeout` function.
     */
    setTimeout(handler, timeout) {
      const id = setTimeout(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearTimeout(id));
      return id;
    }
    /**
     * Wrapper around `window.requestAnimationFrame` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelAnimationFrame` function.
     */
    requestAnimationFrame(callback) {
      const id = requestAnimationFrame((...args) => {
        if (this.isValid) callback(...args);
      });
      this.onInvalidated(() => cancelAnimationFrame(id));
      return id;
    }
    /**
     * Wrapper around `window.requestIdleCallback` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelIdleCallback` function.
     */
    requestIdleCallback(callback, options) {
      const id = requestIdleCallback((...args) => {
        if (!this.signal.aborted) callback(...args);
      }, options);
      this.onInvalidated(() => cancelIdleCallback(id));
      return id;
    }
    addEventListener(target, type, handler, options) {
      if (type === "wxt:locationchange") {
        if (this.isValid) this.locationWatcher.run();
      }
      target.addEventListener?.(
        type.startsWith("wxt:") ? getUniqueEventName(type) : type,
        handler,
        {
          ...options,
          signal: this.signal
        }
      );
    }
    /**
     * @internal
     * Abort the abort controller and execute all `onInvalidated` listeners.
     */
    notifyInvalidated() {
      this.abort("Content script context invalidated");
      logger$1.debug(
        `Content script "${this.contentScriptName}" context invalidated`
      );
    }
    stopOldScripts() {
      window.postMessage(
        {
          type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
          contentScriptName: this.contentScriptName,
          messageId: Math.random().toString(36).slice(2)
        },
        "*"
      );
    }
    verifyScriptStartedEvent(event) {
      const isScriptStartedEvent = event.data?.type === ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE;
      const isSameContentScript = event.data?.contentScriptName === this.contentScriptName;
      const isNotDuplicate = !this.receivedMessageIds.has(event.data?.messageId);
      return isScriptStartedEvent && isSameContentScript && isNotDuplicate;
    }
    listenForNewerScripts(options) {
      let isFirst = true;
      const cb = (event) => {
        if (this.verifyScriptStartedEvent(event)) {
          this.receivedMessageIds.add(event.data.messageId);
          const wasFirst = isFirst;
          isFirst = false;
          if (wasFirst && options?.ignoreFirstEvent) return;
          this.notifyInvalidated();
        }
      };
      addEventListener("message", cb);
      this.onInvalidated(() => removeEventListener("message", cb));
    }
  }
  function initPlugins() {
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
  const result = (async () => {
    try {
      initPlugins();
      const { main, ...options } = definition;
      const ctx = new ContentScriptContext("content", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"content"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtY29udGVudC1zY3JpcHQubWpzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC50cyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad3h0LWRlditicm93c2VyQDAuMS40L25vZGVfbW9kdWxlcy9Ad3h0LWRldi9icm93c2VyL3NyYy9pbmRleC5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qcyIsIi4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCJleHBvcnQgZGVmYXVsdCBkZWZpbmVDb250ZW50U2NyaXB0KHtcbiAgbWF0Y2hlczogWyc8YWxsX3VybHM+J10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfc3RhcnQnLFxuXG4gIG1haW46IGFzeW5jICgpID0+IHtcbiAgICAvLyDjg5rjg7zjgrjjga7jg63jg7zjg4nmmYLjgavjgZnjgbnjgabjga7mnInlirnjgaroqK3lrprjgpLjg4Hjgqfjg4Pjgq/jgZfjgIHjg57jg4Pjg4HjgZnjgovjgoLjga7jgYzjgYLjgozjgbDjg57jg7zjgqvjg7zjgpLooajnpLrjgZnjgotcbiAgICB0cnkge1xuICAgICAgY29uc3QgaG9zdCA9IGxvY2F0aW9uLmhvc3RuYW1lO1xuICAgICAgY29uc3QgdXJsID0gbG9jYXRpb24uaHJlZjtcbiAgICAgIGNvbnNvbGUuZGVidWcoJ1tlbnYtbWFya2VyXVtjb250ZW50XSBJbml0aWFsaXppbmcgY29udGVudCBzY3JpcHQgZm9yOicsIHVybCk7XG5cbiAgICAgIC8vIOOBmeOBueOBpuOBruioreWumuODl+ODreODleOCoeOCpOODq+OCkuODgeOCp+ODg+OCr1xuICAgICAgY29uc3QgYWxsU2V0dGluZ3MgPSBbJ3NldHRpbmcxJywgJ3NldHRpbmcyJywgJ3NldHRpbmczJywgJ3NldHRpbmc0JywgJ3NldHRpbmc1J107XG4gICAgICBsZXQgbWF0Y2hlZFNldHRpbmc6IHsgcGF0dGVybjogc3RyaW5nOyBjb2xvcjogc3RyaW5nOyBwb3NpdGlvbjogc3RyaW5nOyBzaXplOiBudW1iZXIgfSB8IG51bGwgPSBudWxsO1xuXG4gICAgICBmb3IgKGNvbnN0IHNldHRpbmdLZXkgb2YgYWxsU2V0dGluZ3MpIHtcbiAgICAgICAgLy8g44K544OI44Os44O844K444GL44KJ6Kit5a6a44KS5Y+W5b6XXG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zeW5jLmdldCh7XG4gICAgICAgICAgW2Ake3NldHRpbmdLZXl9X3BhdHRlcm5zYF06IFtdLFxuICAgICAgICAgIFtgJHtzZXR0aW5nS2V5fV9jb2xvcmBdOiAnI2ZmNjY2NicsXG4gICAgICAgICAgW2Ake3NldHRpbmdLZXl9X2Jhbm5lclBvc2l0aW9uYF06ICd0b3AnLFxuICAgICAgICAgIFtgJHtzZXR0aW5nS2V5fV9iYW5uZXJTaXplYF06IDQwLFxuICAgICAgICAgIFtgJHtzZXR0aW5nS2V5fV9lbmFibGVkYF06IHRydWVcbiAgICAgICAgfSk7XG4gICAgICAgIFxuICAgICAgICBjb25zdCBlbmFibGVkID0gZGF0YVtgJHtzZXR0aW5nS2V5fV9lbmFibGVkYF07XG4gICAgICAgIGlmICghZW5hYmxlZCkge1xuICAgICAgICAgIGNvbnNvbGUuZGVidWcoYFtlbnYtbWFya2VyXVtjb250ZW50XSAke3NldHRpbmdLZXl9IGlzIGRpc2FibGVkLCBza2lwcGluZ2ApO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcGF0dGVybnMgPSBkYXRhW2Ake3NldHRpbmdLZXl9X3BhdHRlcm5zYF0gfHwgW107XG4gICAgICAgIGNvbnN0IGNvbG9yID0gZGF0YVtgJHtzZXR0aW5nS2V5fV9jb2xvcmBdIHx8ICcjZmY2NjY2JztcbiAgICAgICAgY29uc3QgYmFubmVyUG9zaXRpb24gPSBkYXRhW2Ake3NldHRpbmdLZXl9X2Jhbm5lclBvc2l0aW9uYF0gfHwgJ3RvcCc7XG4gICAgICAgIGNvbnN0IGJhbm5lclNpemUgPSBkYXRhW2Ake3NldHRpbmdLZXl9X2Jhbm5lclNpemVgXSB8fCA0MDtcblxuICAgICAgICAvLyDjg5Hjgr/jg7zjg7Pjgavjg57jg4Pjg4HjgZnjgovjgYvjg4Hjgqfjg4Pjgq9cbiAgICAgICAgY29uc3QgbWF0Y2hlZFBhdHRlcm4gPSBwYXR0ZXJucy5maW5kKChwYXR0ZXJuOiBzdHJpbmcpID0+IHtcbiAgICAgICAgICBpZiAocGF0dGVybi50cmltKCkgPT09ICcnKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIOOCouOCueOCv+ODquOCueOCrygqKeOCkuato+imj+ihqOePvuOBriguKinjgavlpInmj5vjgZfjgIHku5bjga7mraPopo/ooajnj77nibnmrormloflrZfjgpLjgqjjgrnjgrHjg7zjg5dcbiAgICAgICAgICAgIGNvbnN0IHJlZ2V4UGF0dGVybiA9IHBhdHRlcm5cbiAgICAgICAgICAgICAgLnJlcGxhY2UoL1suKz9eJHt9KCl8W1xcXFxdL2csICdcXFxcJCYnKSAvLyAuIOOChCArIOOBquOBqeOBruaWh+Wtl+OCkuOCqOOCueOCseODvOODl1xuICAgICAgICAgICAgICAucmVwbGFjZSgvXFwqL2csICcuKicpOyAvLyDjgqLjgrnjgr/jg6rjgrnjgq/jgpLjg6/jgqTjg6vjg4njgqvjg7zjg4njgavlpInmj5tcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKHJlZ2V4UGF0dGVybik7XG4gICAgICAgICAgICByZXR1cm4gcmVnZXgudGVzdCh1cmwpO1xuICAgICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtlbnYtbWFya2VyXSBJbnZhbGlkIHJlZ2V4IHBhdHRlcm4gZnJvbSB1c2VyIGlucHV0OiBcIiR7cGF0dGVybn1cImAsIGUpO1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKG1hdGNoZWRQYXR0ZXJuKSB7XG4gICAgICAgICAgY29uc29sZS5pbmZvKGBbZW52LW1hcmtlcl1bY29udGVudF0gTWF0Y2hlZCB3aXRoICR7c2V0dGluZ0tleX06YCwgbWF0Y2hlZFBhdHRlcm4pO1xuICAgICAgICAgIG1hdGNoZWRTZXR0aW5nID0ge1xuICAgICAgICAgICAgcGF0dGVybjogbWF0Y2hlZFBhdHRlcm4sXG4gICAgICAgICAgICBjb2xvcjogY29sb3IsXG4gICAgICAgICAgICBwb3NpdGlvbjogYmFubmVyUG9zaXRpb24sXG4gICAgICAgICAgICBzaXplOiBiYW5uZXJTaXplXG4gICAgICAgICAgfTtcbiAgICAgICAgICBicmVhazsgLy8g5pyA5Yid44Gr44Oe44OD44OB44GX44Gf6Kit5a6a44KS5L2/55SoXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKCFtYXRjaGVkU2V0dGluZykge1xuICAgICAgICBjb25zb2xlLmRlYnVnKCdbZW52LW1hcmtlcl1bY29udGVudF0gTm8gcGF0dGVybiBtYXRjaGVkLicpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIOODnuODg+ODgeOBl+OBn+WgtOWQiOOBr+ODkOODiuODvOihqOekulxuICAgICAgY29uc29sZS5pbmZvKCdbZW52LW1hcmtlcl1bY29udGVudF0gUGF0dGVybiBtYXRjaGVkLiBTaG93aW5nIGJhbm5lci4nLCBtYXRjaGVkU2V0dGluZyk7XG4gICAgICBzaG93QmFubmVyKG1hdGNoZWRTZXR0aW5nLnBhdHRlcm4sIG1hdGNoZWRTZXR0aW5nLmNvbG9yLCBtYXRjaGVkU2V0dGluZy5wb3NpdGlvbiwgbWF0Y2hlZFNldHRpbmcuc2l6ZSk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICB9XG5cbiAgICAvLyDjg5Djg4Pjgq/jgrDjg6njgqbjg7Pjg4njgYvjgonjga7jg6Hjg4Pjgrvjg7zjgrjlj5fkv6FcbiAgICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoYXN5bmMgKG1zZzogYW55KSA9PiB7XG4gICAgICBjb25zb2xlLmRlYnVnKCdbZW52LW1hcmtlcl1bY29udGVudF0gUmVjZWl2ZWQgbWVzc2FnZTonLCBtc2cpO1xuICAgICAgaWYgKG1zZyAmJiBtc2cudHlwZSA9PT0gJ3Nob3ctZW52LW1hcmtlci1iYW5uZXInICYmIG1zZy50ZXh0KSB7XG4gICAgICAgIC8vIEdldCBjdXJyZW50IHNldHRpbmcgcHJvZmlsZVxuICAgICAgICBjb25zdCB7IGN1cnJlbnRTZXR0aW5nIH0gPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5zeW5jLmdldCh7Y3VycmVudFNldHRpbmc6ICdzZXR0aW5nMSd9KTtcbiAgICAgICAgY29uc3Qgc2V0dGluZ0tleSA9IGN1cnJlbnRTZXR0aW5nO1xuICAgICAgICBcbiAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IGNocm9tZS5zdG9yYWdlLnN5bmMuZ2V0KHsgXG4gICAgICAgICAgW2Ake3NldHRpbmdLZXl9X2Jhbm5lclBvc2l0aW9uYF06ICd0b3AnLFxuICAgICAgICAgIFtgJHtzZXR0aW5nS2V5fV9iYW5uZXJTaXplYF06IDRcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGJhbm5lclBvc2l0aW9uID0gZGF0YVtgJHtzZXR0aW5nS2V5fV9iYW5uZXJQb3NpdGlvbmBdIHx8ICd0b3AnO1xuICAgICAgICBjb25zdCBiYW5uZXJTaXplID0gZGF0YVtgJHtzZXR0aW5nS2V5fV9iYW5uZXJTaXplYF0gfHwgNDtcbiAgICAgICAgXG4gICAgICAgIGNvbnNvbGUuaW5mbygnW2Vudi1tYXJrZXJdW2NvbnRlbnRdIE1lc3NhZ2UgcmVxdWVzdHMgYmFubmVyLiBMb2FkZWQgZGF0YTonLCB7IGJhbm5lclBvc2l0aW9uLCBiYW5uZXJTaXplIH0pO1xuICAgICAgICBzaG93QmFubmVyKG1zZy50ZXh0LCBtc2cuY29sb3IsIGJhbm5lclBvc2l0aW9uLCBiYW5uZXJTaXplKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbn0pO1xuXG4vLyDjg5Djg4rjg7zooajnpLrjga7lhbHpgJrplqLmlbBcbmZ1bmN0aW9uIHNob3dCYW5uZXIodGV4dDogc3RyaW5nLCBjb2xvcjogc3RyaW5nLCBwb3NpdGlvbjogc3RyaW5nLCBzaXplOiBudW1iZXIpIHtcbiAgdHJ5IHtcbiAgICBjb25zb2xlLmRlYnVnKCdbZW52LW1hcmtlcl1bY29udGVudF0gc2hvd0Jhbm5lciBjYWxsZWQgd2l0aDonLCB7IHRleHQsIGNvbG9yLCBwb3NpdGlvbiwgc2l6ZSB9KTtcbiAgICBsZXQgYmFubmVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2Vudi1tYXJrZXItYmFubmVyJyk7XG4gICAgaWYgKCFiYW5uZXIpIHtcbiAgICAgIGJhbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgYmFubmVyLmlkID0gJ2Vudi1tYXJrZXItYmFubmVyJztcbiAgICAgIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hcHBlbmRDaGlsZChiYW5uZXIpO1xuICAgICAgLy8g44OQ44OK44O844GM5paw44GX44GP5L2c5oiQ44GV44KM44Gf44Go44GN44Gr5LiA5bqm44Gg44GR44Kk44OZ44Oz44OI44Oq44K544OK44O844KS6L+95YqgXG4gICAgICBiYW5uZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZW52LW1hcmtlci1iYW5uZXInKTtcbiAgICAgICAgaWYgKGIpIGIucmVtb3ZlKCk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoIWJhbm5lcikgcmV0dXJuO1xuXG4gICAgLy8g44K544K/44Kk44Or44KS44Oq44K744OD44OI44GX44CB44Kv44Oq44OD44Kv5Y+v6IO944Gr44GZ44KLXG4gICAgYmFubmVyLnN0eWxlLmNzc1RleHQgPSAncG9zaXRpb246IGZpeGVkOyB6LWluZGV4OiAyMTQ3NDgzNjQ3OyBjdXJzb3I6IHBvaW50ZXI7IHBvaW50ZXItZXZlbnRzOiBhdXRvOyc7XG4gICAgYmFubmVyLnRleHRDb250ZW50ID0gJyc7IC8vIOODhuOCreOCueODiOOCkuODquOCu+ODg+ODiFxuXG4gICAgY29uc3QgYmFubmVyQ29sb3IgPSBjb2xvciB8fCAnI2ZmNjY2Nic7XG4gICAgY29uc3QgYmFubmVyU2l6ZSA9IGAke3NpemUgfHwgNH1weGA7XG4gICAgY29uc3QgaXNSaWJib24gPSBwb3NpdGlvbi5pbmNsdWRlcygnLWxlZnQnKSB8fCBwb3NpdGlvbi5pbmNsdWRlcygnLXJpZ2h0Jyk7XG5cbiAgICBpZiAoaXNSaWJib24pIHtcbiAgICAgIC8vIC0tLSDjg6rjg5zjg7PnlKjjga7jgrnjgr/jgqTjg6sgLS0tXG4gICAgICBiYW5uZXIuc3R5bGUud2lkdGggPSAnMjAwcHgnO1xuICAgICAgYmFubmVyLnN0eWxlLnBhZGRpbmcgPSAnNHB4IDAnO1xuICAgICAgYmFubmVyLnN0eWxlLnRleHRBbGlnbiA9ICdjZW50ZXInO1xuICAgICAgYmFubmVyLnN0eWxlLmJhY2tncm91bmQgPSBiYW5uZXJDb2xvcjtcbiAgICAgIGJhbm5lci5zdHlsZS5jb2xvciA9ICd3aGl0ZSc7XG4gICAgICBiYW5uZXIuc3R5bGUuZm9udFNpemUgPSAnMTRweCc7XG4gICAgICBiYW5uZXIuc3R5bGUuZm9udFdlaWdodCA9ICdib2xkJztcbiAgICAgIGJhbm5lci5zdHlsZS5ib3hTaGFkb3cgPSAnMCAycHggNXB4IHJnYmEoMCwwLDAsMC4zKSc7XG4gICAgICBiYW5uZXIudGV4dENvbnRlbnQgPSB0ZXh0O1xuXG4gICAgICBzd2l0Y2ggKHBvc2l0aW9uKSB7XG4gICAgICAgIGNhc2UgJ3RvcC1yaWdodCc6XG4gICAgICAgICAgYmFubmVyLnN0eWxlLnRvcCA9ICcyNXB4JztcbiAgICAgICAgICBiYW5uZXIuc3R5bGUucmlnaHQgPSAnLTUwcHgnO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS50cmFuc2Zvcm0gPSAncm90YXRlKDQ1ZGVnKSc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ3RvcC1sZWZ0JzpcbiAgICAgICAgICBiYW5uZXIuc3R5bGUudG9wID0gJzI1cHgnO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS5sZWZ0ID0gJy01MHB4JztcbiAgICAgICAgICBiYW5uZXIuc3R5bGUudHJhbnNmb3JtID0gJ3JvdGF0ZSgtNDVkZWcpJztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnYm90dG9tLXJpZ2h0JzpcbiAgICAgICAgICBiYW5uZXIuc3R5bGUuYm90dG9tID0gJzI1cHgnO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS5yaWdodCA9ICctNTBweCc7XG4gICAgICAgICAgYmFubmVyLnN0eWxlLnRyYW5zZm9ybSA9ICdyb3RhdGUoLTQ1ZGVnKSc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2JvdHRvbS1sZWZ0JzpcbiAgICAgICAgICBiYW5uZXIuc3R5bGUuYm90dG9tID0gJzI1cHgnO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS5sZWZ0ID0gJy01MHB4JztcbiAgICAgICAgICBiYW5uZXIuc3R5bGUudHJhbnNmb3JtID0gJ3JvdGF0ZSg0NWRlZyknO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyAtLS0g5b6T5p2l44Gu5biv44O75p6g55So44Gu44K544K/44Kk44OrIC0tLVxuICAgICAgc3dpdGNoIChwb3NpdGlvbikge1xuICAgICAgICBjYXNlICdib3R0b20nOlxuICAgICAgICAgIGJhbm5lci5zdHlsZS5ib3R0b20gPSAnMCc7XG4gICAgICAgICAgYmFubmVyLnN0eWxlLmxlZnQgPSAnMCc7XG4gICAgICAgICAgYmFubmVyLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS5oZWlnaHQgPSBiYW5uZXJTaXplO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS5iYWNrZ3JvdW5kID0gYmFubmVyQ29sb3I7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ2xlZnQnOlxuICAgICAgICAgIGJhbm5lci5zdHlsZS50b3AgPSAnMCc7XG4gICAgICAgICAgYmFubmVyLnN0eWxlLmxlZnQgPSAnMCc7XG4gICAgICAgICAgYmFubmVyLnN0eWxlLndpZHRoID0gYmFubmVyU2l6ZTtcbiAgICAgICAgICBiYW5uZXIuc3R5bGUuaGVpZ2h0ID0gJzEwMHZoJztcbiAgICAgICAgICBiYW5uZXIuc3R5bGUuYmFja2dyb3VuZCA9IGJhbm5lckNvbG9yO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdyaWdodCc6XG4gICAgICAgICAgYmFubmVyLnN0eWxlLnRvcCA9ICcwJztcbiAgICAgICAgICBiYW5uZXIuc3R5bGUucmlnaHQgPSAnMCc7XG4gICAgICAgICAgYmFubmVyLnN0eWxlLndpZHRoID0gYmFubmVyU2l6ZTtcbiAgICAgICAgICBiYW5uZXIuc3R5bGUuaGVpZ2h0ID0gJzEwMHZoJztcbiAgICAgICAgICBiYW5uZXIuc3R5bGUuYmFja2dyb3VuZCA9IGJhbm5lckNvbG9yO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdmcmFtZSc6XG4gICAgICAgICAgYmFubmVyLnN0eWxlLnRvcCA9ICcwJztcbiAgICAgICAgICBiYW5uZXIuc3R5bGUubGVmdCA9ICcwJztcbiAgICAgICAgICBiYW5uZXIuc3R5bGUud2lkdGggPSAnMTAwdncnO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS5oZWlnaHQgPSAnMTAwdmgnO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS5ib3JkZXIgPSBgJHtiYW5uZXJTaXplfSBzb2xpZCAke2Jhbm5lckNvbG9yfWA7XG4gICAgICAgICAgYmFubmVyLnN0eWxlLmJveFNpemluZyA9ICdib3JkZXItYm94JztcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAndG9wJzpcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICBiYW5uZXIuc3R5bGUudG9wID0gJzAnO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS5sZWZ0ID0gJzAnO1xuICAgICAgICAgIGJhbm5lci5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgICAgICAgICBiYW5uZXIuc3R5bGUuaGVpZ2h0ID0gYmFubmVyU2l6ZTtcbiAgICAgICAgICBiYW5uZXIuc3R5bGUuYmFja2dyb3VuZCA9IGJhbm5lckNvbG9yO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIOOCv+OCpOODiOODq+ODl+ODrOODleOCo+ODg+OCr+OCuVxuICAgIGNvbnN0IHByZWZpeCA9IGBbJHt0ZXh0fV1gO1xuICAgIGlmICghZG9jdW1lbnQudGl0bGUuc3RhcnRzV2l0aChwcmVmaXgpKSB7XG4gICAgICBkb2N1bWVudC50aXRsZSA9IGAke3ByZWZpeH0gJHtkb2N1bWVudC50aXRsZX1gO1xuICAgIH1cbiAgICBcbiAgICAvLyDjg5XjgqHjg5PjgrPjg7NcbiAgICBzZXRGYXZpY29uKGNvbG9yKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gIH1cbn1cblxuLy8g44OV44Kh44OT44Kz44Oz55Sf5oiQXG5mdW5jdGlvbiBzZXRGYXZpY29uKGNvbG9yOiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcbiAgICBjYW52YXMud2lkdGggPSA2NDtcbiAgICBjYW52YXMuaGVpZ2h0ID0gNjQ7XG4gICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gICAgaWYgKCFjdHgpIHJldHVybjtcblxuICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvciB8fCAnI2ZmNjY2Nic7XG4gICAgY3R4LmJlZ2luUGF0aCgpO1xuICAgIGN0eC5hcmMoMzIsIDMyLCAyOCwgMCwgTWF0aC5QSSAqIDIpO1xuICAgIGN0eC5maWxsKCk7XG4gICAgY29uc3QgdXJsID0gY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvcG5nJyk7XG5cbiAgICBjb25zdCBsaW5rcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2xpbmtbcmVsfj1cImljb25cIl0nKTtcbiAgICBsaW5rcy5mb3JFYWNoKGwgPT4gbC5yZW1vdmUoKSk7XG4gICAgXG4gICAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2xpbmsnKTtcbiAgICBsaW5rLnJlbCA9ICdpY29uJztcbiAgICBsaW5rLmhyZWYgPSB1cmw7XG4gICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChsaW5rKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUuZXJyb3IoJ1tlbnYtbWFya2VyXVtjb250ZW50XSBzZXRGYXZpY29uIGVycm9yJywgZSk7XG4gIH1cbn0iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWAgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbml0aW9uIiwiYnJvd3NlciIsIl9icm93c2VyIiwicHJpbnQiLCJsb2dnZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxvQkFBb0JBLGFBQVk7QUFDOUMsV0FBT0E7QUFBQSxFQUNUO0FDRkEsUUFBQSxhQUFBLG9CQUFBO0FBQUEsSUFBbUMsU0FBQSxDQUFBLFlBQUE7QUFBQSxJQUNYLE9BQUE7QUFBQSxJQUNmLE1BQUEsWUFBQTtBQUlMLFVBQUE7QUFDRSxjQUFBLE9BQUEsU0FBQTtBQUNBLGNBQUEsTUFBQSxTQUFBO0FBQ0EsZ0JBQUEsTUFBQSwwREFBQSxHQUFBO0FBR0EsY0FBQSxjQUFBLENBQUEsWUFBQSxZQUFBLFlBQUEsWUFBQSxVQUFBO0FBQ0EsWUFB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QUNBLFVBQUEsU0FBQSxTQUFBLGVBQUEsbUJBQUE7QUFDQSxVQUFBLENBQUEsUUFBQTtBQUNFLGlCQUFBLFNBQUEsY0FBQSxLQUFBO0FBQ0EsZUFBQSxLQUFBO0FBQ0EsaUJBQUEsZ0JBQUEsWUFBQSxNQUFBO0FBRUEsZUFBQSxpQkFBQSxTQUFBLE1BQUE7QUFDRSxnQkFBQSxJQUFBLFNBQUEsZUFBQSxtQkFBQTtBQUNBLGNBQUEsRUFBQSxHQUFBLE9BQUE7QUFBQSxRQUFnQixDQUFBO0FBQUEsTUFDakI7QUFHSCxVQUFBLENBQUEsT0FBQTtBQUdBLGFBQUEsTUFBQSxVQUFBO0FBQ0EsYUFBQSxjQUFBO0FBRUEsWUFBQSxjQUFBLFNBQUE7QUFDQSxZQUFBLGFBQUEsR0FBQSxRQUFBLENBQUE7QUFDQSxZQUFBLFdBQUEsU0FBQSxTQUFBLE9BQUEsS0FBQSxTQUFBLFNBQUEsUUFBQTtBQUVBLFVBQUEsVUFBQTtBQUVFLGVBQUEsTUFBQSxRQUFBO0FBQ0EsZUFBQSxNQUFBLFVBQUE7QUFDQSxlQUFBLE1BQUEsWUFBQTtBQUNBLGVBQUEsTUFBQSxhQUFBO0FBQ0EsZUFBQSxNQUFBLFFBQUE7QUFDQSxlQUFBLE1BQUEsV0FBQTtBQUNBLGVBQUEsTUFBQSxhQUFBO0FBQ0EsZUFBQSxNQUFBLFlBQUE7QUFDQSxlQUFBLGNBQUE7QUFFQSxnQkFBQSxVQUFBO0FBQUEsVUFBa0IsS0FBQTtBQUVkLG1CQUFBLE1BQUEsTUFBQTtBQUNBLG1CQUFBLE1BQUEsUUFBQTtBQUNBLG1CQUFBLE1BQUEsWUFBQTtBQUNBO0FBQUEsVUFBQSxLQUFBO0FBRUEsbUJBQUEsTUFBQSxNQUFBO0FBQ0EsbUJBQUEsTUFBQSxPQUFBO0FBQ0EsbUJBQUEsTUFBQSxZQUFBO0FBQ0E7QUFBQSxVQUFBLEtBQUE7QUFFQSxtQkFBQSxNQUFBLFNBQUE7QUFDQSxtQkFBQSxNQUFBLFFBQUE7QUFDQSxtQkFBQSxNQUFBLFlBQUE7QUFDQTtBQUFBLFVBQUEsS0FBQTtBQUVBLG1CQUFBLE1BQUEsU0FBQTtBQUNBLG1CQUFBLE1BQUEsT0FBQTtBQUNBLG1CQUFBLE1BQUEsWUFBQTtBQUNBO0FBQUEsUUFBQTtBQUFBLE1BQ0osT0FBQTtBQUdBLGdCQUFBLFVBQUE7QUFBQSxVQUFrQixLQUFBO0FBRWQsbUJBQUEsTUFBQSxTQUFBO0FBQ0EsbUJBQUEsTUFBQSxPQUFBO0FBQ0EsbUJBQUEsTUFBQSxRQUFBO0FBQ0EsbUJBQUEsTUFBQSxTQUFBO0FBQ0EsbUJBQUEsTUFBQSxhQUFBO0FBQ0E7QUFBQSxVQUFBLEtBQUE7QUFFQSxtQkFBQSxNQUFBLE1BQUE7QUFDQSxtQkFBQSxNQUFBLE9BQUE7QUFDQSxtQkFBQSxNQUFBLFFBQUE7QUFDQSxtQkFBQSxNQUFBLFNBQUE7QUFDQSxtQkFBQSxNQUFBLGFBQUE7QUFDQTtBQUFBLFVBQUEsS0FBQTtBQUVBLG1CQUFBLE1BQUEsTUFBQTtBQUNBLG1CQUFBLE1BQUEsUUFBQTtBQUNBLG1CQUFBLE1BQUEsUUFBQTtBQUNBLG1CQUFBLE1BQUEsU0FBQTtBQUNBLG1CQUFBLE1BQUEsYUFBQTtBQUNBO0FBQUEsVUFBQSxLQUFBO0FBRUEsbUJBQUEsTUFBQSxNQUFBO0FBQ0EsbUJBQUEsTUFBQSxPQUFBO0FBQ0EsbUJBQUEsTUFBQSxRQUFBO0FBQ0EsbUJBQUEsTUFBQSxTQUFBO0FBQ0EsbUJBQUEsTUFBQSxTQUFBLEdBQUEsVUFBQSxVQUFBLFdBQUE7QUFDQSxtQkFBQSxNQUFBLFlBQUE7QUFDQTtBQUFBLFVBQUEsS0FBQTtBQUFBLFVBQ0c7QUFFSCxtQkFBQSxNQUFBLE1BQUE7QUFDQSxtQkFBQSxNQUFBLE9BQUE7QUFDQSxtQkFBQSxNQUFBLFFBQUE7QUFDQSxtQkFBQSxNQUFBLFNBQUE7QUFDQSxtQkFBQSxNQUFBLGFBQUE7QUFDQTtBQUFBLFFBQUE7QUFBQSxNQUNKO0FBSUYsWUFBQSxTQUFBLElBQUEsSUFBQTtBQUNBLFVBQUEsQ0FBQSxTQUFBLE1BQUEsV0FBQSxNQUFBLEdBQUE7QUFDRSxpQkFBQSxRQUFBLEdBQUEsTUFBQSxJQUFBLFNBQUEsS0FBQTtBQUFBLE1BQTRDO0FBSTlDLGlCQUFBLEtBQUE7QUFBQSxJ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
content;