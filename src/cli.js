'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const packageJson = require('../package.json');
const { CONFIG_FILENAME, getConfigPath, loadConfig } = require('./config');
const { installSite } = require('./install');
const { discoverMods } = require('./mods');

const useColor = Boolean(process.stdout.isTTY) && !('NO_COLOR' in process.env);
const color = {
  bold: (value) => (useColor ? `\u001b[1m${value}\u001b[0m` : value),
  dim: (value) => (useColor ? `\u001b[2m${value}\u001b[0m` : value),
  cyan: (value) => (useColor ? `\u001b[36m${value}\u001b[0m` : value),
  green: (value) => (useColor ? `\u001b[32m${value}\u001b[0m` : value),
  yellow: (value) => (useColor ? `\u001b[33m${value}\u001b[0m` : value),
  red: (value) => (useColor ? `\u001b[31m${value}\u001b[0m` : value),
};

function printHelp() {
  console.log(`
${color.bold('WebLoader')} ${packageJson.version} - Node.js 网页 Mod 加载器

${color.bold('用法：')}
  WebLoader install <网站地址> [--force] [--name <名称>]
  WebLoader start [--devtools]
  WebLoader list
  WebLoader docs
  WebLoader help
  WebLoader version

${color.bold('命令：')}
  install   在当前目录创建 ${CONFIG_FILENAME} 和 mods/ 目录
  start     启动当前目录配置的网站，并自动注入已启用的 Mod
  list      列出当前目录中的 Mod
  docs      在终端查看 WebLoader Mod 开发教程
  help      显示帮助
  version   显示版本

${color.bold('示例：')}
  WebLoader install https://www.bilibili.com/
  WebLoader start
  WebLoader docs

${color.bold('Mod 结构：')}
  mods/<mod-id>/WebLoader.mod.json   Mod 配置
  mods/<mod-id>/index.js             Mod 入口脚本，可通过 entry 修改

${color.bold('可用选项：')}
  --force      覆盖已存在的 ${CONFIG_FILENAME}
  --name       设置网站显示名称
  --devtools   启动时打开开发者工具
`.trim());
}

function printVersion() {
  console.log(packageJson.version);
}

function getDocsPath() {
  return path.join(__dirname, '..', 'WebLoaderAPI.md');
}

function printDocs() {
  const docsPath = getDocsPath();
  if (!fs.existsSync(docsPath)) {
    throw new Error(`找不到教程文件：${docsPath}`);
  }
  console.log(fs.readFileSync(docsPath, 'utf8').trimEnd());
}

function parseArgs(argv) {
  const positionals = [];
  const flags = {
    force: false,
    devtools: false,
    help: false,
    version: false,
    name: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--force') {
      flags.force = true;
    } else if (arg === '--devtools') {
      flags.devtools = true;
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version' || arg === '-v') {
      flags.version = true;
    } else if (arg === '--name') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) {
        throw new Error('--name 需要一个名称参数。');
      }
      flags.name = value;
      index += 1;
    } else if (arg.startsWith('--name=')) {
      flags.name = arg.slice('--name='.length);
    } else if (arg.startsWith('-')) {
      throw new Error(`未知选项：${arg}`);
    } else {
      positionals.push(arg);
    }
  }

  return { positionals, flags };
}

function printInstallResult(result) {
  console.log(`${color.green('安装完成')} ${result.config.site.name}`);
  console.log(`  网站    ${result.config.site.url}`);
  console.log(`  配置    ${result.configPath}`);
  console.log(`  Mods    ${result.modsDir}`);
  console.log('');
  console.log(`下一步：在 mods/ 中放入 Mod，然后运行 ${color.cyan('WebLoader start')}`);
  console.log(
    '如果你是 WebLoader Mod 开发者或是对 Mod 开发有兴趣，使用 WebLoader docs 来查看教程。',
  );
}

function runInstall(projectDir, positionals, flags) {
  if (positionals.length !== 1) {
    throw new Error('用法：WebLoader install <网站地址>');
  }

  const result = installSite(projectDir, positionals[0], {
    force: flags.force,
    name: flags.name,
  });

  printInstallResult(result);
}

