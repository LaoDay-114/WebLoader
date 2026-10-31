'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

class ModStorage {
  constructor(storageDir, modId) {
    if (!SAFE_ID.test(modId)) {
      throw new Error(`Unsafe mod id for storage: ${modId}`);
    }

    this.storageDir = storageDir;
    this.modId = modId;
    this.filePath = path.join(storageDir, `${modId}.json`);
    this.data = null;
  }

  load() {
    if (this.data !== null) {
      return this.data;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.data = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`[WebLoader] 无法读取 Mod 存储 ${this.modId}：${error.message}`);
      }
      this.data = {};
    }

    return this.data;
  }

  persist() {
    fs.mkdirSync(this.storageDir, { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(this.load(), null, 2)}\n`, 'utf8');
    try {
      fs.renameSync(temporaryPath, this.filePath);
    } catch (error) {
      if (error.code !== 'EEXIST' && error.code !== 'EPERM') {
        throw error;
      }
      fs.rmSync(this.filePath, { force: true });
      fs.renameSync(temporaryPath, this.filePath);
    }
  }

  getRaw(key, fallbackJson) {
    const data = this.load();
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      return fallbackJson ?? null;
    }
    return JSON.stringify(data[key]);
  }

  setRaw(key, valueJson) {
    let value;
    try {
      value = JSON.parse(valueJson);
    } catch {
      return false;
    }
    this.load()[key] = value;
    this.persist();
    return true;
  }

  removeRaw(key) {
    const data = this.load();
    if (!Object.prototype.hasOwnProperty.call(data, key)) {
      return false;
    }
    delete data[key];
    this.persist();
    return true;
  }

  clear() {
    this.data = {};
    this.persist();
    return true;
  }
}

module.exports = {
  ModStorage,
};
