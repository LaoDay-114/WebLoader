'use strict';

const path = require('node:path');
const { createRequire } = require('node:module');
const { contextBridge, ipcRenderer, webFrame } = require('electron');
const { matchesAny } = require('./matcher');
const { ModStorage } = require('./storage');

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

function createWebLoaderApi(bridge, info, loaderVersion) {
  'use strict';

  function stringify(value) {
    if (value === undefined) {
      return 'null';
    }
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }

  function formatArg(value) {
    if (typeof value === 'string') {
      return value;
    }
    if (value instanceof Error) {
      return value.stack || value.message || String(value);
    }
    if (typeof value === 'object' && value !== null) {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  function writeLog(level, args) {
    const values = Array.prototype.slice.call(args);
    try {
      const method = console[level] || console.log;
      method.apply(console, values);
    } catch {}
    try {
      bridge.log(info.id, level, values.map(formatArg).join(' '));
    } catch {}
  }

  function getStorageValue(key, fallback) {
    try {
      const fallbackJson = stringify(fallback);
      const raw = bridge.storageGet(info.id, String(key), fallbackJson);
      if (raw === null || raw === undefined) {
        return fallback;
      }
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function setStorageValue(key, value) {
    try {
      const valueJson = stringify(value);
      if (valueJson === null) {
        return false;
      }
      return bridge.storageSet(info.id, String(key), valueJson) === true;
    } catch {
      return false;
    }
  }

  function removeStorageValue(key) {
    try {
      return bridge.storageRemove(info.id, String(key)) === true;
    } catch {
      return false;
    }
  }

  function clearStorage() {
    try {
      return bridge.storageClear(info.id) === true;
    } catch {
      return false;
    }
  }

  function addStyle(cssText, key) {
    const style = document.createElement('style');
    style.setAttribute('data-webloader-mod', info.id);
    if (key !== undefined) {
      style.setAttribute('data-webloader-key', String(key));
    }
    style.textContent = String(cssText);

    let inserted = false;
    let removed = false;

    function append() {
      if (inserted || removed) {
        return;
      }
      const parent = document.head || document.documentElement;
      if (!parent) {
        return;
      }
      parent.appendChild(style);
      inserted = true;
    }

    if (document.head || document.documentElement) {
      append();
    } else {
      document.addEventListener('DOMContentLoaded', append, { once: true });
    }

    return function removeStyle() {
      removed = true;
      if (inserted) {
        style.remove();
      }
    };
  }

  function handleCallback(callback) {
    if (typeof callback !== 'function') {
      return;
    }
    try {
      const result = callback();
      if (result && typeof result.then === 'function') {
        result.catch((error) => writeLog('error', [error]));
      }
    } catch (error) {
      writeLog('error', [error]);
    }
  }

  function onReady(callback) {
    if (typeof callback !== 'function') {
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => handleCallback(callback), {
        once: true,
      });
    } else {
      setTimeout(() => handleCallback(callback), 0);
    }
  }

  function waitFor(selector, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const timeout = typeof options === 'number' ? options : (opts.timeout ?? 10000);
    const root = opts.root && typeof opts.root.querySelector === 'function' ? opts.root : document;

    return new Promise((resolve, reject) => {
      const find = () => {
        try {
          return root.querySelector(selector);
        } catch {
          return null;
        }
      };

      const current = find();
      if (current) {
        resolve(current);
        return;
      }

      let observer = null;
      let timer = null;

      const cleanup = () => {
        if (observer) {
          observer.disconnect();
        }
        if (timer) {
          clearTimeout(timer);
        }
      };

      observer = new MutationObserver(() => {
        const element = find();
        if (element) {
          cleanup();
          resolve(element);
        }
      });

      observer.observe(root === document ? (document.documentElement || document) : root, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      if (timeout > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error(`等待元素超时：${selector}`));
        }, timeout);
      }
    });
  }

  const api = {
    version: loaderVersion,
    mod: Object.freeze({ ...info }),
    log: (...args) => writeLog('log', args),
    info: (...args) => writeLog('info', args),
    warn: (...args) => writeLog('warn', args),
    error: (...args) => writeLog('error', args),
    debug: (...args) => writeLog('debug', args),
    addStyle,
    onReady,
    waitFor,
    reload: () => window.location.reload(),
    storage: {
      get: getStorageValue,
      set: setStorageValue,
      remove: removeStorageValue,
      clear: clearStorage,
    },
  };

  Object.defineProperty(api, 'url', {
    enumerable: true,
    get: () => window.location.href,
  });

  return api;
}

function runPreload() {
  const response = ipcRenderer.sendSync('webloader:get-session');

  if (!response || !response.ok) {
    console.error('[WebLoader] 无法获取加载器配置：', response && response.error);
    return;
  }

  const session = response.data;
  const knownModIds = new Set(session.mods.map((mod) => mod.id));
  const storages = new Map();

  function getStorage(modId) {
    if (!storages.has(modId)) {
      storages.set(modId, new ModStorage(session.storageDir, modId));
    }
    return storages.get(modId);
  }

  const rawBridge = {
    log(modId, level, message) {
      if (!knownModIds.has(modId)) {
        return;
      }
      try {
        ipcRenderer.send('webloader:log', modId, level, message);
      } catch {}
    },
    storageGet(modId, key, fallbackJson) {
      if (!knownModIds.has(modId)) {
        return fallbackJson ?? null;
      }
      try {
        return getStorage(modId).getRaw(String(key), fallbackJson);
      } catch (error) {
        console.error(`[WebLoader:${modId}] 读取存储失败：${error.message}`);
        return fallbackJson ?? null;
      }
    },
    storageSet(modId, key, valueJson) {
      if (!knownModIds.has(modId)) {
        return false;
      }
      try {
        return getStorage(modId).setRaw(String(key), valueJson);
      } catch (error) {
        console.error(`[WebLoader:${modId}] 写入存储失败：${error.message}`);
        return false;
      }
    },
    storageRemove(modId, key) {
      if (!knownModIds.has(modId)) {
        return false;
      }
      try {
        return getStorage(modId).removeRaw(String(key));
      } catch (error) {
        console.error(`[WebLoader:${modId}] 删除存储失败：${error.message}`);
        return false;
      }
    },
    storageClear(modId) {
      if (!knownModIds.has(modId)) {
        return false;
      }
      try {
        return getStorage(modId).clear();
      } catch (error) {
        console.error(`[WebLoader:${modId}] 清空存储失败：${error.message}`);
        return false;
      }
    },
  };

  try {
    contextBridge.exposeInMainWorld(session.bridgeName, rawBridge);
  } catch (error) {
    console.error('[WebLoader] 暴露页面桥接 API 失败：', error);
  }

  function shouldRun(mod, url) {
    if (!matchesAny(url, mod.matches)) {
      return false;
    }
    if (mod.excludeMatches.length > 0 && matchesAny(url, mod.excludeMatches)) {
      return false;
    }
    return true;
  }

  function buildPageScript(mod) {
    const info = JSON.stringify(mod.metadata);
    const bridgeName = JSON.stringify(session.bridgeName);
    const loaderVersion = JSON.stringify(session.loaderVersion);

    return `
;(function () {
  const bridge = window[${bridgeName}];
  if (!bridge) {
    console.error('[WebLoader] 页面桥接 API 不可用，Mod 未加载：${mod.id}');
    return;
  }
  const WebLoader = (${createWebLoaderApi.toString()})(bridge, ${info}, ${loaderVersion});
  (async function (WebLoader) {
${mod.source}
//# sourceURL=${mod.entryUrl}
  })(WebLoader).catch(function (error) {
    WebLoader.error(error);
  });
})();
//# sourceURL=${mod.entryUrl}
`;
  }

  function runPageMod(mod) {
    try {
      const result = webFrame.executeJavaScript(buildPageScript(mod), true);
      if (result && typeof result.catch === 'function') {
        result.catch((error) => {
          console.error(`[WebLoader:${mod.id}] 页面 Mod 执行失败：`, error);
        });
      }
    } catch (error) {
      console.error(`[WebLoader:${mod.id}] 页面 Mod 注入失败：`, error);
    }
  }

  function runIsolatedMod(mod) {
    const api = createWebLoaderApi(rawBridge, mod.metadata, session.loaderVersion);
    const modRequire = createRequire(mod.entryPath);
    const moduleObject = { exports: {} };

    try {
      const modFunction = new AsyncFunction(
        'WebLoader',
        'require',
        'module',
        'exports',
        '__filename',
        '__dirname',
        `${mod.source}\n//# sourceURL=${mod.entryUrl}`,
      );
      Promise.resolve(
        modFunction(
          api,
          modRequire,
          moduleObject,
          moduleObject.exports,
          mod.entryPath,
          path.dirname(mod.entryPath),
        ),
      ).catch((error) => api.error(error));
    } catch (error) {
      api.error(error);
    }
  }

  function runMod(mod) {
    if (mod.world === 'isolated') {
      runIsolatedMod(mod);
    } else {
      runPageMod(mod);
    }
  }

  function schedule(mod) {
    if (mod.runAt === 'document-start') {
      runMod(mod);
      return;
    }

    if (mod.runAt === 'document-end') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => runMod(mod), { once: true });
      } else {
        runMod(mod);
      }
      return;
    }

    if (document.readyState === 'complete') {
      runMod(mod);
    } else {
      window.addEventListener('load', () => runMod(mod), { once: true });
    }
  }

  const activeMods = session.mods.filter((mod) => shouldRun(mod, window.location.href));

  if (activeMods.length > 0) {
    console.log(
      `[WebLoader] ${window.location.host}：已加载 ${activeMods.length} 个 Mod（${activeMods
        .map((mod) => mod.id)
        .join(', ')}）`,
    );
  }

  activeMods.forEach(schedule);
}

runPreload();
