'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MANIFEST_FILENAME = 'WebLoader.mod.json';

const BUILTIN_MODS = Object.freeze([
  Object.freeze({
    id: 'WebLoaderManager',
    dirName: 'WebLoaderManager',
    name: 'WebLoader Manager',
    protected: true,
    defaultEnabled: true,
  }),
  Object.freeze({
    id: 'page-toolkit',
    dirName: 'PageToolkit',
    name: 'Page Toolkit',
    protected: false,
    defaultEnabled: false,
  }),
]);

const BUILTIN_KEYS = new Map();
for (const mod of BUILTIN_MODS) {
  BUILTIN_KEYS.set(mod.id.toLowerCase(), mod);
  BUILTIN_KEYS.set(mod.dirName.toLowerCase(), mod);
}

function getBuiltinMod(id, dirName) {
  if (typeof id === 'string') {
    const byId = BUILTIN_KEYS.get(id.trim().toLowerCase());
    if (byId) {
      return byId;
    }
  }
  if (typeof dirName === 'string') {
    const byDir = BUILTIN_KEYS.get(dirName.trim().toLowerCase());
    if (byDir) {
      return byDir;
    }
  }
  return null;
}

function isBuiltinIdentifier(value) {
  return typeof value === 'string' && BUILTIN_KEYS.has(value.trim().toLowerCase());
}

function isBuiltinMod(id, dirName) {
  return Boolean(getBuiltinMod(id, dirName));
}

function isBuiltinProtected(value) {
  const mod = getBuiltinMod(value);
  return Boolean(mod && mod.protected);
}

function getBuiltinSourceDir(mod) {
  return path.join(__dirname, 'builtin-mods', mod.dirName);
}

function readManifestEnabled(manifestPath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return typeof manifest.enabled === 'boolean' ? manifest.enabled : null;
  } catch {
    return null;
  }
}

function writeManifestEnabled(manifestPath, enabled) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.enabled = enabled;
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

function installBuiltinMods(projectDir) {
  const modsDir = path.join(projectDir, 'mods');
  fs.mkdirSync(modsDir, { recursive: true });

  const installed = [];
  for (const mod of BUILTIN_MODS) {
    const sourceDir = getBuiltinSourceDir(mod);
    if (!fs.existsSync(sourceDir)) {
      throw new Error(`找不到内置 Mod 源文件：${sourceDir}`);
    }

    const targetDir = path.join(modsDir, mod.dirName);
    const manifestPath = path.join(targetDir, MANIFEST_FILENAME);
    const created = !fs.existsSync(targetDir);
    const previousEnabled = mod.protected ? null : readManifestEnabled(manifestPath);

    fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });

    if (!mod.protected && previousEnabled !== null) {
      if (readManifestEnabled(manifestPath) !== previousEnabled) {
        writeManifestEnabled(manifestPath, previousEnabled);
      }
    }

    installed.push({
      id: mod.id,
      dirName: mod.dirName,
      name: mod.name,
      protected: mod.protected,
      defaultEnabled: mod.defaultEnabled,
      created,
      sourceDir,
      targetDir,
    });
  }

  return { modsDir, installed };
}

function removeProtectedBuiltinFromDisabled(config) {
  const disabled = config.mods.disabled.filter((item) => !isBuiltinProtected(item));
  if (disabled.length === config.mods.disabled.length) {
    return config;
  }

  return {
    ...config,
    mods: {
      ...config.mods,
      disabled,
    },
  };
}

module.exports = {
  BUILTIN_MODS,
  getBuiltinMod,
  getBuiltinSourceDir,
  installBuiltinMods,
  isBuiltinIdentifier,
  isBuiltinMod,
  isBuiltinProtected,
  removeProtectedBuiltinFromDisabled,
};
