// Exercises the `__tests__/` directory half of the match rule. Deliberately named
// without `.test.` or `.spec.` so the userscript has to match it on the directory
// alone — that is the pattern this file is here to prove.
//
// Run: node --test '__tests__/*.js'

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const scripts = fs.readdirSync(ROOT).filter((f) => f.endsWith('.user.js'));

test('every userscript compiles', () => {
  assert.ok(scripts.length > 0, 'no *.user.js files found');
  for (const name of scripts) {
    const source = fs.readFileSync(path.join(ROOT, name), 'utf8');
    // Compile only — never run. These touch document/window/GM_* on load.
    assert.doesNotThrow(() => new vm.Script(source, { filename: name }), `${name} has a syntax error`);
  }
});

test('every userscript is a strict-mode IIFE', () => {
  for (const name of scripts) {
    const source = fs.readFileSync(path.join(ROOT, name), 'utf8');
    assert.match(source, /\(function \(\) \{\n\s*'use strict';/, `${name} should wrap its body in a strict IIFE`);
    assert.match(source, /\}\)\(\);\s*$/, `${name} should invoke that IIFE`);
  }
});
