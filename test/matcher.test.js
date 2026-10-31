'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  compilePattern,
  matchesAny,
  matchesPattern,
  siteUrlToMatchPattern,
  validatePatterns,
} = require('../src/matcher');

test('matches exact and wildcard hosts', () => {
  const pattern = 'https://*.bilibili.com/*';
  assert.equal(matchesPattern('https://www.bilibili.com/', pattern), true);
  assert.equal(matchesPattern('https://bilibili.com/video/BV1', pattern), true);
  assert.equal(matchesPattern('https://api.live.bilibili.com/room', pattern), true);
  assert.equal(matchesPattern('https://evilbilibili.com/', pattern), false);
  assert.equal(matchesPattern('https://bilibili.com.evil.test/', pattern), false);
});

test('supports wildcard scheme and all_urls', () => {
  const pattern = '*://example.com/*';
  assert.equal(matchesPattern('http://example.com/', pattern), true);
  assert.equal(matchesPattern('https://example.com/path', pattern), true);
  assert.equal(matchesPattern('file:///C:/page.html', '<all_urls>'), true);
  assert.equal(matchesPattern('ftp://example.com/', '<all_urls>'), false);
});

test('ignores fragments and supports path globs', () => {
  assert.equal(matchesPattern('https://example.com/page#section', 'https://example.com/page'), true);
  assert.equal(matchesPattern('https://example.com/api/items?page=1', 'https://example.com/api/*'), true);
  assert.equal(matchesPattern('https://example.com/other', 'https://example.com/api/*'), false);
  assert.equal(matchesPattern('https://example.com/api/', 'https://example.com/api/*'), true);
});

test('rejects malformed patterns', () => {
  assert.throws(() => compilePattern('example.com/*'), /Invalid URL match pattern/);
  assert.throws(() => compilePattern('https://exa*mple.com/*'), /Invalid host wildcard/);
  assert.equal(matchesPattern('https://example.com/any/path', 'https://example.com'), true);
  assert.throws(() => compilePattern(''), /non-empty string/);
  assert.throws(() => validatePatterns(['https://ok.test/*', 42]), /matches/);
});

test('matchesAny requires at least one pattern', () => {
  assert.equal(matchesAny('https://example.com/', []), false);
  assert.equal(
    matchesAny('https://example.com/', ['https://other.test/*', 'https://example.com/*']),
    true,
  );
});

test('builds a site match pattern from any URL', () => {
  assert.equal(
    siteUrlToMatchPattern('https://www.bilibili.com/video/BV1?x=1#top'),
    'https://www.bilibili.com/*',
  );
  assert.equal(
    siteUrlToMatchPattern('http://localhost:3000/app'),
    'http://localhost:3000/*',
  );
});
