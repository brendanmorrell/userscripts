# Userscripts for GitHub PR reviews

Small browser scripts that remove busywork from reviewing pull requests on GitHub.

| Script | What it does |
| --- | --- |
| **[Mark Test Files Viewed](#mark-test-files-viewed)** | Collapses every test file and Storybook stories file in a PR's diff automatically, so you only scroll through the code you actually need to read. |
| **[Hide Copilot Comments](#hide-copilot-comments)** | Hides Copilot's bot review comments so human comments are all that's left. |
| **[Hide Whitespace in Diffs by Default](#hide-whitespace-in-diffs-by-default)** | Opens every PR diff, commit, and compare view with whitespace changes already hidden, so you never click the gear again. |

---

## Mark Test Files Viewed

Open a PR with 40 changed files, 22 of them `.test.ts`, and the diff you care about is buried. GitHub has a per-file **Viewed** checkbox that collapses a file, but you have to click all 22 by hand, on every PR.

This script does it for you. Turn it on once and every PR you open from then on has its test files already collapsed — `__tests__/` directories, `*.test.*`, `*.spec.*`, .NET `*.Tests/` projects, `*_test.go`, `test_*.py`, Storybook `*.stories.*` / `*.story.*` files, and the rest of the conventions listed [below](#what-counts-as-a-test-file). Your scroll position doesn't move while it works, and nothing is hidden: a collapsed file is still one click away, and it's marked viewed on GitHub's side, exactly as if you'd clicked it yourself.

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

The path is split on `/`. If **any directory** in it looks like a test directory, or the **filename** looks like a test file, the file is collapsed.

**Test directories** — any segment matching:

| Rule | Matches |
| --- | --- |
| Dunder dirs | `__tests__/`, `__mocks__/`, `__snapshots__/`, `__fixtures__/`, `__stubs__/` |
| Whole-word dirs | `test/`, `tests/`, `testing/`, `e2e/`, `cypress/`, `playwright/`, `mocks/`, `fixtures/`, `stubs/`, `test-data/` |
| Suffixed dirs | `integration-tests/`, `api_tests/`, `unit.specs/` |
| Test helper dirs | `test-utils/`, `spec_helpers/`, `test.fixtures/` |
| .NET / JVM projects | `Pwrdby.QuickMD.Database.Tests/`, `QuickMDTests/`, `Pwrdby.QuickMD.TestInfrastructure/` |

**Test files** — the filename matching:

| Rule | Matches |
| --- | --- |
| Dotted infix | `Button.test.tsx`, `login.spec.ts`, `checkout.e2e.ts`, `app.e2e-spec.ts`, `nav.cy.js`, `api.integration.ts` |
| Dash / underscore suffix | `handler_test.go`, `widget-test.dart`, `user_spec.rb` |
| pytest | `test_booking.py`, `conftest.py` |
| Bare | `test.ts`, `spec.rb` |
| CamelCase suffix | `TreatmentCenterRepoTests.cs`, `LoginSpec.java`, `AuthTestCase.kt`, `PaymentTestSuite.swift` |
| JUnit / Failsafe integration | `BookingFlowIT.java` |
| Artifacts | `Button.test.tsx.snap`, `checkout.feature` |
| Runner setup | `jest.setup.js`, `vitest.setup.tsx`, `setupTests.ts`, `test-setup.ts` |

Every filename rule is anchored to a source-code extension allowlist, and CamelCase `Tests`/`Spec` is matched **case-sensitively** on compiled-language extensions only. That's what keeps `Latest.cs`, `Greatest.java`, `Manifest.kt`, `IntakeFormTemplateStorage.cs`, and `hasSpecialChar.ts` out of the sweep.

**Deliberately not matched:**

- **Runner config** — `vitest.config.ts`, `jest.config.js`, `playwright.config.ts`, `test.runsettings`. Changing what runs deserves your eyes; changing a setup file mostly doesn't.
- **Written specs** — `specs/GRAFANA_SPEC.md`, `api-runbooks/specs/signup.md`. These are documents, not tests.
- **`.sql`, `.json`, `.yml`, `.tf`** — a migration named `..._create_regression_tests.sql`, `appsettings.Autotest.json`, and CI workflow files are all real changes you need to read.
- **Product code that says "test"** — `test-plans/generate/page.tsx`, `CrashTestButtons.tsx`, `spec-matcher.ts`.

Validated against 12,163 tracked file paths across 16 QuickMD repos: 1,043 matched, zero false positives.

**Known edge case:** a medical-domain directory like `drug-test/` or `LabTests/` would be collapsed, because the rules can't tell it from a test project. No such path exists in any repo today. If one appears, exclude it in `TEST_DIR_PATTERNS`.

Want to change the rules? They live in the `// BEGIN-MATCHER` … `// END-MATCHER` block near the top of the script — `TEST_DIR_PATTERNS`, `TEST_FILE_PATTERNS`, and the `CODE_EXT` / `CAMEL_EXT` extension allowlists. `npm test` runs them against the real match/no-match corpus, so add your case there first. Best done as a PR here so everyone gets it; a local edit in the Tampermonkey editor works too but gets overwritten the next time the script auto-updates.

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
| It didn't catch a test file | Its path doesn't match any rule [above](#what-counts-as-a-test-file). Open an issue with the path — that's a rule worth adding. |
| It collapsed something that isn't a test | Check the [deliberately not matched](#what-counts-as-a-test-file) list first. If it's genuinely wrong, open an issue with the path; nothing is hidden, so unchecking **Viewed** restores it. |
| Very large PR takes a few seconds | Expected. Files are marked one at a time — clicking them all at once loses most of the clicks, because GitHub re-renders the list between clicks. |

---

## Hide Copilot Comments

Also in this repo: [`hide-copilot-comments.user.js`](hide-copilot-comments.user.js). Same setup, same install flow — click [install](https://raw.githubusercontent.com/brendanmorrell/userscripts/main/hide-copilot-comments.user.js) once Tampermonkey is set up. Adds a purple toggle in the bottom-right of any PR that hides Copilot's review comments. On by default, and it auto-updates from this repo the same way.

---

## Hide Whitespace in Diffs by Default

Also in this repo: [`hide-whitespace-diffs.user.js`](hide-whitespace-diffs.user.js). GitHub only remembers **Hide whitespace changes** on the *one* PR you toggled it on — every new PR opens with whitespace back, so you re-click the gear every time. This flips the default: every PR **Files** tab, commit, and compare view opens with `?w=1` already applied. Click [install](https://raw.githubusercontent.com/brendanmorrell/userscripts/main/hide-whitespace-diffs.user.js) once Tampermonkey is set up — no button, no config, it just works and auto-updates.

It only acts when *you* haven't chosen: if you open the gear and click **Show whitespace** on a page (which sets `?w=0`), the script leaves that page alone. A fresh PR carries no `w` at all, so it defaults to hidden again. Note GitHub's one caveat — while whitespace is hidden you can't leave inline comments on the collapsed lines; click **Show whitespace** on that page when you need to.

---

## Development

```bash
npm test
```

Node's built-in test runner. Checks that each userscript compiles, is a strict-mode IIFE, has a well-formed `==UserScript==` block, keeps `@updateURL`/`@downloadURL` in agreement, and has an `@grant` for every `GM_*` function it calls — the failure modes Tampermonkey swallows silently.

The test files also double as fixtures: `mark-test-files-viewed.test.js`, `metadata.spec.js`, and `__tests__/parses.js` are named to exercise the script's match rules, so opening a PR against this repo is itself a live test of the sweep.
