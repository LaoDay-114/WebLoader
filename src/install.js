'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  createDefaultConfig,
  getConfigPath,
  normalizeSiteUrl,
  writeConfig,
} = require('./config');

function installSite(projectDir, siteUrl, options = {}) {
  const configPath = getConfigPath(projectDir);
  const modsDir = path.join(projectDir, 'mods');

  if (fs.existsSync(configPath) && options.force !== true) {
    const error = new Error(
      `当前目录已经安装过 WebLoader（${configPath}）。如需覆盖配置，请添加 --force。`,
    );
    error.code = 'CONFIG_ALREADY_EXISTS';
    throw error;
  }

  const normalizedUrl = normalizeSiteUrl(siteUrl);
  const config = createDefaultConfig(normalizedUrl, options.name);

  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(modsDir, { recursive: true });
  writeConfig(projectDir, config);

  return {
    config,
    configPath,
    modsDir,
  };
}

module.exports = {
  installSite,
};
