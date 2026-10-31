'use strict';

const ALL_URLS = '<all_urls>';
const SUPPORTED_SCHEMES = new Set(['http', 'https', 'ws', 'wss', 'file']);

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(glob) {
  return glob
    .split('*')
    .map(escapeRegExp)
    .join('.*');
}

function compilePattern(pattern) {
  if (typeof pattern !== 'string' || pattern.trim() === '') {
    throw new TypeError('URL match pattern must be a non-empty string');
  }

  const value = pattern.trim();

  if (value.toLowerCase() === ALL_URLS) {
    return {
      pattern: value,
      regexp: /^(?:https?|wss?|file):\/\//i,
    };
  }

  const parsed = /^(\*|https?|wss?|file):\/\/([^/]*)(\/.*)?$/i.exec(value);
  if (!parsed) {
    throw new TypeError(`Invalid URL match pattern: ${value}`);
  }

  const rawScheme = parsed[1].toLowerCase();
  if (rawScheme !== '*' && !SUPPORTED_SCHEMES.has(rawScheme)) {
    throw new TypeError(`Unsupported URL scheme in match pattern: ${value}`);
  }

  const schemes = rawScheme === '*' ? ['http', 'https'] : [rawScheme];
  const rawHost = parsed[2];
  const rawPath = parsed[3] || '/*';

  if (rawHost === '' && rawScheme !== 'file') {
    throw new TypeError(`Missing host in URL match pattern: ${value}`);
  }

  let hostPattern;
  if (rawHost === '') {
    hostPattern = '';
  } else if (rawHost === '*') {
    hostPattern = '[^/]+';
  } else if (rawHost.startsWith('*.')) {
    const base = rawHost.slice(2);
    if (base.includes('*') || base === '') {
      throw new TypeError(`Invalid host wildcard in URL match pattern: ${value}`);
    }
    hostPattern = `(?:[^/]+\\.)?${escapeRegExp(base)}`;
  } else {
    if (rawHost.includes('*')) {
      throw new TypeError(`Invalid host wildcard in URL match pattern: ${value}`);
    }
    hostPattern = escapeRegExp(rawHost);
  }

  if (!rawPath.startsWith('/')) {
    throw new TypeError(`Path must start with "/" in URL match pattern: ${value}`);
  }

  const schemePattern = schemes.length === 1 ? schemes[0] : `(?:${schemes.join('|')})`;
  const regexp = new RegExp(
    `^${schemePattern}://${hostPattern}${globToRegExp(rawPath)}$`,
    'i',
  );

  return { pattern: value, regexp };
}

function matchesPattern(url, pattern) {
  if (typeof url !== 'string') {
    return false;
  }

  let candidate;
  try {
    candidate = new URL(url);
  } catch {
    return false;
  }

  const hashlessUrl = `${candidate.protocol}//${candidate.host}${candidate.pathname}${candidate.search}`;
  return compilePattern(pattern).regexp.test(hashlessUrl);
}

function matchesAny(url, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => matchesPattern(url, pattern));
}

function siteUrlToMatchPattern(siteUrl) {
  const url = new URL(siteUrl);
  return `${url.protocol}//${url.host}/*`;
}

function validatePatterns(patterns, fieldName = 'matches') {
  if (patterns === undefined) {
    return [];
  }
  if (!Array.isArray(patterns) || patterns.some((item) => typeof item !== 'string')) {
    throw new TypeError(`${fieldName} must be an array of match pattern strings`);
  }
  patterns.forEach((pattern) => compilePattern(pattern));
  return patterns;
}

module.exports = {
  ALL_URLS,
  compilePattern,
  matchesAny,
  matchesPattern,
  siteUrlToMatchPattern,
  validatePatterns,
};
