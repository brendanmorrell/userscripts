// Exercises the `.spec.` half of the match rule, and checks the thing that actually
// breaks in practice: a malformed ==UserScript== block. Tampermonkey fails quietly on
// those — a missing @grant means GM_getValue is undefined and the script dies on load.
//
// Run: node --test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scripts = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith('.user.js'))
  .map((f) => ({ name: f, source: fs.readFileSync(path.join(__dirname, f), 'utf8') }));

function metadata(source) {
  const block = source.match(/\/\/ ==UserScript==\n([\s\S]*?)\n\/\/ ==\/UserScript==/);
  assert.ok(block, 'missing ==UserScript== metadata block');
  const entries = {};
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\/\/ @(\S+)\s+(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    (entries[key] ||= []).push(value.trim());
  }
  return entries;
}

test('every userscript has a well-formed metadata block', () => {
  assert.ok(scripts.length > 0, 'no *.user.js files found');

  for (const { name, source } of scripts) {
    const meta = metadata(source);
    for (const key of ['name', 'namespace', 'version', 'description', 'match', 'grant']) {
      assert.ok(meta[key]?.length, `${name}: missing @${key}`);
    }
    assert.match(meta.version[0], /^\d+\.\d+\.\d+$/, `${name}: @version should be semver`);
    assert.equal(meta.namespace[0], 'https://github.com/brendanmorrell/userscripts', `${name}: unexpected @namespace`);
  }
});

test('self-update URLs, when present, agree with each other', () => {
  for (const { name, source } of scripts) {
    const meta = metadata(source);
    if (!meta.updateURL && !meta.downloadURL) continue; // opting out of self-update is fine

    assert.ok(meta.updateURL?.length, `${name}: has @downloadURL but no @updateURL`);
    assert.ok(meta.downloadURL?.length, `${name}: has @updateURL but no @downloadURL`);
    assert.equal(meta.updateURL[0], meta.downloadURL[0], `${name}: @updateURL and @downloadURL disagree`);
    assert.match(
      meta.updateURL[0],
      /^https:\/\/raw\.githubusercontent\.com\/brendanmorrell\/userscripts\/main\/.+\.user\.js$/,
      `${name}: self-update URL should be the raw file on main`,
    );
    assert.ok(
      meta.updateURL[0].endsWith(`/${name}`),
      `${name}: self-update URL points at a different file (${meta.updateURL[0]})`,
    );
  }
});

test('every GM_* call is backed by a matching @grant', () => {
  for (const { name, source } of scripts) {
    const granted = new Set(metadata(source).grant || []);
    const used = new Set(source.match(/\bGM_[A-Za-z]+/g) || []);
    for (const fn of used) {
      // The metadata block itself contains the @grant lines; only care about the body.
      assert.ok(granted.has(fn), `${name}: calls ${fn} without an @grant for it`);
    }
  }
});
