'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDefaultConfig } = require('../src/config');
const { installSite } = require('../src/install');
const {
  getBuiltinMod,
  installBuiltinMods,
  isBuiltinProtected,
  removeProtectedBuiltinFromDisabled,
} = require('../src/builtin-mods');

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-builtins-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function readManifest(projectDir, dirName) {
  return JSON.parse(
    fs.readFileSync(
      path.join(projectDir, 'mods', dirName, 'WebLoader.mod.json'),
      'utf8',
    ),
  );
}

function writeManifest(projectDir, dirName, manifest) {
  fs.writeFileSync(
    path.join(projectDir, 'mods', dirName, 'WebLoader.mod.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

test('installs the protected manager and the default-off PageToolkit', (t) => {
  const dir = makeTempDir(t);
  const result = installSite(dir, 'https://www.bilibili.com/');

  assert.deepEqual(
    result.builtinMods.map((mod) => mod.id),
    ['WebLoaderManager', 'page-toolkit'],
  );
  assert.equal(readManifest(dir, 'WebLoaderManager').enabled, true);
  assert.equal(readManifest(dir, 'PageToolkit').enabled, false);
  assert.equal(isBuiltinProtected('WebLoaderManager'), true);
  assert.equal(isBuiltinProtected('PageToolkit'), false);
  assert.equal(getBuiltinMod('page-toolkit').dirName, 'PageToolkit');
});

test('startup sync keeps optional state but restores protected defaults', (t) => {
  const dir = makeTempDir(t);
  installSite(dir, 'https://www.bilibili.com/');

  writeManifest(dir, 'PageToolkit', {
    ...readManifest(dir, 'PageToolkit'),
    enabled: true,
  });
  writeManifest(dir, 'WebLoaderManager', {
    ...readManifest(dir, 'WebLoaderManager'),
    enabled: false,
  });

  installBuiltinMods(dir);

  assert.equal(readManifest(dir, 'PageToolkit').enabled, true);
  assert.equal(readManifest(dir, 'WebLoaderManager').enabled, true);
});

test('startup cleanup only removes protected built-ins from the disabled list', () => {
  const config = createDefaultConfig('https://example.com/');
  config.mods.disabled = [
    'WebLoaderManager',
    'webloadermanager',
    'PageToolkit',
    'other',
  ];

  const cleaned = removeProtectedBuiltinFromDisabled(config);
  assert.notEqual(cleaned, config);
  assert.deepEqual(cleaned.mods.disabled, ['PageToolkit', 'other']);

  const optionalOnly = createDefaultConfig('https://example.com/');
  optionalOnly.mods.disabled = ['PageToolkit'];
  assert.equal(removeProtectedBuiltinFromDisabled(optionalOnly), optionalOnly);
});
