'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  ipcMain,
  session,
  shell,
} = require('electron');
const packageJson = require('../package.json');
const { CONFIG_FILENAME, getConfigPath, loadConfig, writeConfig } = require('./config');
const { discoverMods, toPublicMods } = require('./mods');
const { installBuiltinMods, removeProtectedBuiltinFromDisabled } = require('./builtin-mods');
const { setModEnabled } = require('./mod-state');

app.setName('WebLoader');

let projectDir = '';
let config = null;
let modsState = { mods: [], errors: [], modsDir: '' };
let bridgeName = '';
let mainWindow = null;
let watcher = null;
let configWatcher = null;
let reloadTimer = null;
let reloadNeedsConfig = false;
let storageDir = '';

function resolveProjectDir() {
  const argument = process.argv.find((item) => item.startsWith('--webloader-project='));
  if (argument) {
    return path.resolve(argument.slice('--webloader-project='.length));
  }
  if (process.env.WEBLOADER_PROJECT) {
    return path.resolve(process.env.WEBLOADER_PROJECT);
  }
  return process.cwd();
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAboutBlank(value) {
  return value === 'about:blank';
}

function openExternal(value) {
  if (!value || value.startsWith('javascript:') || value.startsWith('data:')) {
    return;
  }
  shell.openExternal(value).catch((error) => {
    console.warn(`[WebLoader] 无法打开外部链接 ${value}：${error.message}`);
  });
}

function browserPreferences() {
  return {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    sandbox: false,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    webviewTag: false,
    devTools: true,
    spellcheck: true,
    navigateOnDragDrop: false,
  };
}

function childWindowOptions() {
  return {
    width: config.window.width,
    height: config.window.height,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    resizable: config.window.resizable,
    backgroundColor: '#101114',
    autoHideMenuBar: false,
    webPreferences: browserPreferences(),
  };
}

function setupWebContents(contents) {
  if (contents.getType() !== 'window') {
    return;
  }

  contents.setUserAgent(app.userAgentFallback);

  contents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url) || isAboutBlank(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: childWindowOptions(),
      };
    }

    openExternal(url);
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (isHttpUrl(url) || isAboutBlank(url)) {
      return;
    }

    event.preventDefault();
    openExternal(url);
  });

  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

function refreshMods(options = {}) {
  const result = discoverMods(projectDir, config);
  modsState = result;

  if (options.quiet === true) {
    return;
  }

  const enabled = result.mods.filter((mod) => mod.enabled);
  console.log(
    `[WebLoader] 发现 ${result.mods.length} 个 Mod，启用 ${enabled.length} 个。`,
  );

  for (const mod of enabled) {
    console.log(
      `[WebLoader]   + ${mod.id}@${mod.version} (${mod.world} / ${mod.runAt})`,
    );
  }

  for (const error of result.errors) {
    const where = path.relative(projectDir, error.manifestPath || error.dir);
    console.warn(`[WebLoader]   ! ${where}: ${error.message}`);
  }
}

function buildSession() {
  const mods = modsState.mods
    .filter((mod) => mod.enabled)
    .map((mod) => ({
      id: mod.id,
      name: mod.name,
      version: mod.version,
      author: mod.author,
      description: mod.description,
      entry: mod.entry,
      entryPath: mod.entryPath,
      entryUrl: pathToFileURL(mod.entryPath).href,
      runAt: mod.runAt,
      world: mod.world,
      priority: mod.priority,
      matches: mod.matches,
      excludeMatches: mod.excludeMatches,
      metadata: mod.metadata,
      source: mod.source,
    }));

  return {
    loaderVersion: packageJson.version,
    bridgeName,
    projectDir,
    storageDir,
    site: {
      url: config.site.url,
      name: config.site.name,
    },
    mods,
  };
}

function createWindow(targetUrl) {
  const win = new BrowserWindow({
    width: config.window.width,
    height: config.window.height,
    minWidth: config.window.minWidth,
    minHeight: config.window.minHeight,
    resizable: config.window.resizable,
    title: `${config.site.name} - WebLoader`,
    backgroundColor: '#101114',
    webPreferences: browserPreferences(),
  });

  win.webContents.setUserAgent(app.userAgentFallback);

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame && errorCode !== -3 && !win.isDestroyed()) {
      console.warn(
        `[WebLoader] 页面加载失败（${errorCode}）：${errorDescription} - ${validatedURL}`,
      );
    }
  });

  win.loadURL(targetUrl).catch((error) => {
    if (!win.isDestroyed()) {
      console.error(`[WebLoader] 无法加载 ${targetUrl}：${error.message}`);
    }
  });

  return win;
}

function buildApplicationMenu() {
  const template = [];

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 WebLoader' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 WebLoader' },
      ],
    });
  }

  template.push(
    {
      label: '文件',
      submenu: [
        {
          label: '打开 Mods 目录',
          click: () => {
            shell.openPath(modsState.modsDir || path.join(projectDir, 'mods')).catch(() => {});
          },
        },
        {
          label: '打开加载器配置',
          click: () => {
            shell.openPath(getConfigPath(projectDir)).catch(() => {});
          },
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
  );

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function scheduleReload(message, needsConfig) {
  if (needsConfig) {
    reloadNeedsConfig = true;
  }

  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    const shouldReloadConfig = reloadNeedsConfig;
    reloadNeedsConfig = false;

    if (shouldReloadConfig) {
      try {
        config = loadConfig(projectDir);
      } catch (error) {
        console.warn(`[WebLoader] 重新读取加载器配置失败：${error.message}`);
      }
    }

    refreshMods();
    console.log(message);
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.reload();
      }
    }
  }, 350);
}

