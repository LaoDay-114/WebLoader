'use strict';

const fs = require('node:fs');
const { loadConfig, writeConfig } = require('./config');
const { discoverMods } = require('./mods');
const { isBuiltinProtected } = require('./builtin-mods');

function findMod(state, query) {
  const value = typeof query === 'string' ? query.trim() : '';
  if (!value) {
    throw new Error('Mod ID 不能为空。');
  }

  let matches = state.mods.filter((mod) => mod.id === value);
  if (matches.length === 0) {
    matches = state.mods.filter((mod) => mod.dirName === value);
  }
  if (matches.length === 0) {
    const lower = value.toLowerCase();
    matches = state.mods.filter(
      (mod) => mod.id.toLowerCase() === lower || mod.dirName.toLowerCase() === lower,
    );
  }

  if (matches.length === 0) {
    const available =
      state.mods.length > 0 ? state.mods.map((mod) => mod.id).join(', ') : '（无）';
    throw new Error(`找不到 Mod：${value}。当前可用的 Mod：${available}`);
  }
  if (matches.length > 1) {
    throw new Error(`Mod 名称不唯一：${value}，请改用 Mod ID。`);
  }

  return matches[0];
}

function writeManifestEnabled(mod, enabled) {
  const manifest = JSON.parse(fs.readFileSync(mod.manifestPath, 'utf8'));
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error(`${mod.id} 的配置文件不是 JSON 对象。`);
  }

  if (manifest.enabled === enabled) {
    return false;
  }
  if (enabled && manifest.enabled === undefined) {
    return false;
  }

  manifest.enabled = enabled;
  const temporaryPath = `${mod.manifestPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  try {
    fs.renameSync(temporaryPath, mod.manifestPath);
  } catch (error) {
    if (error.code !== 'EEXIST' && error.code !== 'EPERM') {
      throw error;
    }
    fs.rmSync(mod.manifestPath, { force: true });
    fs.renameSync(temporaryPath, mod.manifestPath);
  }

  return true;
}

function setModEnabled(projectDir, query, enabled, options = {}) {
  if (typeof enabled !== 'boolean') {
    throw new Error('enabled 必须是布尔值。');
  }

  const config = options.config || loadConfig(projectDir);
  const state = options.state || discoverMods(projectDir, config);
  const mod = findMod(state, query);
  const protectedBuiltin =
    mod.protected === true || isBuiltinProtected(mod.id) || isBuiltinProtected(mod.dirName);

  if (protectedBuiltin && !enabled) {
    throw new Error(`内置 Mod ${mod.id} 受保护，不能禁用。`);
  }

  if (mod.enabled === enabled) {
    return {
      config,
      state,
      mod,
      changed: false,
      manifestChanged: false,
      configChanged: false,
      manifestWarning: '',
    };
  }

  let manifestChanged = false;
  let manifestWarning = '';

  if (enabled) {
    manifestChanged = writeManifestEnabled(mod, true);
  } else {
    try {
      manifestChanged = writeManifestEnabled(mod, false);
    } catch (error) {
      manifestWarning = error.message;
    }
  }

  const disabled = new Set(config.mods.disabled);
  let configChanged = false;

  if (enabled) {
    for (const identifier of [mod.id, mod.dirName]) {
      if (disabled.delete(identifier)) {
        configChanged = true;
      }
    }
  } else if (!disabled.has(mod.id)) {
    disabled.add(mod.id);
    configChanged = true;
  }

  let nextConfig = config;
  if (configChanged) {
    nextConfig = {
      ...config,
      mods: {
        ...config.mods,
        disabled: [...disabled],
      },
    };
    writeConfig(projectDir, nextConfig);
  }

  const changed = manifestChanged || configChanged;
  const nextState = changed ? discoverMods(projectDir, nextConfig) : state;
  let nextMod = nextState.mods.find((item) => item.id === mod.id);
  if (!nextMod) {
    nextMod = mod;
  }

  return {
    config: nextConfig,
    state: nextState,
    mod: nextMod,
    changed,
    manifestChanged,
    configChanged,
    manifestWarning,
  };
}

module.exports = {
  findMod,
  setModEnabled,
};
