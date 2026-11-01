'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getDocsPath, parseArgs, runCli } = require('../src/cli');
const { loadConfig } = require('../src/config');
const { MANIFEST_FILENAME } = require('../src/mods');

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
  assert.match(content, /WebLoader\.getMods/);
  assert.match(content, /WebLoader\.setModEnabled/);
  assert.match(content, /WebLoader create/);
  assert.match(content, /WebLoaderManager/);

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
  assert.match(output, /PageToolkit/);
  assert.match(output, /默认关闭/);
  assert.equal(fs.existsSync(path.join(dir, 'WebLoader.loader.config.json')), true);
});

async function runCaptured(args, projectDir) {
  const captured = captureLogs();
  try {
    await runCli(args, { projectDir });
  } finally {
    captured.restore();
  }
  return captured.logs.join('\n');
}

test('parses create id flags', () => {
  const parsed = parseArgs(['create', 'Demo Mod', '--id', 'demo']);
  assert.deepEqual(parsed.positionals, ['create', 'Demo Mod']);
  assert.equal(parsed.flags.id, 'demo');
  assert.equal(parseArgs(['create', 'Demo', '--id=demo-2']).flags.id, 'demo-2');
  assert.throws(() => parseArgs(['create', 'Demo', '--id']), /Mod ID 参数/);
});

test('creates, disables, and enables a mod through the CLI', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  await runCaptured(['install', 'https://www.bilibili.com/'], dir);
  const createOutput = await runCaptured(['create', 'Hello World'], dir);
  assert.match(createOutput, /已创建 Mod/);
  assert.match(createOutput, /hello-world/);

  const manifestPath = path.join(
    dir,
    'mods',
    'hello-world',
    MANIFEST_FILENAME,
  );
  assert.equal(fs.existsSync(manifestPath), true);
  assert.equal(
    JSON.parse(fs.readFileSync(manifestPath, 'utf8')).enabled,
    true,
  );

  const disableOutput = await runCaptured(['disable', 'hello-world'], dir);
  assert.match(disableOutput, /已禁用/);
  assert.deepEqual(loadConfig(dir).mods.disabled, ['hello-world']);
  assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).enabled, false);

  const enableOutput = await runCaptured(['enable', 'hello-world'], dir);
  assert.match(enableOutput, /已启用/);
  assert.deepEqual(loadConfig(dir).mods.disabled, []);
  assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).enabled, true);

  const noChangeOutput = await runCaptured(['enable', 'hello-world'], dir);
  assert.match(noChangeOutput, /无变化/);
  assert.match(noChangeOutput, /已经是启用状态/);
});

test('lists the built-in manager and default-off PageToolkit', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webloader-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

  await runCaptured(['install', 'https://example.com/'], dir);
  const output = await runCaptured(['list'], dir);
  assert.match(output, /WebLoaderManager/);
  assert.match(output, /\[禁用\].*page-toolkit/);
  assert.match(output, /\[内置\]/);
});
