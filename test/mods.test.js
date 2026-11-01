'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDefaultConfig } = require('../src/config');
const {
  discoverMods,
  MANIFEST_FILENAME,
  toPublicMods,
} = require('../src/mods');

function makeProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-mods-'));
  fs.mkdirSync(path.join(dir, 'mods'), { recursive: true });
  const config = createDefaultConfig('https://www.bilibili.com/');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, config };
}

function writeMod(projectDir, folder, manifest, source = "WebLoader.log('loaded');") {
  const modDir = path.join(projectDir, 'mods', folder);
  fs.mkdirSync(modDir, { recursive: true });
  fs.writeFileSync(
    path.join(modDir, MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  if (manifest.entry) {
    fs.writeFileSync(path.join(modDir, manifest.entry), source, 'utf8');
  }
  return modDir;
}

test('discovers a mod and applies defaults for the target site', (t) => {
  const { dir, config } = makeProject(t);
  writeMod(dir, 'hello', {
    name: 'Hello',
    version: '1.2.3',
    author: 'Tester',
    entry: 'index.js',
  });

  const result = discoverMods(dir, config);
  assert.equal(result.errors.length, 0);
  assert.equal(result.mods.length, 1);

  const mod = result.mods[0];
  assert.equal(mod.id, 'hello');
  assert.equal(mod.name, 'Hello');
  assert.equal(mod.version, '1.2.3');
  assert.equal(mod.author, 'Tester');
  assert.equal(mod.enabled, true);
  assert.equal(mod.runAt, 'document-end');
  assert.equal(mod.world, 'page');
  assert.deepEqual(mod.matches, ['https://www.bilibili.com/*']);
  assert.deepEqual(mod.excludeMatches, []);
  assert.match(mod.source, /WebLoader\.log/);
  assert.equal(mod.metadata.id, 'hello');
});

test('honors custom matches, runAt, world, and disabled state', (t) => {
  const { dir, config } = makeProject(t);
  config.mods.disabled = ['disabled-by-config'];
  writeMod(dir, 'custom', {
    id: 'custom',
    name: 'Custom',
    entry: 'main.js',
    matches: ['https://*.bilibili.com/*'],
    excludeMatches: ['https://api.bilibili.com/*'],
    runAt: 'document-start',
    world: 'isolated',
  });
  writeMod(dir, 'disabled-by-config', {
    name: 'Disabled',
    entry: 'index.js',
  });
  writeMod(dir, 'manifest-disabled', {
    name: 'Off',
    entry: 'index.js',
    enabled: false,
  });

  const result = discoverMods(dir, config);
  assert.equal(result.errors.length, 0);

  const custom = result.mods.find((mod) => mod.id === 'custom');
  assert.deepEqual(custom.matches, ['https://*.bilibili.com/*']);
  assert.deepEqual(custom.excludeMatches, ['https://api.bilibili.com/*']);
  assert.equal(custom.runAt, 'document-start');
  assert.equal(custom.world, 'isolated');
  assert.equal(custom.enabled, true);

  assert.equal(
    result.mods.find((mod) => mod.id === 'disabled-by-config').enabled,
    false,
  );
  assert.equal(
    result.mods.find((mod) => mod.id === 'manifest-disabled').enabled,
    false,
  );
});

test('sorts by descending priority', (t) => {
  const { dir, config } = makeProject(t);
  writeMod(dir, 'low', { id: 'low', name: 'Low', entry: 'index.js', priority: -5 });
  writeMod(dir, 'high', { id: 'high', name: 'High', entry: 'index.js', priority: 10 });
  writeMod(dir, 'normal', { id: 'normal', name: 'Normal', entry: 'index.js' });

  const result = discoverMods(dir, config);
  assert.deepEqual(
    result.mods.map((mod) => mod.id),
    ['high', 'normal', 'low'],
  );
});

test('reports invalid mods without breaking discovery', (t) => {
  const { dir, config } = makeProject(t);
  writeMod(dir, 'valid', { name: 'Valid', entry: 'index.js' });
  writeMod(dir, 'traversal', { name: 'Traversal', entry: '../../escape.js' });
  writeMod(dir, 'bad-runat', {
    name: 'Bad RunAt',
    entry: 'index.js',
    runAt: 'whenever',
  });
  writeMod(dir, 'bad-matches', {
    name: 'Bad Matches',
    entry: 'index.js',
    matches: ['not a pattern'],
  });
  fs.mkdirSync(path.join(dir, 'mods', 'missing-manifest'));

  const result = discoverMods(dir, config);
  assert.equal(result.mods.length, 1);
  assert.equal(result.mods[0].id, 'valid');
  assert.equal(result.errors.length, 4);
  assert.ok(result.errors.some((error) => /entry/.test(error.message)));
  assert.ok(result.errors.some((error) => /runAt/.test(error.message)));
  assert.ok(result.errors.some((error) => /match pattern/i.test(error.message)));
  assert.ok(result.errors.some((error) => /缺少/.test(error.message)));
});

test('reports duplicate mod ids', (t) => {
  const { dir, config } = makeProject(t);
  writeMod(dir, 'first', { id: 'same', name: 'First', entry: 'index.js' });
  writeMod(dir, 'second', { id: 'same', name: 'Second', entry: 'index.js' });

  const result = discoverMods(dir, config);
  assert.equal(result.mods.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /重复/);
});

test('reports a missing mods directory', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-empty-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = createDefaultConfig('https://example.com/');

  const result = discoverMods(dir, config);
  assert.equal(result.mods.length, 0);
  assert.match(result.errors[0].message, /mods 目录不存在/);
});

test('marks built-in mods and force-enables only protected built-ins', (t) => {
  const { dir, config } = makeProject(t);
  config.mods.disabled = ['WebLoaderManager', 'PageToolkit', 'regular'];
  writeMod(dir, 'WebLoaderManager', {
    id: 'WebLoaderManager',
    name: 'Manager',
    entry: 'index.js',
    enabled: false,
  });
  writeMod(dir, 'PageToolkit', {
    id: 'page-toolkit',
    name: 'Page Toolkit',
    entry: 'index.js',
    enabled: false,
  });
  writeMod(dir, 'regular', {
    id: 'regular',
    name: 'Regular',
    entry: 'index.js',
  });

  const result = discoverMods(dir, config);
  const manager = result.mods.find((mod) => mod.id === 'WebLoaderManager');
  const pageToolkit = result.mods.find((mod) => mod.id === 'page-toolkit');
  const regular = result.mods.find((mod) => mod.id === 'regular');

  assert.equal(manager.builtin, true);
  assert.equal(manager.protected, true);
  assert.equal(manager.enabled, true);
  assert.equal(manager.metadata.builtin, true);
  assert.equal(manager.metadata.protected, true);

  assert.equal(pageToolkit.builtin, true);
  assert.equal(pageToolkit.protected, false);
  assert.equal(pageToolkit.enabled, false);

  assert.equal(regular.builtin, false);
  assert.equal(regular.protected, false);
  assert.equal(regular.enabled, false);

  const publicManager = toPublicMods(result.mods).find(
    (mod) => mod.id === 'WebLoaderManager',
  );
  assert.equal(publicManager.builtin, true);
  assert.equal(publicManager.protected, true);
  assert.equal(publicManager.enabled, true);
  assert.deepEqual(publicManager.matches, ['https://www.bilibili.com/*']);
});
