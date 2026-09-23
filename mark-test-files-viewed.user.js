// ==UserScript==
// @name         Mark Test Files Viewed on GitHub PRs
// @namespace    https://github.com/brendanmorrell/userscripts
// @version      1.4.0
// @description  One button that collapses every test file (and Storybook stories file) in a GitHub diff without moving your scroll position. On a PR's "Files changed" tab it marks each one Viewed; on compare and commit pages — which have no Viewed checkbox — it collapses them client-side instead. On those classic diffs it also warms up the whole page first, so every test file is collapsed up front and you never have to scroll a file into view to trigger it. Knows the test conventions of JS/TS, .NET, Java, Go, Python, Ruby, Swift and Dart. Toggle it on and it keeps doing it on every diff you open.
// @author       brendanmorrell
// @match        https://github.com/*/*/pull/*
// @match        https://github.com/*/*/compare/*
// @match        https://github.com/*/*/commit/*
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

  // One switch, not two. On = sweep now and on every diff page from here on.
  // Off = stop sweeping. Turning it off never re-expands anything.
  let enabled = GM_getValue(STORAGE_KEY, false);
  let running = false;

  // Files whose collapse refused to stick twice in a row, keyed by "<pathname>::<file>".
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

    // Storybook stories — CSF (Button.stories.tsx) and MDX docs
    // (Card.stories.mdx), plus the older singular Button.story.tsx. A story is a
    // manual/visual artifact, not a diff you read line-by-line. `mdx` is spelled
    // out because it is not one of the executable CODE_EXT.
    new RegExp(`\\.stor(?:ies|y)\\.(?:${CODE_EXT}|mdx)$`, 'i'),

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

  // GitHub wraps file paths in LTR/RTL marks so they render correctly in RTL locales.
  // Escaped rather than literal — they are invisible and would not survive an edit.
  const clean = (s) => (s || '').replace(/[‎‏]/g, '').trim();

  // --- page adapters --------------------------------------------------------
  //
  // Two kinds of GitHub diff page need collapsing, and they collapse a file in
  // completely different ways, so each is its own adapter. Both expose the same
  // shape — list(), collapse(file) — and everything below is written against it.
  //
  //   • A PR's "Files changed" tab is React with a per-file **Viewed** checkbox.
  //     Marking a file viewed collapses it AND persists on GitHub's side, so
  //     "collapse" there means "click Viewed".
  //   • A compare or commit page uses the classic server-rendered diff. There is
  //     no Viewed checkbox, so a file can only be collapsed client-side by
  //     clicking the chevron in its header. Nothing persists — reload and it's
  //     back — which is the inherent limit the button's tooltip is honest about.
  //
  // Each list() entry is { path, header, collapsed }. `header` is the element the
  // scroll anchor pins to: it must survive the collapse (only the diff body goes
  // away), which the file-header does in both layouts.

  // A PR files/changes route. GitHub renamed the route from /files to /changes and
  // still redirects the old one, so accept both rather than betting on which is live.
  const isPrFilesRoute = () => /^\/[^/]+\/[^/]+\/pull\/\d+\/(files|changes)\b/.test(location.pathname);

  // A classic server-rendered diff: a compare view, a standalone commit, or an
  // individual commit opened inside a PR. None of these carry a Viewed checkbox.
  const isClassicDiffRoute = () => {
    const p = location.pathname;
    return (
      /^\/[^/]+\/[^/]+\/compare\//.test(p) ||
      /^\/[^/]+\/[^/]+\/commit\/[0-9a-f]{7,40}\b/.test(p) ||
      /^\/[^/]+\/[^/]+\/pull\/\d+\/commits\/[0-9a-f]{7,40}\b/.test(p)
    );
  };

  const isDiffRoute = () => isPrFilesRoute() || isClassicDiffRoute();

  // ---- adapter: PR "Files changed" (React, Viewed checkbox) ----

  // The Viewed toggle's CSS-module class name carries a hash that rotates on every
  // GitHub deploy (MarkAsViewedButton-module__viewed__k8dzo), so identify it by
  // ARIA, which is stable, and keep the class selector only as a fallback.
  const VIEWED_LABEL = /^(not\s+)?viewed$/i;

  function viewedButtons() {
    const byAria = [...document.querySelectorAll('button[aria-pressed][aria-label]')].filter((b) =>
      VIEWED_LABEL.test((b.getAttribute('aria-label') || '').trim()),
    );
    if (byAria.length) return byAria;
    return [...document.querySelectorAll('button[class*="MarkAsViewedButton-module"]')];
  }

  // Walk up from a viewed toggle to the file header that owns it — the nearest
  // ancestor that also holds the "#diff-<sha>" filename link. That header element
  // survives the collapse (only the diff body goes away), which is what makes it
  // usable as a scroll anchor.
  function headerForViewed(btn) {
    let node = btn.parentElement;
    for (let i = 0; i < 12 && node && node !== document.body; i++) {
      const link = node.querySelector('a[href^="#diff-"]');
      if (link) return { header: node, path: clean(link.textContent) };
      node = node.parentElement;
    }
    return null;
  }

  const prAdapter = {
    // Collapsing here also marks the file Viewed on GitHub's side, so it persists.
    persists: true,
    list() {
      const out = [];
      for (const btn of viewedButtons()) {
        const found = headerForViewed(btn);
        if (!found || !found.path) continue;
        out.push({
          path: found.path,
          header: found.header,
          collapsed: btn.getAttribute('aria-pressed') === 'true',
          _btn: btn,
        });
      }
      return out;
    },
    collapse(file) {
      file._btn.click();
    },
  };

  // ---- adapter: classic diff (compare / commit, no Viewed checkbox) ----
  //
  // Each file is `<div class="file js-file js-details-container Details ...">`.
  // Expanded ⇔ the element carries the `open` class, which tracks 1:1 with the
  // header chevron's aria-expanded (verified live). Clicking the header's
  // `.js-details-target` toggles it. Only the header's own target is touched —
  // some files nest a second `.js-details-target` in the body (a "Load diff"
  // control), so the query is scoped to the header, never the whole file.

  function classicFiles() {
    return [...document.querySelectorAll('.file.js-file')];
  }

  function classicHeader(file) {
    return file.querySelector('.js-file-header') || file.querySelector('.file-header');
  }

  const classicAdapter = {
    // Client-side only — nothing is written back to GitHub. Reload re-expands.
    persists: false,
    list() {
      const out = [];
      for (const file of classicFiles()) {
        const header = classicHeader(file);
        const path = header && clean(header.getAttribute('data-path'));
        if (!header || !path) continue;
        out.push({
          path,
          header,
          collapsed: !file.classList.contains('open'),
          _file: file,
        });
      }
      return out;
    },
    collapse(file) {
      // Toggling only ever collapses here: the sweep hands us expanded files, and
      // a defensive re-check keeps a double-fire from re-expanding one.
      if (!file._file.classList.contains('open')) return;
      const target = classicHeader(file._file).querySelector('button.js-details-target');
      if (target) target.click();
    },
  };

  const adapter = () => (isPrFilesRoute() ? prAdapter : isClassicDiffRoute() ? classicAdapter : null);

  // --- reading GitHub's diff list -------------------------------------------

  function listFiles() {
    const a = adapter();
    return a ? a.list() : [];
  }

  const scopeKey = (path) => `${location.pathname}::${path}`;

  function pending() {
    return listFiles().filter(
      (f) => isTestFile(f.path) && !f.collapsed && !givenUp.has(scopeKey(f.path)),
    );
  }

  // --- holding scroll still -------------------------------------------------

  // Restoring window.scrollY does not work here: collapsing one file shrank the
  // document by 1210px while the browser moved scrollY by 3531px. The two are
  // unrelated, so pin a real element instead and let scrollY land where it must.
  function pickAnchor(targetPaths) {
    const all = listFiles();
    const safe = all.filter((f) => !targetPaths.has(f.path));
    // Topmost file that is not about to collapse and is not already scrolled past.
    const visible = safe.find((f) => f.header.getBoundingClientRect().bottom > 0);
    const chosen = visible || safe[safe.length - 1] || all[all.length - 1];
    return chosen ? chosen.path : null;
  }

  function headerTop(path) {
    const f = listFiles().find((x) => x.path === path);
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

  // React (and the classic Details toggle) swap or re-render the node, so re-query
  // by path rather than holding a reference — a stale node's state never updates.
  async function confirmCollapsed(path, timeoutMs = 2500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(100);
      const f = listFiles().find((x) => x.path === path);
      if (!f) return true; // entry left the DOM (filtered, paginated) — nothing left to do
      if (f.collapsed) return true;
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
      // Strictly one at a time. Collapsing every file in a single tick loses most
      // of the mutations — the list re-renders between clicks and the queued nodes
      // are detached by the time the event reaches them.
      for (let guard = 0; guard < 500; guard++) {
        const next = pending()[0];
        if (!next) break;

        adapter().collapse(next);
        const ok = await confirmCollapsed(next.path);

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
      `[mark-test-files-viewed] collapsed ${marked}/${initial.length} test file(s)` +
        (stuck.length ? ` — gave up on: ${stuck.join(', ')}` : ''),
    );
  }

  // --- warm-up: force every deferred file into the DOM ----------------------
  //
  // A classic diff renders in progressive batches: on load only the first ~25
  // `.file.js-file` nodes exist, and GitHub injects the rest as their spacers
  // scroll into view. A file you haven't scrolled to isn't just collapsed — it
  // isn't in the page yet, so the sweep can't touch it. That is the whole reason
  // the old behaviour looked like "it only runs on the file I scroll to."
  //
  // This walks the document top-to-bottom in viewport steps so every batch mounts,
  // then puts the scroll back. It runs once per page, before the sweep. Nothing is
  // collapsed here — `running` is held true throughout, so the mutation-driven
  // sweep stays parked while the page rearranges; the real sweep runs afterward
  // with all files present. The PR "Files changed" tab is virtualized (it unmounts
  // off-screen rows), so warming it up would be pointless and is skipped.
  const warmedPages = new Set();

  async function warmUp() {
    const de = document.documentElement;
    const startY = window.scrollY;
    const step = Math.max(400, window.innerHeight - 120);
    let y = 0;
    let lastCount = -1;
    let stable = 0;

    // Cap the walk so a pathological page can't scroll forever; the stable-count
    // break ends it as soon as no new files have mounted for a few steps.
    for (let i = 0; i < 200; i++) {
      window.scrollTo(0, y);
      await sleep(90);

      const count = classicFiles().length;
      if (count === lastCount) stable++;
      else {
        stable = 0;
        lastCount = count;
      }

      const bottom = de.scrollHeight - window.innerHeight;
      if (y >= bottom && stable >= 2) break;
      // Re-read scrollHeight every step: it grows as batches inject, so `y` keeps
      // advancing into freshly revealed territory instead of stopping at the old end.
      y = Math.min(y + step, de.scrollHeight);
    }

    window.scrollTo(0, startY);
  }

  // Single entry point for both the observer and the button: warm the page up
  // (classic diffs only, once each) and then sweep.
  async function activate() {
    if (running) return;

    if (isClassicDiffRoute() && !warmedPages.has(location.pathname)) {
      warmedPages.add(location.pathname);
      running = true;
      render();
      try {
        await warmUp();
      } finally {
        running = false;
        render();
      }
    }

    await sweep();
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
      if (enabled) activate();
    });
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });

    document.body.appendChild(btn);
  }

  // "mark viewed" on a PR, plain "collapse" where nothing persists — so the
  // tooltip never promises a Viewed state the page can't actually hold.
  function verb() {
    const a = adapter();
    return a && a.persists ? 'marking test files as viewed' : 'collapsing test files';
  }

  function render() {
    if (!isDiffRoute()) {
      if (btn) {
        btn.remove();
        btn = null;
        badge = null;
        lastRenderKey = '';
      }
      return;
    }

    // Recreate when the node is gone OR has been detached — GitHub's Turbo
    // navigation on compare/commit pages can rip a body-level node out from under
    // us, and a stale `btn` reference is not null, so `!btn` alone misses that.
    if (!btn || !document.body.contains(btn)) {
      createButton();
      lastRenderKey = '';
    }

    const count = pending().length;
    const key = `${enabled}|${count}|${running}|${adapter() === classicAdapter}`;
    if (key === lastRenderKey) return; // keep our own writes from re-triggering the observer
    lastRenderKey = key;

    btn.style.background = enabled ? '#1f883d' : '#57606a';
    btn.style.opacity = running ? '0.6' : '1';
    btn.style.cursor = running ? 'wait' : 'pointer';

    badge.textContent = count > 0 ? String(count) : '';
    badge.style.display = count > 0 && !running ? 'block' : 'none';

    const action = verb();
    btn.title = running
      ? `${action[0].toUpperCase() + action.slice(1)}…`
      : enabled
        ? `Auto-${action} is ON${count ? ` — ${count} left` : ''}. Click to turn off.`
        : `Auto-${action} is OFF${count ? ` — ${count} unviewed test file(s)` : ''}. Click to turn on and do it now.`;
  }

  // --- lifecycle ------------------------------------------------------------

  // GitHub soft-navigates between tabs, so Tampermonkey only ever runs this once.
  // A debounced observer covers route changes, the diff list mounting, and lazily
  // loaded file chunks arriving later.
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      render();
      if (enabled && !running && isDiffRoute()) activate();
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
