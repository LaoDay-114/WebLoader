'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const directories = ['bin', 'src', 'scripts', 'test'];
const files = [];

function collect(directory) {
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }

    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(absolute);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith('.js') || entry.name.endsWith('.json'))
    ) {
      files.push(absolute);
    }
  }
}

for (const directory of directories) {
  collect(path.join(root, directory));
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
