'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { MANIFEST_FILENAME, validateModId } = require('./mods');
const { isBuiltinIdentifier } = require('./builtin-mods');

function deriveModId(name) {
  const normalized = String(name)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const hasNonAscii = /[^\x00-\x7f]/.test(normalized);
  const hash = crypto.createHash('sha1').update(String(name)).digest('hex').slice(0, 8);
  let id = normalized
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');

  if (!id) {
    return `mod-${hash}`;
  }

  if (hasNonAscii) {
    id = `${id.slice(0, 55).replace(/-+$/g, '')}-${hash}`;
  }

  return id;
}

function buildEntrySource(name) {
  const safeName = String(name).replace(/[\r\n\u2028\u2029]+/g, ' ');
  return [
    `// ${safeName}`,
    '// 这个文件由 WebLoader create 生成，可以自由修改。',
    '// 完整 API 请运行 WebLoader docs 查看。',
    '',
    "WebLoader.log(WebLoader.mod.name + ' 已加载', WebLoader.url);",
    '',
    'WebLoader.onReady(function () {',
    "  const badge = document.createElement('div');",
    '  badge.textContent = WebLoader.mod.name;',
    "  badge.dataset.webloaderMod = WebLoader.mod.id;",
    "  badge.title = '这个提示来自 WebLoader Mod：' + WebLoader.mod.id;",
    '  Object.assign(badge.style, {',
    "    position: 'fixed',",
    "    right: '16px',",
    "    bottom: '16px',",
    "    zIndex: '2147483647',",
    "    padding: '8px 12px',",
    "    borderRadius: '10px',",
    "    background: '#101114',",
    "    color: '#f5f5f5',",
    "    border: '1px solid rgba(255, 255, 255, 0.16)',",
    "    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',",
    "    font: '13px/1.4 system-ui, sans-serif',",
    "    pointerEvents: 'none',",
    '  });',
    '  document.body.appendChild(badge);',
    '});',
    '',
  ].join('\n');
}

function createMod(projectDir, name, options = {}) {
  const displayName = typeof name === 'string' ? name.trim() : '';
  if (!displayName) {
    throw new Error('Mod 名字不能为空。');
  }

  const id =
    options.id !== undefined && options.id !== null
      ? validateModId(String(options.id))
      : validateModId(deriveModId(displayName));

  if (isBuiltinIdentifier(id)) {
    throw new Error(`${id} 是 WebLoader 内置 Mod 的保留名称，请换一个 ID。`);
  }

  const modsDir = path.join(projectDir, 'mods');
  const modDir = path.join(modsDir, id);
  const manifestPath = path.join(modDir, MANIFEST_FILENAME);
  const entryPath = path.join(modDir, 'index.js');

  if (fs.existsSync(modDir)) {
    throw new Error(`Mod 目录已经存在：${modDir}`);
  }

  const manifest = {
    id,
    name: displayName,
    version: '1.0.0',
    author: options.author || 'your-name',
    description: '使用 WebLoader create 创建的 Mod。',
    entry: 'index.js',
    matches: [],
    excludeMatches: [],
    runAt: 'document-end',
    world: 'page',
    priority: 0,
    enabled: true,
  };

  fs.mkdirSync(modsDir, { recursive: true });
  fs.mkdirSync(modDir);

  try {
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    fs.writeFileSync(entryPath, buildEntrySource(displayName), 'utf8');
  } catch (error) {
    fs.rmSync(modDir, { recursive: true, force: true });
    throw error;
  }

  return {
    id,
    name: displayName,
    dir: modDir,
    manifestPath,
    entryPath,
  };
}

module.exports = {
  buildEntrySource,
  createMod,
  deriveModId,
};
