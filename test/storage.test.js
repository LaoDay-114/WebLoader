'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ModStorage } = require('../src/storage');

function makeStorage(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-storage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, storage: new ModStorage(dir, 'demo') };
}

test('stores and retrieves JSON values', (t) => {
  const { dir, storage } = makeStorage(t);

  assert.equal(storage.getRaw('missing', 'null'), 'null');
  assert.equal(storage.setRaw('count', '2'), true);
  assert.equal(storage.setRaw('profile', '{"name":"test"}'), true);
  assert.equal(storage.getRaw('count', 'null'), '2');
  assert.deepEqual(JSON.parse(storage.getRaw('profile', 'null')), { name: 'test' });
  assert.equal(fs.existsSync(path.join(dir, 'demo.json')), true);
});

test('persists values across instances', (t) => {
  const { dir, storage } = makeStorage(t);
  storage.setRaw('key', '"value"');

  const reloaded = new ModStorage(dir, 'demo');
  assert.equal(reloaded.getRaw('key', 'null'), '"value"');
});

test('removes keys and clears all data', (t) => {
  const { storage } = makeStorage(t);
  storage.setRaw('a', '1');
  storage.setRaw('b', '2');

  assert.equal(storage.removeRaw('a'), true);
  assert.equal(storage.removeRaw('a'), false);
  assert.equal(storage.getRaw('a', 'null'), 'null');
  assert.equal(storage.getRaw('b', 'null'), '2');

  assert.equal(storage.clear(), true);
  assert.equal(storage.getRaw('b', 'null'), 'null');
});

test('handles invalid input safely', (t) => {
  const { dir } = makeStorage(t);
  assert.throws(() => new ModStorage(dir, '../escape'), /Unsafe/);
  assert.throws(() => new ModStorage(dir, ''), /Unsafe/);

  const storage = new ModStorage(dir, 'valid');
  assert.equal(storage.setRaw('key', '{bad'), false);
  assert.equal(storage.getRaw('key', 'null'), 'null');
});

test('recovers from a corrupt storage file', (t) => {
  const { dir } = makeStorage(t);
  fs.writeFileSync(path.join(dir, 'broken.json'), '{bad', 'utf8');

  const storage = new ModStorage(dir, 'broken');
  assert.equal(storage.getRaw('key', '"fallback"'), '"fallback"');
  storage.setRaw('key', '1');
  assert.equal(storage.getRaw('key', 'null'), '1');
});
