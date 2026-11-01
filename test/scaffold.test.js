'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createMod, deriveModId } = require('../src/scaffold');
const { MANIFEST_FILENAME } = require('../src/mods');

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-create-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('derives safe ids from mod names', () => {
  assert.equal(deriveModId('Hello World!'), 'hello-world');
  assert.equal(deriveModId('Café Mod'), 'cafe-mod');
  assert.match(deriveModId('我的模组'), /^mod-[0-9a-f]{8}$/);
  assert.match(deriveModId('我的第一个Mod'), /^mod-[0-9a-f]{8}$/);
  assert.match(deriveModId('  --  '), /^mod-[0-9a-f]{8}$/);
  assert.ok(deriveModId('a'.repeat(100)).length <= 64);
});

test('creates a runnable mod template', (t) => {
  const dir = makeTempDir(t);
  const result = createMod(dir, 'Hello World');

  assert.equal(result.id, 'hello-world');
  assert.equal(result.name, 'Hello World');
  assert.equal(fs.existsSync(result.manifestPath), true);
  assert.equal(fs.existsSync(result.entryPath), true);

  const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf8'));
  assert.equal(manifest.id, 'hello-world');
  assert.equal(manifest.name, 'Hello World');
  assert.equal(manifest.entry, 'index.js');
  assert.deepEqual(manifest.matches, []);
  assert.equal(manifest.enabled, true);

  const source = fs.readFileSync(result.entryPath, 'utf8');
  assert.match(source, /WebLoader\.onReady/);
  assert.match(source, /WebLoader\.log/);
});

test('supports an explicit id', (t) => {
  const dir = makeTempDir(t);
  const result = createMod(dir, '演示 Mod', { id: 'demo-mod' });
  assert.equal(result.id, 'demo-mod');
  assert.equal(path.basename(result.dir), 'demo-mod');
});

test('rejects duplicate, empty, invalid, and reserved ids', (t) => {
  const dir = makeTempDir(t);
  createMod(dir, 'Hello');

  assert.throws(() => createMod(dir, 'Hello'), /已经存在/);
  assert.throws(() => createMod(dir, '   '), /不能为空/);
  assert.throws(() => createMod(dir, 'Bad', { id: '../escape' }), /无效的 Mod ID/);
  assert.throws(
    () => createMod(dir, 'Manager', { id: 'WebLoaderManager' }),
    /内置 Mod/,
  );
  assert.throws(
    () => createMod(dir, 'Manager', { id: 'webloadermanager' }),
    /内置 Mod/,
  );
  assert.throws(
    () => createMod(dir, 'Toolkit', { id: 'page-toolkit' }),
    /内置 Mod/,
  );
  assert.throws(
    () => createMod(dir, 'Toolkit', { id: 'PageToolkit' }),
    /内置 Mod/,
  );
});
