'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILENAME = 'WebLoader.loader.config.json';
const FORMAT_VERSION = 1;

const DEFAULT_WINDOW = Object.freeze({
  width: 1440,
  height: 900,
  minWidth: 800,
  minHeight: 600,
  resizable: true,
});

function getConfigPath(projectDir) {
  return path.join(projectDir, CONFIG_FILENAME);
}

function normalizeSiteUrl(input) {
  if (typeof input !== 'string' || input.trim() === '') {
    throw new Error('网站地址不能为空。');
  }

  let value = input.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`无效的网站地址：${input}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('WebLoader 目前只支持 http:// 和 https:// 网站。');
  }

  return url.href;
}

function inferSiteName(siteUrl) {
  const hostname = new URL(siteUrl).hostname.replace(/^www\./i, '');
  return hostname || 'WebLoader';
}

function positiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.round(number);
}

function normalizeConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('WebLoader.loader.config.json 必须是一个 JSON 对象。');
  }

  const formatVersion = raw.formatVersion ?? FORMAT_VERSION;
  if (formatVersion !== FORMAT_VERSION) {
    throw new Error(`不支持的配置格式版本：${formatVersion}`);
  }

  if (!raw.site || typeof raw.site !== 'object') {
    throw new Error('配置缺少 site 字段。');
  }

  const siteUrl = normalizeSiteUrl(raw.site.url);
  const siteName =
    typeof raw.site.name === 'string' && raw.site.name.trim()
      ? raw.site.name.trim()
      : inferSiteName(siteUrl);

  const windowConfig = raw.window && typeof raw.window === 'object' ? raw.window : {};
  const modsConfig = raw.mods && typeof raw.mods === 'object' ? raw.mods : {};

  const disabled = modsConfig.disabled ?? [];
  if (!Array.isArray(disabled) || disabled.some((item) => typeof item !== 'string')) {
    throw new Error('mods.disabled 必须是 Mod ID 字符串数组。');
  }

  const config = {
    formatVersion: FORMAT_VERSION,
    site: {
      url: siteUrl,
      name: siteName,
    },
    window: {
      width: positiveInteger(windowConfig.width, DEFAULT_WINDOW.width),
      height: positiveInteger(windowConfig.height, DEFAULT_WINDOW.height),
      minWidth: positiveInteger(windowConfig.minWidth, DEFAULT_WINDOW.minWidth),
      minHeight: positiveInteger(windowConfig.minHeight, DEFAULT_WINDOW.minHeight),
      resizable: windowConfig.resizable !== false,
    },
    devTools: raw.devTools === true,
    mods: {
      watch: modsConfig.watch !== false,
      disabled: disabled.map((item) => item.trim()).filter(Boolean),
    },
  };

  if (typeof raw.userAgent === 'string' && raw.userAgent.trim()) {
    config.userAgent = raw.userAgent.trim();
  }

  return config;
}

function createDefaultConfig(siteUrl, name) {
  return normalizeConfig({
    formatVersion: FORMAT_VERSION,
    site: {
      url: siteUrl,
      name: name || undefined,
    },
    window: DEFAULT_WINDOW,
    devTools: false,
    mods: {
      watch: true,
      disabled: [],
    },
  });
}

function loadConfig(projectDir) {
  const configPath = getConfigPath(projectDir);
  if (!fs.existsSync(configPath)) {
    throw new Error(`未找到 ${CONFIG_FILENAME}，请先运行：WebLoader install <网站地址>`);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取 ${CONFIG_FILENAME}：${error.message}`);
  }

  return normalizeConfig(raw);
}

function writeConfig(projectDir, config) {
  const configPath = getConfigPath(projectDir);
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return configPath;
}

module.exports = {
  CONFIG_FILENAME,
  DEFAULT_WINDOW,
  FORMAT_VERSION,
  createDefaultConfig,
  getConfigPath,
  inferSiteName,
  loadConfig,
  normalizeConfig,
  normalizeSiteUrl,
  writeConfig,
};
