// ==UserScript==
// @name         Hide Whitespace in GitHub Diffs by Default
// @namespace    https://github.com/brendanmorrell/userscripts
// @version      1.0.0
// @description  GitHub only remembers "Hide whitespace changes" on the one PR you toggled it on, so you re-click it on every new PR. This flips the default the other way: every diff opens with whitespace already hidden (?w=1). Click the gear → "Show whitespace" on any page (that sets ?w=0) and this leaves that page alone — it only acts when you haven't chosen.
// @author       brendanmorrell
// @match        https://github.com/*
// @icon         data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='32' fill='%230969da'/><g fill='none' stroke='white' stroke-width='5' stroke-linecap='round'><line x1='16' y1='24' x2='48' y2='24'/><line x1='16' y1='40' x2='40' y2='40'/></g></svg>
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/brendanmorrell/userscripts/main/hide-whitespace-diffs.user.js
// @downloadURL  https://raw.githubusercontent.com/brendanmorrell/userscripts/main/hide-whitespace-diffs.user.js
// ==/UserScript==

(function () {
  'use strict';

  // The pages where `?w=1` actually changes what the server renders: a PR's
  // Files/Changes tab, an individual commit (top-level or inside a PR), and a
  // compare view. Everything else on github.com is ignored.
  const isDiffRoute = () => {
    const p = location.pathname;
    return (
      /\/pull\/\d+\/(files|changes)\b/.test(p) ||
      /\/pull\/\d+\/commits\/[0-9a-f]{7,40}\b/.test(p) ||
      /\/commit\/[0-9a-f]{7,40}\b/.test(p) ||
      /\/compare\//.test(p)
    );
  };

  function ensureHidden() {
    if (!isDiffRoute()) return;
    const url = new URL(location.href);
    // Act ONLY when no choice has been made. If `w` is present at all — `w=1`
    // (already hidden) or `w=0` (you deliberately clicked "Show whitespace" on
    // this page) — respect it and do nothing. A fresh PR carries no `w`, so it
    // opens hidden; your per-page "show" still wins and is never overridden.
    if (url.searchParams.has('w')) return;
    url.searchParams.set('w', '1');
    // replace(), not assign(): don't leave the whitespace-showing URL in history,
    // so Back doesn't bounce you between the two.
    location.replace(url.toString());
  }

  // GitHub soft-navigates (Turbo), so a single document-start run isn't enough —
  // moving Conversation → Files changes the URL with no reload. Hook the history
  // API and popstate to re-check on every in-app navigation.
  const wrap = (name) => {
    const orig = history[name];
    history[name] = function () {
      const ret = orig.apply(this, arguments);
      ensureHidden();
      return ret;
    };
  };
  wrap('pushState');
  wrap('replaceState');
  window.addEventListener('popstate', ensureHidden);

  ensureHidden();
})();
