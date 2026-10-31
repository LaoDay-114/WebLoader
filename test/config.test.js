'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CONFIG_FILENAME,
  createDefaultConfig,
  loadConfig,
  normalizeConfig,
  normalizeSiteUrl,
  writeConfig,
} = require('../src/config');

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-config-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('normalizes site URLs', () => {
  assert.equal(normalizeSiteUrl('www.bilibili.com'), 'https://www.bilibili.com/');
  assert.equal(
    normalizeSiteUrl('https://www.bilibili.com/video/BV1?x=1'),
    'https://www.bilibili.com/video/BV1?x=1',
  );
  assert.throws(() => normalizeSiteUrl('ftp://example.com'), /http/);
  assert.throws(() => normalizeSiteUrl(''), /不能为空/);
});

test('applies config defaults and normalizes values', () => {
  const config = normalizeConfig({
    site: {
      url: 'https://www.bilibili.com/',
      name: 'bilibili',
    },
    window: {
      width: '1600',
      height: 1000,
    },
    mods: {
      disabled: [' old-mod ', ''],
    },
  });

  assert.equal(config.formatVersion, 1);
  assert.equal(config.site.name, 'bilibili');
  assert.equal(config.window.width, 1600);
  assert.equal(config.window.height, 1000);
  assert.equal(config.window.minWidth, 800);
  assert.equal(config.mods.watch, true);
  assert.deepEqual(config.mods.disabled, ['old-mod']);
  assert.equal(config.devTools, false);
});

test('infers a site name from the hostname', () => {
  const config = createDefaultConfig('https://www.bilibili.com/');
  assert.equal(config.site.name, 'bilibili.com');
});

test('rejects invalid config values', () => {
  assert.throws(() => normalizeConfig(null), /JSON 对象/);
  assert.throws(() => normalizeConfig({ site: {} }), /不能为空/);
  assert.throws(
    () =>
      normalizeConfig({
        site: { url: 'https://example.com/' },
        mods: { disabled: 'example' },
      }),
    /字符串数组/,
  );
  assert.throws(
    () =>
      normalizeConfig({
        formatVersion: 99,
        site: { url: 'https://example.com/' },
      }),
    /版本/,
  );
});

test('round-trips config through disk', (t) => {
  const dir = makeTempDir(t);
  const config = createDefaultConfig('https://example.com/', 'Example');
  const file = writeConfig(dir, config);

  assert.equal(path.basename(file), CONFIG_FILENAME);
  assert.deepEqual(loadConfig(dir), config);
});

test('reports missing and malformed config files', (t) => {
  const dir = makeTempDir(t);
  assert.throws(() => loadConfig(dir), /WebLoader install/);

  fs.writeFileSync(path.join(dir, CONFIG_FILENAME), '{ nope', 'utf8');
  assert.throws(() => loadConfig(dir), /无法读取/);
});
