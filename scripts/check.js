'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const directories = ['bin', 'src', 'scripts', 'test'];
const files = [];

for (const directory of directories) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) {
    continue;
  }

  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path.join(absolute, entry.name));
    }
  }
}

files.push(path.join(root, 'package.json'));

let failed = false;

for (const file of files) {
  if (file.endsWith('.json')) {
    try {
      JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      failed = true;
      console.error(`JSON 无效：${path.relative(root, file)} - ${error.message}`);
    }
    continue;
  }

  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    failed = true;
    console.error(result.stderr.trim());
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`语法检查通过：${files.length} 个文件。`);
}
