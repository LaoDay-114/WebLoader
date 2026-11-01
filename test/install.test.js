'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { installSite } = require('../src/install');
const { CONFIG_FILENAME, loadConfig } = require('../src/config');

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-install-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('installs a config and mods directory', (t) => {
  const dir = makeTempDir(t);
  const result = installSite(dir, 'https://www.bilibili.com/', { name: 'Bilibili' });

  assert.equal(result.config.site.name, 'Bilibili');
  assert.equal(fs.existsSync(result.configPath), true);
  assert.equal(path.basename(result.configPath), CONFIG_FILENAME);
  assert.equal(fs.statSync(result.modsDir).isDirectory(), true);
  assert.equal(result.builtinMods.length, 2);
  assert.equal(
    fs.existsSync(path.join(result.modsDir, 'WebLoaderManager', 'WebLoader.mod.json')),
    true,
  );
  const pageToolkitManifest = JSON.parse(
    fs.readFileSync(
      path.join(result.modsDir, 'PageToolkit', 'WebLoader.mod.json'),
      'utf8',
    ),
  );
  assert.equal(pageToolkitManifest.enabled, false);

  const loaded = loadConfig(dir);
  assert.equal(loaded.site.url, 'https://www.bilibili.com/');
  assert.equal(loaded.site.name, 'Bilibili');
});

test('refuses to overwrite an existing installation without force', (t) => {
  const dir = makeTempDir(t);
  installSite(dir, 'https://example.com/');

  assert.throws(
    () => installSite(dir, 'https://other.example/'),
    (error) => error.code === 'CONFIG_ALREADY_EXISTS',
  );

  assert.equal(loadConfig(dir).site.url, 'https://example.com/');
});

test('force overwrites config but keeps mods', (t) => {
  const dir = makeTempDir(t);
  const first = installSite(dir, 'https://example.com/');
  const modFile = path.join(first.modsDir, 'kept.js');
  fs.writeFileSync(modFile, 'kept', 'utf8');

  installSite(dir, 'https://www.bilibili.com/', { force: true });

  assert.equal(loadConfig(dir).site.url, 'https://www.bilibili.com/');
  assert.equal(fs.readFileSync(modFile, 'utf8'), 'kept');
});

test('does not write files for an invalid URL', (t) => {
  const dir = makeTempDir(t);
  assert.throws(() => installSite(dir, 'ftp://example.com/'), /http/);
  assert.equal(fs.existsSync(path.join(dir, CONFIG_FILENAME)), false);
  assert.equal(fs.existsSync(path.join(dir, 'mods')), false);
});
