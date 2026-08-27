// ==UserScript==
// @name         Mark Test Files Viewed on GitHub PRs
// @namespace    https://github.com/brendanmorrell/userscripts
// @version      1.1.0
// @description  One button on a PR's "Files changed" tab that marks every test file as viewed (collapsing it) without moving your scroll position. Knows the test conventions of JS/TS, .NET, Java, Go, Python, Ruby, Swift and Dart. Toggle it on and it keeps doing it on every PR you open.
// @author       brendanmorrell
// @match        https://github.com/*/*/pull/*
// @icon         data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%231f883d'/><polyline points='16 33 27 44 48 21' fill='none' stroke='white' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'/></svg>
// @grant        GM_setValue
// @grant        GM_getValue
// @updateURL    https://raw.githubusercontent.com/brendanmorrell/userscripts/main/mark-test-files-viewed.user.js
// @downloadURL  https://raw.githubusercontent.com/brendanmorrell/userscripts/main/mark-test-files-viewed.user.js
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'mark_test_files_viewed_enabled';
  const BTN_ID = 'mark-test-files-viewed-btn';

  // One switch, not two. On = sweep now and on every PR files page from here on.
  // Off = stop sweeping. Turning it off never un-views anything.
  let enabled = GM_getValue(STORAGE_KEY, false);
  let running = false;

  // Files whose click refused to stick twice in a row, keyed by "<pathname>::<file>".
  // Without this, the observer would re-trigger a sweep on the same stuck file forever.
  const givenUp = new Set();

  // --- what counts as a test file -------------------------------------------
  // BEGIN-MATCHER — mark-test-files-viewed.test.js lifts this block verbatim and
  // runs the real isTestFile against it, so keep it self-contained.

  // Extensions that hold executable code. Every rule below is anchored to one of
  // these lists rather than matching a bare word, because the word "test" hides
  // inside plenty of production names: Latest, Contest, Testosterone, and — in
  // this backend — Template + Storage colliding into "templaTEStorage".
  //
  // Data and config formats are deliberately absent. The backend's
  // `appsettings.Test.json` and the frontends' `env.Autotest.json` configure the
  // deployed Autotest *environment*; they are not tests and must stay visible.
  const CODE_EXT =
    '(?:[cm]?[jt]sx?|py|rb|go|rs|java|kt|kts|cs|fs|vb|swift|m|mm|php|scala|groovy|dart|ex|exs|lua|pl|c|cc|cpp|h|hpp|vue|svelte)';

  // Compiled-language extensions only. `FooTests.cs` is the xUnit/JUnit/XCTest
  // convention, but in JS/TS the convention is `.test.`/`.spec.` and a
  // `SomethingTests.tsx` is usually a screen — patient-mobile ships
  // `DevTools/screens/ErrorBoundaryTests.tsx`, which is production code.
  const CAMEL_EXT = '(?:cs|java|kt|kts|swift|m|mm|scala|groovy|vb|fs)';

  // A directory that exists to hold tests. Matched per path segment, so anything
  // nested underneath one counts too.
  const TEST_DIR_PATTERNS = [
    // Dunder convention: __tests__, __mocks__, __snapshots__, __fixtures__.
    /^__(?:tests?|mocks?|snapshots?|fixtures?|stubs?)__$/i,

    // Whole-segment names. `spec`/`specs` is deliberately NOT here: in these
    // repos it means written specifications — backend/api-runbooks/specs/,
    // infrastructure/specs/GRAFANA_SPEC.md — not RSpec.
    /^(?:tests?|testing|e2e|cypress|playwright|mocks?|fixtures?|stubs?|test-?data)$/i,

    // A test token at the END of a delimited segment — the .NET project naming
    // this script kept missing (Pwrdby.QuickMD.Database.Tests), plus e2e-tests/,
    // unit_test/. Anchoring at the end is what keeps a mid-segment token out:
    // `.claude/skills/fe-pw-test-write/` is documentation about writing tests.
    /[.\-_ ](?:tests?|specs?)$/i,

    // Delimited test-support folders: test-utils/, spec_helpers/, test.data/.
    // An allowlist rather than any `test-*`, because release-helper ships a
    // `src/web/app/test-plans/` product feature that is not a test.
    /^(?:test|spec)[.\-_](?:utils?|utilities|helpers?|support|common|data|fixtures?|doubles?|stubs?|setup|lib)$/i,

    // CamelCase project suffix with no delimiter: QuickMDTests,
    // Pwrdby.QuickMD.StartupTests, Foo.IntegrationTests. Case-sensitive, so the
    // lowercase "test" inside Latest/Greatest/Contest cannot reach it.
    /Tests?$/,

    // CamelCase test-support projects. An allowlist rather than /^Test[A-Z]/,
    // because the backend ships a production `Notifications/TestMessages/`
    // folder that a blanket prefix rule would wrongly collapse.
    /(?:^|\.)Test(?:Infrastructure|Utils|Utilities|Helpers|Support|Common|Fixtures|Doubles|Data|Kit|Base|Setup)$/,
  ];

  // A file that is itself a test, judged on its basename alone.
  const TEST_FILE_PATTERNS = [
    // Dotted infix — the JS/TS world: Button.test.tsx, login.spec.ts,
    // app.e2e-spec.ts, Button.cy.tsx, AvailabilityPopUp.inperson.test.tsx.
    new RegExp(`\\.(?:tests?|specs?|e2e|e2e-spec|cy|integration|unit)\\.${CODE_EXT}$`, 'i'),

    // Delimited suffix — Go, Ruby, Dart, Elixir: foo_test.go, user_spec.rb,
    // widget_test.dart, thing-test.js.
    new RegExp(`[-_](?:tests?|specs?)\\.${CODE_EXT}$`, 'i'),

    // pytest / Go prefix. Lowercase and underscore only: `test-results.ts` is a
    // plausible production name in a medical app and `TEST_thing.ts` is a
    // devtools scratch file, but `test_results.py` is always pytest.
    new RegExp(`^test_[^.]*\\.${CODE_EXT}$`),
    /^conftest\.py$/i,

    // The whole stem is the word: test.ts, tests.rb, spec.js.
    new RegExp(`^(?:tests?|specs?)\\.${CODE_EXT}$`, 'i'),

    // xUnit / JUnit / XCTest CamelCase: TreatmentCenterRepoTests.cs,
    // AZendeskTicketHelperTest.cs, QuickMDTests.m, LoginSpec.kt.
    // Case-sensitive for the same reason as the directory rule above.
    new RegExp(`(?:Tests?|Specs?|TestCases?|TestSuite|TestFixture)\\.${CAMEL_EXT}$`),

    // Maven Failsafe integration tests: OrderFlowIT.java.
    /[a-z0-9]IT\.(?:java|kt)$/,

    // Generated Jest/Vitest snapshots — output, never worth reading.
    /\.snap$/i,

    // Cucumber / Gherkin: the .feature file is the test.
    /\.feature$/i,

    // Runner bootstrap that only ever executes inside the test process.
    // Runner *config* (vitest.config, playwright.config, jest.config) is left
    // visible on purpose: it changes what runs, which deserves a look.
    new RegExp(`^(?:jest|vitest|karma|mocha|ava|playwright|cypress)\\.setup\\.${CODE_EXT}$`, 'i'),
    new RegExp(`^(?:setup-?tests?|tests?-?setup)\\.${CODE_EXT}$`, 'i'),
  ];

  const isTestFile = (rawPath) => {
    // GitHub renders the full path in the header link, but strip a leading
    // ellipsis anyway in case a future layout hands us a truncated one.
    const segments = (rawPath || '')
      .replace(/^…+/, '')
      .split('/')
      .filter(Boolean);
    if (!segments.length) return false;
    const name = segments.pop();
    return (
      segments.some((seg) => TEST_DIR_PATTERNS.some((re) => re.test(seg))) ||
      TEST_FILE_PATTERNS.some((re) => re.test(name))
    );
  };

  // END-MATCHER

  // --- reading GitHub's diff list -------------------------------------------

  // The "Files changed" tab is React, and its CSS-module class names carry a
  // hash that rotates on every GitHub deploy (MarkAsViewedButton-module__viewed__k8dzo).
  // So identify the viewed toggle by ARIA, which is stable, and keep the class
  // selector only as a fallback in case the ARIA labels are the thing that changes.
  const VIEWED_LABEL = /^(not\s+)?viewed$/i;

  function viewedButtons() {
    const byAria = [...document.querySelectorAll('button[aria-pressed][aria-label]')].filter((b) =>
      VIEWED_LABEL.test((b.getAttribute('aria-label') || '').trim()),
    );
    if (byAria.length) return byAria;
    return [...document.querySelectorAll('button[class*="MarkAsViewedButton-module"]')];
  }

  // GitHub wraps file paths in LTR/RTL marks so they render correctly in RTL locales.
  // Escaped rather than literal — they are invisible and would not survive an edit.
  const clean = (s) => (s || '').replace(/[\u200e\u200f]/g, '').trim();

  // Walk up from a viewed toggle to the file header that owns it — the nearest
  // ancestor that also holds the "#diff-<sha>" filename link. That header element
  // survives the collapse (only the diff body goes away), which is what makes it
  // usable as a scroll anchor.
  function headerFor(btn) {
    let node = btn.parentElement;
    for (let i = 0; i < 12 && node && node !== document.body; i++) {
      const link = node.querySelector('a[href^="#diff-"]');
      if (link) return { header: node, path: clean(link.textContent) };
      node = node.parentElement;
    }
    return null;
  }

  function files() {
    const out = [];
    for (const btn of viewedButtons()) {
      const found = headerFor(btn);
      if (!found || !found.path) continue;
      out.push({
        path: found.path,
        header: found.header,
        btn,
        viewed: btn.getAttribute('aria-pressed') === 'true',
      });
    }
    return out;
  }

  const scopeKey = (path) => `${location.pathname}::${path}`;

  function pending() {
    return files().filter((f) => isTestFile(f.path) && !f.viewed && !givenUp.has(scopeKey(f.path)));
  }

  // GitHub renamed this tab's route from /files to /changes and still redirects the
  // old one, so accept both rather than betting on which is live.
  const isFilesRoute = () => /^\/[^/]+\/[^/]+\/pull\/\d+\/(files|changes)\b/.test(location.pathname);

  // --- holding scroll still -------------------------------------------------

  // Restoring window.scrollY does not work here: collapsing one file shrank the
  // document by 1210px while the browser moved scrollY by 3531px. The two are
  // unrelated, so pin a real element instead and let scrollY land where it must.
  function pickAnchor(targetPaths) {
    const all = files();
    const safe = all.filter((f) => !targetPaths.has(f.path));
    // Topmost file that is not about to collapse and is not already scrolled past.
    const visible = safe.find((f) => f.header.getBoundingClientRect().bottom > 0);
    const chosen = visible || safe[safe.length - 1] || all[all.length - 1];
    return chosen ? chosen.path : null;
  }

  function headerTop(path) {
    const f = files().find((x) => x.path === path);
    return f ? f.header.getBoundingClientRect().top : null;
  }

  function restoreScroll(anchorPath, savedTop) {
    if (!anchorPath || savedTop == null) return;
    const now = headerTop(anchorPath);
    if (now == null) return;
    const delta = now - savedTop;
    if (Math.abs(delta) < 1) return;
    window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' });
  }

  // --- the sweep ------------------------------------------------------------

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // React swaps the button node out on every mutation, so re-query by path rather
  // than holding a reference — a stale node's aria-pressed never updates.
  async function confirmViewed(path, timeoutMs = 2500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(100);
      const f = files().find((x) => x.path === path);
      if (!f) return true; // entry left the DOM (filtered, paginated) — nothing left to do
      if (f.viewed) return true;
    }
    return false;
  }

  async function sweep() {
    if (running) return;
    const initial = pending();
    if (!initial.length) return;

    running = true;
    render();

    const targetPaths = new Set(initial.map((t) => t.path));
    const anchorPath = pickAnchor(targetPaths);
    const anchorTop = headerTop(anchorPath);
    const attempts = new Map();
    let marked = 0;

    try {
      // Strictly one at a time. Clicking every button in a single tick loses most
      // of the mutations — React re-renders the list between clicks and the queued
      // nodes are detached by the time the event reaches them.
      for (let guard = 0; guard < 500; guard++) {
        const next = pending()[0];
        if (!next) break;

        next.btn.click();
        const ok = await confirmViewed(next.path);

        if (ok) {
          marked++;
        } else {
          const n = (attempts.get(next.path) || 0) + 1;
          attempts.set(next.path, n);
          if (n >= 2) givenUp.add(scopeKey(next.path));
        }

        restoreScroll(anchorPath, anchorTop);
        await sleep(120);
      }
    } finally {
      restoreScroll(anchorPath, anchorTop);
      running = false;
      render();
    }

    const stuck = [...attempts.keys()].filter((p) => givenUp.has(scopeKey(p)));
    console.info(
      `[mark-test-files-viewed] marked ${marked}/${initial.length} test file(s) as viewed` +
        (stuck.length ? ` — gave up on: ${stuck.join(', ')}` : ''),
    );
  }

  // --- button ---------------------------------------------------------------

  const ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;

  let btn = null;
  let badge = null;
  let lastRenderKey = '';

  function createButton() {
    btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.innerHTML = ICON;
    Object.assign(btn.style, {
      position: 'fixed',
      // Sits above the Copilot-hider button, which owns bottom: 24px.
      bottom: '72px',
      right: '24px',
      zIndex: '9999',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      transition: 'background 0.15s, transform 0.1s, opacity 0.15s',
    });

    badge = document.createElement('span');
    Object.assign(badge.style, {
      position: 'absolute',
      top: '-4px',
      right: '-4px',
      minWidth: '18px',
      height: '18px',
      padding: '0 4px',
      boxSizing: 'border-box',
      borderRadius: '9px',
      background: '#cf222e',
      color: '#fff',
      fontSize: '11px',
      fontWeight: '600',
      lineHeight: '18px',
      textAlign: 'center',
      pointerEvents: 'none',
    });
    btn.appendChild(badge);

    btn.addEventListener('click', () => {
      if (running) return;
      enabled = !enabled;
      GM_setValue(STORAGE_KEY, enabled);
      lastRenderKey = '';
      render();
      if (enabled) sweep();
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });

    document.body.appendChild(btn);
  }

  function render() {
    if (!isFilesRoute()) {
      if (btn) {
        btn.remove();
        btn = null;
        badge = null;
        lastRenderKey = '';
      }
      return;
    }

    if (!btn) createButton();

    const count = pending().length;
    const key = `${enabled}|${count}|${running}`;
    if (key === lastRenderKey) return; // keep our own writes from re-triggering the observer
    lastRenderKey = key;

    btn.style.background = enabled ? '#1f883d' : '#57606a';
    btn.style.opacity = running ? '0.6' : '1';
    btn.style.cursor = running ? 'wait' : 'pointer';

    badge.textContent = count > 0 ? String(count) : '';
    badge.style.display = count > 0 && !running ? 'block' : 'none';

    btn.title = running
      ? 'Marking test files as viewed…'
      : enabled
        ? `Auto-marking test files as viewed is ON${count ? ` — ${count} left to mark` : ''}. Click to turn off.`
        : `Auto-marking test files as viewed is OFF${count ? ` — ${count} unviewed test file(s)` : ''}. Click to turn on and mark them now.`;
  }

  // --- lifecycle ------------------------------------------------------------

  // GitHub soft-navigates between the Conversation and Files tabs, so Tampermonkey
  // only ever runs this once. A debounced observer covers route changes, the diff
  // list mounting, and lazily loaded file chunks arriving later.
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      render();
      if (enabled && !running && isFilesRoute()) sweep();
    }, 250);
  }

  function init() {
    schedule();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', schedule);
  }

  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
