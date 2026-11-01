'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { installSite } = require('../src/install');
const { loadConfig } = require('../src/config');
const { discoverMods, MANIFEST_FILENAME } = require('../src/mods');
const { setModEnabled } = require('../src/mod-state');
const { installBuiltinMods } = require('../src/builtin-mods');

function makeProject(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-state-'));
  installSite(dir, 'https://www.bilibili.com/');
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeMod(projectDir, folder, manifest, source = "WebLoader.log('loaded');") {
  const modDir = path.join(projectDir, 'mods', folder);
  fs.mkdirSync(modDir, { recursive: true });
  fs.writeFileSync(
    path.join(modDir, MANIFEST_FILENAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(path.join(modDir, manifest.entry || 'index.js'), source, 'utf8');
  return modDir;
}

function readManifest(modDir) {
  return JSON.parse(fs.readFileSync(path.join(modDir, MANIFEST_FILENAME), 'utf8'));
}

function discover(projectDir) {
  return discoverMods(projectDir, loadConfig(projectDir));
}

test('disables and enables a mod in both config and manifest', (t) => {
  const dir = makeProject(t);
  const modDir = writeMod(dir, 'hello', {
    id: 'hello',
    name: 'Hello',
    entry: 'index.js',
  });

  const disabled = setModEnabled(dir, 'hello', false);
  assert.equal(disabled.changed, true);
  assert.equal(disabled.mod.enabled, false);
  assert.deepEqual(loadConfig(dir).mods.disabled, ['hello']);
  assert.equal(readManifest(modDir).enabled, false);
  assert.equal(discover(dir).mods.find((mod) => mod.id === 'hello').enabled, false);

  const enabled = setModEnabled(dir, 'hello', true);
  assert.equal(enabled.changed, true);
  assert.equal(enabled.mod.enabled, true);
  assert.deepEqual(loadConfig(dir).mods.disabled, []);
  assert.equal(readManifest(modDir).enabled, true);
  assert.equal(discover(dir).mods.find((mod) => mod.id === 'hello').enabled, true);
});

test('enables a manifest-disabled mod and clears config entries', (t) => {
  const dir = makeProject(t);
  const modDir = writeMod(dir, 'off-by-default', {
    id: 'off-by-default',
    name: 'Off',
    entry: 'index.js',
    enabled: false,
  });

  const config = loadConfig(dir);
  config.mods.disabled = ['off-by-default'];
  fs.writeFileSync(
    path.join(dir, 'WebLoader.loader.config.json'),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );

  const result = setModEnabled(dir, 'off-by-default', true);
  assert.equal(result.changed, true);
  assert.equal(result.mod.enabled, true);
  assert.equal(readManifest(modDir).enabled, true);
  assert.deepEqual(loadConfig(dir).mods.disabled, []);
});

test('resolves a mod by its directory name and stores the canonical id', (t) => {
  const dir = makeProject(t);
  writeMod(dir, 'folder-name', {
    id: 'canonical-id',
    name: 'Folder',
    entry: 'index.js',
  });

  const result = setModEnabled(dir, 'folder-name', false);
  assert.equal(result.mod.id, 'canonical-id');
  assert.deepEqual(loadConfig(dir).mods.disabled, ['canonical-id']);
});

test('reports no change when the requested state already applies', (t) => {
  const dir = makeProject(t);
  writeMod(dir, 'enabled-mod', {
    name: 'Enabled',
    entry: 'index.js',
  });
  writeMod(dir, 'disabled-mod', {
    name: 'Disabled',
    entry: 'index.js',
    enabled: false,
  });

  assert.equal(setModEnabled(dir, 'enabled-mod', true).changed, false);
  assert.equal(setModEnabled(dir, 'disabled-mod', false).changed, false);
});

test('protects the built-in manager from being disabled', (t) => {
  const dir = makeProject(t);
  assert.throws(
    () => setModEnabled(dir, 'WebLoaderManager', false),
    /内置 Mod .*不能禁用/,
  );

  assert.equal(discover(dir).mods.find((mod) => mod.protected).enabled, true);
});

test('allows an optional built-in mod to be enabled and disabled', (t) => {
  const dir = makeProject(t);
  const pageToolkitDir = path.join(dir, 'mods', 'PageToolkit');

  const initial = discover(dir).mods.find((mod) => mod.id === 'page-toolkit');
  assert.equal(initial.builtin, true);
  assert.equal(initial.protected, false);
  assert.equal(initial.enabled, false);
  assert.equal(readManifest(pageToolkitDir).enabled, false);

  const enabled = setModEnabled(dir, 'PageToolkit', true);
  assert.equal(enabled.changed, true);
  assert.equal(enabled.mod.enabled, true);
  assert.equal(readManifest(pageToolkitDir).enabled, true);
  assert.deepEqual(loadConfig(dir).mods.disabled, []);

  installBuiltinMods(dir);
  assert.equal(readManifest(pageToolkitDir).enabled, true);
  assert.equal(
    discover(dir).mods.find((mod) => mod.id === 'page-toolkit').enabled,
    true,
  );

  const disabled = setModEnabled(dir, 'page-toolkit', false);
  assert.equal(disabled.changed, true);
  assert.equal(disabled.mod.enabled, false);
  assert.equal(readManifest(pageToolkitDir).enabled, false);
  assert.deepEqual(loadConfig(dir).mods.disabled, ['page-toolkit']);
});

test('reports unknown mods with the available ids', (t) => {
  const dir = makeProject(t);
  writeMod(dir, 'known', { name: 'Known', entry: 'index.js' });

  assert.throws(() => setModEnabled(dir, 'missing', false), /找不到 Mod：missing/);
  assert.throws(() => setModEnabled(dir, 'missing', false), /known/);
});
