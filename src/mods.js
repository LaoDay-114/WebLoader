'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  siteUrlToMatchPattern,
  validatePatterns,
} = require('./matcher');
const { getBuiltinMod } = require('./builtin-mods');

const MANIFEST_FILENAME = 'WebLoader.mod.json';
const RUN_AT_VALUES = new Set(['document-start', 'document-end', 'document-idle']);
const WORLD_VALUES = new Set(['page', 'isolated']);
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value, field, fallback) {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} 必须是字符串。`);
  }
  return value;
}

function resolveEntryPath(modDir, entry) {
  if (typeof entry !== 'string' || entry.trim() === '') {
    throw new Error('entry 必须是非空的 JavaScript 文件路径。');
  }

  const entryPath = path.resolve(modDir, entry);
  const relative = path.relative(modDir, entryPath);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error('entry 不能指向 Mod 目录之外。');
  }

  let stat;
  try {
    stat = fs.statSync(entryPath);
  } catch {
    throw new Error(`找不到入口文件：${entry}`);
  }

  if (!stat.isFile()) {
    throw new Error(`入口路径不是文件：${entry}`);
  }

  return {
    entryPath,
    source: fs.readFileSync(entryPath, 'utf8'),
  };
}

function parseManifest(modDir, dirName, manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取 ${MANIFEST_FILENAME}：${error.message}`);
  }

  if (!isPlainObject(manifest)) {
    throw new Error(`${MANIFEST_FILENAME} 必须是一个 JSON 对象。`);
  }

  const id = optionalString(manifest.id, 'id', dirName).trim();
  if (!ID_PATTERN.test(id)) {
    throw new Error(`无效的 Mod ID：${id}。只能使用字母、数字、点、下划线和短横线。`);
  }

  const name = optionalString(manifest.name, 'name', id).trim() || id;
  const version = optionalString(manifest.version, 'version', '0.0.0').trim() || '0.0.0';
  const author = optionalString(manifest.author, 'author', 'Unknown').trim() || 'Unknown';
  const description = optionalString(manifest.description, 'description', '').trim();
  const runAt = optionalString(manifest.runAt, 'runAt', 'document-end').trim();
  const world = optionalString(manifest.world, 'world', 'page').trim();

  if (!RUN_AT_VALUES.has(runAt)) {
    throw new Error(`runAt 必须是 ${[...RUN_AT_VALUES].join(' / ')} 之一。`);
  }
  if (!WORLD_VALUES.has(world)) {
    throw new Error(`world 必须是 ${[...WORLD_VALUES].join(' / ')} 之一。`);
  }
  if (manifest.enabled !== undefined && typeof manifest.enabled !== 'boolean') {
    throw new Error('enabled 必须是布尔值。');
  }

  const priority = manifest.priority === undefined ? 0 : Number(manifest.priority);
  if (!Number.isFinite(priority)) {
    throw new Error('priority 必须是数字。');
  }

  const { entryPath, source } = resolveEntryPath(modDir, manifest.entry);

  return {
    id,
    dirName,
    name,
    version,
    author,
    description,
    entry: manifest.entry,
    entryPath,
    source,
    runAt,
    world,
    priority,
    enabled: manifest.enabled !== false,
    matches: manifest.matches,
    excludeMatches: manifest.excludeMatches,
    manifest,
    manifestPath,
    dir: modDir,
  };
}

function discoverMods(projectDir, config) {
  const modsDir = path.join(projectDir, 'mods');
  const errors = [];
  const mods = [];

  if (!fs.existsSync(modsDir)) {
    return {
      modsDir,
      mods,
      errors: [
        {
          dir: modsDir,
          manifestPath: null,
          message: 'mods 目录不存在。',
        },
      ],
    };
  }

  let entries;
  try {
    entries = fs.readdirSync(modsDir, { withFileTypes: true });
  } catch (error) {
    return {
      modsDir,
      mods,
      errors: [
        {
          dir: modsDir,
          manifestPath: null,
          message: `无法读取 mods 目录：${error.message}`,
        },
      ],
    };
  }

  const disabledIds = new Set(config.mods.disabled);
  const defaultMatch = siteUrlToMatchPattern(config.site.url);
  const seenIds = new Set();

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') {
      continue;
    }

    const modDir = path.join(modsDir, entry.name);
    const manifestPath = path.join(modDir, MANIFEST_FILENAME);

    if (!fs.existsSync(manifestPath)) {
      errors.push({
        dir: modDir,
        manifestPath,
        message: `缺少 ${MANIFEST_FILENAME}。`,
      });
      continue;
    }

    try {
      const mod = parseManifest(modDir, entry.name, manifestPath);
      if (seenIds.has(mod.id)) {
        throw new Error(`Mod ID 重复：${mod.id}`);
      }

      const matches = validatePatterns(mod.matches, 'matches');
      const excludeMatches = validatePatterns(mod.excludeMatches, 'excludeMatches');

      mod.matches = matches.length > 0 ? matches : [defaultMatch];
      mod.excludeMatches = excludeMatches;

      const builtinMod = getBuiltinMod(mod.id, mod.dirName);
      mod.builtin = Boolean(builtinMod);
      mod.protected = Boolean(builtinMod && builtinMod.protected);
      mod.enabled =
        mod.protected ||
        (mod.enabled && !disabledIds.has(mod.id) && !disabledIds.has(mod.dirName));
      mod.metadata = {
        id: mod.id,
        name: mod.name,
        version: mod.version,
        author: mod.author,
        description: mod.description,
        entry: mod.entry,
        runAt: mod.runAt,
        world: mod.world,
        priority: mod.priority,
        builtin: mod.builtin,
        protected: mod.protected,
        matches: mod.matches,
        excludeMatches: mod.excludeMatches,
      };

      seenIds.add(mod.id);
      mods.push(mod);
    } catch (error) {
      errors.push({
        dir: modDir,
        manifestPath,
        message: error.message,
      });
    }
  }

  mods.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  return { modsDir, mods, errors };
}

function isValidModId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

function validateModId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!isValidModId(id)) {
    throw new Error(
      `无效的 Mod ID：${id || '(空)'}。只能使用字母、数字、点、下划线和短横线，且必须以字母或数字开头，最长 64 字符。`,
    );
  }
  return id;
}

function toPublicMod(mod) {
  return {
    id: mod.id,
    dirName: mod.dirName,
    name: mod.name,
    version: mod.version,
    author: mod.author,
    description: mod.description,
    entry: mod.entry,
    runAt: mod.runAt,
    world: mod.world,
    priority: mod.priority,
    enabled: Boolean(mod.enabled),
    builtin: Boolean(mod.builtin),
    protected: Boolean(mod.protected),
    matches: [...mod.matches],
    excludeMatches: [...mod.excludeMatches],
  };
}

function toPublicMods(mods) {
  return mods.map(toPublicMod);
}

module.exports = {
  MANIFEST_FILENAME,
  RUN_AT_VALUES,
  WORLD_VALUES,
  discoverMods,
  isValidModId,
  toPublicMod,
  toPublicMods,
  validateModId,
};
