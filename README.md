# Userscripts for GitHub PR reviews

Small browser scripts that remove busywork from reviewing pull requests on GitHub.

| Script | What it does |
| --- | --- |
| **[Mark Test Files Viewed](#mark-test-files-viewed)** | Collapses every test file in a PR's diff automatically, so you only scroll through the code you actually need to read. |
| **[Hide Copilot Comments](#hide-copilot-comments)** | Hides Copilot's bot review comments so human comments are all that's left. |

---

## Mark Test Files Viewed

Open a PR with 40 changed files, 22 of them `.test.ts`, and the diff you care about is buried. GitHub has a per-file **Viewed** checkbox that collapses a file, but you have to click all 22 by hand, on every PR.

This script does it for you. Turn it on once and every PR you open from then on has its test files already collapsed — `__tests__/` directories, `*.test.*`, and `*.spec.*`. Your scroll position doesn't move while it works, and nothing is hidden: a collapsed file is still one click away, and it's marked viewed on GitHub's side, exactly as if you'd clicked it yourself.

**[▶ Click here to install](https://raw.githubusercontent.com/brendanmorrell/userscripts/main/mark-test-files-viewed.user.js)** — but do the two setup steps below first, or that link will just show you a wall of code.

---

## Setup — about 2 minutes, once

### Step 1 — Install Tampermonkey

Userscripts are small snippets of JavaScript that run on specific websites. Your browser can't run them on its own, so you need a manager extension. **Tampermonkey** is the standard one — free, 11 million users, 4.7 stars on the Chrome Web Store.

Install it for your browser:

| Browser | Link |
| --- | --- |
| Chrome | [Chrome Web Store](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) |
| Edge | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd) |
| Firefox | [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) |
| Safari | [Mac App Store](https://apps.apple.com/app/tampermonkey/id1482490089) (paid) |
| Other | [tampermonkey.net](https://www.tampermonkey.net/) |

### Step 2 — Chrome and Edge only: allow user scripts

Chrome ships with the API Tampermonkey needs switched **off**, and it fails silently — the extension installs fine, the script installs fine, and then nothing happens on any page. Flip the switch now and skip the confusion:

- **Chrome 138 or newer** (check at `chrome://version`) — right-click the Tampermonkey icon in your toolbar → **Manage extension** → turn on **Allow User Scripts**.
- **Older Chrome, or any Edge** — go to `chrome://extensions` (or `edge://extensions`) and turn on **Developer mode**, top-right.

If you're not sure which you have, do both. Firefox and Safari need neither.

> Tampermonkey's own banner about this only mentions Developer mode, which is why people on current Chrome get stuck — the toggle they actually need is **Allow User Scripts**. ([Tampermonkey FAQ Q209](https://www.tampermonkey.net/faq.php?locale=en&q=Q209))

### Step 3 — Install the script

Click **[install](https://raw.githubusercontent.com/brendanmorrell/userscripts/main/mark-test-files-viewed.user.js)**. Tampermonkey intercepts the link and opens its own install page showing the source and what it can access. Click **Install**.

<details>
<summary>If you just get a page full of code instead</summary>

Tampermonkey didn't intercept the link. Install it by hand instead:

1. Click the Tampermonkey icon → **Dashboard**
2. **Utilities** tab → **Install from URL**
3. Paste `https://raw.githubusercontent.com/brendanmorrell/userscripts/main/mark-test-files-viewed.user.js`
4. **Install**

</details>

### Step 4 — Turn it on

Open any PR and click its **Files changed** tab. A round grey button appears in the bottom-right corner of the page. Grey means off. **Click it** — it turns green and immediately collapses the test files in that PR.

That's the only click you'll ever make. It stays on across PRs, tabs, and browser restarts.

---

## Using it

The button in the bottom-right corner is the whole interface:

| | |
| --- | --- |
| **Grey** | Off. Click to turn on and sweep the current PR. |
| **Green** | On. Every PR you open gets its test files collapsed. |
| **Red number badge** | How many test files are still expanded. |
| **Dimmed** | Working right now. |

Hover it for the same information in words. It only appears on the **Files changed** tab, since that's the only place it has anything to do.

Turning it **off never un-views anything** — it just stops. Un-collapse a file the normal way, by unchecking GitHub's own **Viewed** box on it.

### What counts as a test file

Three patterns, matched against the file's path:

- a `__tests__/`, `__test__/`, `test/`, or `tests/` directory anywhere in the path
- `.test.` in the filename — `Button.test.tsx`
- `.spec.` in the filename — `login.spec.ts`

Want more — snapshots, fixtures, mocks? Add a regex to `TEST_PATTERNS` near the top of the script. Best done as a PR here so everyone gets it; a local edit in the Tampermonkey editor works too but gets overwritten the next time the script auto-updates.

### Updates

Tampermonkey re-checks this repo on its own schedule and pulls new versions automatically. You don't have to reinstall.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| No button anywhere | Are you on the **Files changed** tab? It's hidden everywhere else. Then check Tampermonkey's icon shows the script as enabled for the page. |
| Button is there, clicking does nothing | Chrome without the **Allow User Scripts** toggle — see [Step 2](#step-2--chrome-and-edge-only-allow-user-scripts). |
| Script installed but the page looks untouched | Hard-refresh the PR. Tampermonkey only injects on a real page load, and GitHub's tab switches aren't one. |
| A few test files stayed expanded | Some diffs refuse the click; the script retries twice, then leaves that file alone rather than looping forever. Open DevTools console and look for `[mark-test-files-viewed]` — it logs what it marked and what it gave up on. Marking those by hand is safe. |
| It didn't catch a test file | Its path doesn't match the three patterns above. |
| Very large PR takes a few seconds | Expected. Files are marked one at a time — clicking them all at once loses most of the clicks, because GitHub re-renders the list between clicks. |

---

## Hide Copilot Comments

Also in this repo: [`hide-copilot-comments.user.js`](hide-copilot-comments.user.js). Same setup, same install flow — click [install](https://raw.githubusercontent.com/brendanmorrell/userscripts/main/hide-copilot-comments.user.js) once Tampermonkey is set up. Adds a purple toggle in the bottom-right of any PR that hides Copilot's review comments. On by default, and it auto-updates from this repo the same way.

---

## Development

```bash
npm test
```

Node's built-in test runner. Checks that each userscript compiles, is a strict-mode IIFE, has a well-formed `==UserScript==` block, keeps `@updateURL`/`@downloadURL` in agreement, and has an `@grant` for every `GM_*` function it calls — the failure modes Tampermonkey swallows silently.

The test files also double as fixtures: `mark-test-files-viewed.test.js`, `metadata.spec.js`, and `__tests__/parses.js` are named to exercise all three of the script's match patterns, so opening a PR against this repo is itself a live test of the sweep.
