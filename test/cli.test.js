'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getDocsPath, parseArgs, runCli } = require('../src/cli');

function captureLogs() {
  const logs = [];
  const original = console.log;
  console.log = (...args) => {
    logs.push(args.map((value) => String(value)).join(' '));
  };
  return {
    logs,
    restore: () => {
      console.log = original;
    },
  };
}

test('parses install arguments and flags', () => {
  const parsed = parseArgs(['install', 'https://example.com/', '--force', '--name', 'Demo']);
  assert.deepEqual(parsed.positionals, ['install', 'https://example.com/']);
  assert.equal(parsed.flags.force, true);
  assert.equal(parsed.flags.name, 'Demo');
});

test('parses start flags and equals-style name', () => {
  const parsed = parseArgs(['start', '--devtools', '--name=Demo']);
  assert.deepEqual(parsed.positionals, ['start']);
  assert.equal(parsed.flags.devtools, true);
  assert.equal(parsed.flags.name, 'Demo');
});

test('rejects unknown flags and missing name values', () => {
  assert.throws(() => parseArgs(['list', '--wat']), /未知选项/);
  assert.throws(() => parseArgs(['install', '--name']), /名称参数/);
});

test('ships the mod development tutorial and prints it with docs', async () => {
  const content = fs.readFileSync(getDocsPath(), 'utf8');
  assert.match(content, /WebLoader Mod 开发教程/);
  assert.match(content, /WebLoader\.waitFor/);
  assert.match(content, /WebLoader\.storage/);

  const captured = captureLogs();
  try {
    await runCli(['docs'], { projectDir: process.cwd() });
  } finally {
    captured.restore();
  }

  assert.match(captured.logs.join('\n'), /WebLoader Mod 开发教程/);
});

test('install output points new mod developers to the docs command', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  const captured = captureLogs();
  try {
    await runCli(['install', 'https://www.bilibili.com/'], { projectDir: dir });
  } finally {
    captured.restore();
  }

  const output = captured.logs.join('\n');
  assert.match(output, /安装完成/);
  assert.match(output, /WebLoader docs/);
  assert.match(output, /WebLoader Mod 开发者/);
  assert.equal(fs.existsSync(path.join(dir, 'WebLoader.loader.config.json')), true);
});