function setupModWatcher() {
  if (!config.mods.watch) {
    return;
  }

  try {
    watcher = fs.watch(
      path.join(projectDir, 'mods'),
      { recursive: true },
      (eventType, filename) => {
        if (filename && String(filename).endsWith('.tmp')) {
          return;
        }
        scheduleReload('[WebLoader] Mod 文件已变化，正在重新加载页面...', false);
      },
    );

    watcher.on('error', (error) => {
      console.warn(`[WebLoader] Mod 目录监视失败：${error.message}`);
    });
  } catch (error) {
    console.warn(`[WebLoader] 无法监视 Mod 目录：${error.message}`);
  }

  try {
    configWatcher = fs.watch(projectDir, (eventType, filename) => {
      const name = String(filename || '');
      if (name && name !== CONFIG_FILENAME) {
        return;
      }
      scheduleReload('[WebLoader] 加载器配置已变化，正在重新加载页面...', true);
    });

    configWatcher.on('error', (error) => {
      console.warn(`[WebLoader] 加载器配置监视失败：${error.message}`);
    });
  } catch (error) {
    console.warn(`[WebLoader] 无法监视加载器配置：${error.message}`);
  }
}

function showFatalError(error) {
  const message = error && error.message ? error.message : String(error);
  console.error(`[WebLoader] 启动失败：${message}`);
  try {
    dialog.showErrorBox('WebLoader 启动失败', message);
  } catch {}
  app.exit(1);
}

async function start() {
  projectDir = resolveProjectDir();

  try {
    config = loadConfig(projectDir);
  } catch (error) {
    showFatalError(error);
    return;
  }

  if (process.platform === 'win32') {
    app.setAppUserModelId('com.webloader.app');
  }

  const baseUserAgent = session.defaultSession.getUserAgent();
  app.userAgentFallback =
    config.userAgent ||
    baseUserAgent
      .replace(/\sElectron\/[^\s]+/g, '')
      .replace(/\sWebLoader\/[^\s]+/g, '');

  fs.mkdirSync(path.join(projectDir, 'mods'), { recursive: true });
  try {
    installBuiltinMods(projectDir);
  } catch (error) {
    console.warn(`[WebLoader] 无法安装内置 Mod：${error.message}`);
  }

  storageDir = path.join(projectDir, '.webloader', 'storage');
  fs.mkdirSync(storageDir, { recursive: true });

  const cleanedConfig = removeProtectedBuiltinFromDisabled(config);
  if (cleanedConfig !== config) {
    config = cleanedConfig;
    try {
      writeConfig(projectDir, config);
    } catch (error) {
      console.warn(`[WebLoader] 无法清理内置 Mod 的禁用状态：${error.message}`);
    }
  }

  bridgeName = `__webloaderBridge_${crypto.randomBytes(8).toString('hex')}`;

  refreshMods();
  buildApplicationMenu();

  ipcMain.on('webloader:get-session', (event) => {
    try {
      event.returnValue = {
        ok: true,
        data: buildSession(),
      };
    } catch (error) {
      event.returnValue = {
        ok: false,
        error: error.message,
      };
    }
  });

  ipcMain.on('webloader:log', (event, modId, level, message) => {
    const prefix = `[WebLoader:${String(modId).slice(0, 64)}]`;
    const output =
      level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    output(`${prefix} ${String(message)}`);
  });

  ipcMain.on('webloader:get-mods', (event) => {
    try {
      event.returnValue = {
        ok: true,
        data: toPublicMods(modsState.mods),
      };
    } catch (error) {
      event.returnValue = {
        ok: false,
        error: error.message,
      };
    }
  });

  ipcMain.on('webloader:set-mod-enabled', (event, modId, enabled) => {
    try {
      const id = typeof modId === 'string' ? modId : '';
      if (!id || typeof enabled !== 'boolean') {
        throw new Error('参数无效：需要 Mod ID 和布尔值。');
      }

      const result = setModEnabled(projectDir, id, enabled);
      config = result.config;
      modsState = result.state;

      console.log(
        `[WebLoader] ${enabled ? '已启用' : '已禁用'} Mod：${result.mod.id}`,
      );

      event.returnValue = {
        ok: true,
        data: toPublicMods(modsState.mods),
        changed: result.changed,
      };
    } catch (error) {
      event.returnValue = {
        ok: false,
        error: error.message,
      };
    }
  });

  app.on('web-contents-created', (event, contents) => {
    setupWebContents(contents);
  });

  console.log(`[WebLoader] v${packageJson.version}`);
  console.log(`[WebLoader] 目标网站：${config.site.url}`);

  mainWindow = createWindow(config.site.url);

  const shouldOpenDevTools =
    config.devTools || process.argv.includes('--webloader-devtools');
  if (shouldOpenDevTools) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    });
  }

  setupModWatcher();
}

app.whenReady().then(start).catch(showFatalError);

app.on('activate', () => {
  if (config && BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createWindow(config.site.url);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  clearTimeout(reloadTimer);
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (configWatcher) {
    configWatcher.close();
    configWatcher = null;
  }
});