function printMods(projectDir) {
  const config = loadConfig(projectDir);
  const { mods, errors, modsDir } = discoverMods(projectDir, config);
  const enabledCount = mods.filter((mod) => mod.enabled).length;

  console.log(`${color.bold('目标网站')}  ${config.site.name} - ${config.site.url}`);
  console.log(`${color.bold('配置文件')}  ${getConfigPath(projectDir)}`);
  console.log(`${color.bold('Mod 目录')}  ${modsDir}`);
  console.log('');

  if (mods.length === 0) {
    console.log('当前没有安装任何 Mod。');
  } else {
    console.log(`已发现 ${mods.length} 个 Mod（${enabledCount} 个启用）：`);

    for (const mod of mods) {
      const status = mod.enabled ? color.green('[启用]') : color.dim('[禁用]');
      console.log(
        `  ${status} ${color.bold(mod.id)} ${mod.version} by ${mod.author}`,
      );
      console.log(
        `         ${mod.world} / ${mod.runAt}${mod.description ? ` - ${mod.description}` : ''}`,
      );
    }
  }

  if (errors.length > 0) {
    console.log('');
    console.log(color.yellow('发现问题：'));
    for (const error of errors) {
      const relativePath = path.relative(projectDir, error.manifestPath || error.dir);
      console.log(`  ${relativePath}: ${error.message}`);
    }
  }
}

function resolveElectronPath() {
  let electronPath;
  try {
    electronPath = require('electron');
  } catch {
    throw new Error('未安装 Electron，请先在 WebLoader 项目目录运行 npm install。');
  }

  if (typeof electronPath !== 'string' || !fs.existsSync(electronPath)) {
    throw new Error('找不到 Electron 可执行文件，请重新运行 npm install。');
  }

  return electronPath;
}

async function runStart(projectDir, flags) {
  const config = loadConfig(projectDir);
  const modsDir = path.join(projectDir, 'mods');
  fs.mkdirSync(modsDir, { recursive: true });

  const electronPath = resolveElectronPath();
  const appRoot = path.resolve(__dirname, '..');
  const args = [appRoot, `--webloader-project=${projectDir}`];
  if (flags.devtools || config.devTools) {
    args.push('--webloader-devtools');
  }

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;

  console.log(`${color.cyan('WebLoader')} 正在启动 ${config.site.name} ...`);

  const child = spawn(electronPath, args, {
    cwd: projectDir,
    env,
    stdio: 'inherit',
    windowsHide: false,
  });

  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) {
        process.exitCode = 1;
        resolve();
        return;
      }
      process.exitCode = code ?? 0;
      resolve();
    });
  });
}

async function runCli(argv, options = {}) {
  const projectDir = path.resolve(options.projectDir || process.cwd());

  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (error) {
    console.error(color.red(`错误：${error.message}`));
    process.exitCode = 1;
    return;
  }

  if (parsed.flags.version) {
    printVersion();
    return;
  }

  const command = parsed.positionals[0] || 'help';
  const commandArgs = parsed.positionals.slice(1);

  if (parsed.flags.help || command === 'help') {
    printHelp();
    return;
  }

  try {
    if (command === 'install') {
      runInstall(projectDir, commandArgs, parsed.flags);
      return;
    }

    if (command === 'start') {
      if (commandArgs.length > 0) {
        throw new Error('用法：WebLoader start [--devtools]');
      }
      await runStart(projectDir, parsed.flags);
      return;
    }

    if (command === 'list') {
      if (commandArgs.length > 0) {
        throw new Error('用法：WebLoader list');
      }
      printMods(projectDir);
      return;
    }

    if (command === 'docs') {
      if (commandArgs.length > 0) {
        throw new Error('用法：WebLoader docs');
      }
      printDocs();
      return;
    }

    if (command === 'version') {
      printVersion();
      return;
    }

    throw new Error(`未知命令：${command}`);
  } catch (error) {
    console.error(color.red(`错误：${error.message}`));
    process.exitCode = 1;
  }
}

module.exports = {
  getDocsPath,
  parseArgs,
  runCli,
};
