// Exercises the `.test.` half of the match rule in mark-test-files-viewed.user.js.
//
// The userscript is a Tampermonkey IIFE with no exports, so rather than keeping a
// second copy of the patterns here (which would drift), pull the real array out of
// the source and evaluate it. If someone edits TEST_PATTERNS, this test sees it.
//
// Run: node --test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, 'mark-test-files-viewed.user.js'), 'utf8');

function loadPatterns() {
  const match = SOURCE.match(/const TEST_PATTERNS = \[([\s\S]*?)\];/);
  assert.ok(match, 'could not find TEST_PATTERNS in the userscript source');
  // runInThisContext, not runInNewContext: a new context is a separate realm, so its
  // regexes fail `instanceof RegExp` here. Only ever evaluating our own source.
  const patterns = vm.runInThisContext(`[${match[1]}]`);
  assert.ok(
    patterns.length > 0 && patterns.every((re) => re instanceof RegExp),
    'TEST_PATTERNS should be a non-empty array of regexes',
  );
  return patterns;
}

const isTestFile = (patterns, filePath) => patterns.some((re) => re.test(filePath));

const SHOULD_MATCH = [
  'src/components/Button.test.tsx',
  'src/hooks/useThing.test.ts',
  'e2e/login.spec.ts',
  'src/utils/date.spec.js',
  'src/__tests__/helpers.ts',
  'src/__test__/helpers.ts',
  'packages/api/tests/client.ts',
  'test/setup.ts',
  'apps/web/src/features/billing/__tests__/nested/deep.tsx',
  'SRC/COMPONENTS/BUTTON.TEST.TSX', // patterns are case-insensitive
];

const SHOULD_NOT_MATCH = [
  'src/components/Button.tsx',
  'src/hooks/useThing.ts',
  'README.md',
  'package.json',
  'src/testing/utils.ts', // "testing/" is not "test/" or "tests/"
  'src/latest/index.ts', // contains "test" but not as a path segment
  'src/contest.ts',
  'docs/protest-banner.png',
  '.github/workflows/ci.yml',
];

test('matches the file paths a reviewer would want auto-collapsed', () => {
  const patterns = loadPatterns();
  for (const filePath of SHOULD_MATCH) {
    assert.equal(isTestFile(patterns, filePath), true, `expected a test file: ${filePath}`);
  }
});

test('leaves non-test files alone', () => {
  const patterns = loadPatterns();
  for (const filePath of SHOULD_NOT_MATCH) {
    assert.equal(isTestFile(patterns, filePath), false, `expected NOT a test file: ${filePath}`);
  }
});

test('accepts both the /files and /changes PR routes', () => {
  // GitHub renamed the Files-changed tab from /pull/N/files to /pull/N/changes and
  // still 301s the old path, so the route check has to accept both. Getting this
  // wrong is silent — the button simply never renders.
  const match = SOURCE.match(/const isFilesRoute = \(\) => (\/.*?\/)\.test\(location\.pathname\);/);
  assert.ok(match, 'could not find isFilesRoute in the userscript source');
  const route = vm.runInThisContext(match[1]);

  assert.equal(route.test('/QuickMD-LLC/provider/pull/364/files'), true);
  assert.equal(route.test('/QuickMD-LLC/provider/pull/364/changes'), true);
  assert.equal(route.test('/QuickMD-LLC/provider/pull/364'), false);
  assert.equal(route.test('/QuickMD-LLC/provider/pull/364/commits'), false);
});
