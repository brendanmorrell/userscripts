// Exercises the match rule in mark-test-files-viewed.user.js.
//
// The userscript is a Tampermonkey IIFE with no exports, so rather than keeping a
// second copy of the rules here (which would drift), lift the block between the
// BEGIN-MATCHER / END-MATCHER markers out of the source and run the real
// isTestFile. If someone edits the rules, this test sees it.
//
// Run: node --test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SOURCE = fs.readFileSync(path.join(__dirname, 'mark-test-files-viewed.user.js'), 'utf8');

function loadMatcher() {
  const match = SOURCE.match(/\/\/ BEGIN-MATCHER[\s\S]*?\/\/ END-MATCHER/);
  assert.ok(match, 'could not find the BEGIN-MATCHER block in the userscript source');
  // runInThisContext, not runInNewContext: a new context is a separate realm, so
  // its regexes fail `instanceof RegExp` here. Only ever evaluating our own source.
  // The trailing newline matters — the block ends in a `//` comment.
  const isTestFile = vm.runInThisContext(`(() => {\n${match[0]}\nreturn isTestFile; })()`);
  assert.equal(typeof isTestFile, 'function', 'the matcher block should define isTestFile');
  return isTestFile;
}

// Every entry is a path that really exists in one of the QuickMD repos, unless
// marked otherwise — these are the conventions the button has to cover.
const SHOULD_MATCH = [
  // --- JS/TS: the dotted convention -----------------------------------------
  'src/components/Button.test.tsx',
  'src/hooks/useThing.test.ts',
  'e2e/login.spec.ts',
  'src/utils/date.spec.js',
  'tests/utils/formatAddress.test.ts',
  'src/pages/Calendar/AvailabilityPopUp/AvailabilityPopUp.inperson.test.tsx',
  'src/Redux/reducers/appSlice.ciEnvironment.test.ts',
  'scripts/verify.test.mjs',
  'src/app.e2e-spec.ts',
  'src/components/Button.cy.tsx',
  'SRC/COMPONENTS/BUTTON.TEST.TSX', // the dotted rules are case-insensitive

  // --- JS/TS: test directories ----------------------------------------------
  'src/__tests__/helpers.ts',
  'src/__test__/helpers.ts',
  'onboarding/__mocks__/zustand.ts',
  'packages/api/tests/client.ts',
  'test/setup.ts',
  'apps/web/src/features/billing/__tests__/nested/deep.tsx',
  'src/tests/fixtures/getProviderFixture.ts',
  'src/tests/createTestStore.ts',
  'tests/pages/login.page.ts', // Playwright page objects live under tests/
  'e2e/mocks/video.mock.ts',
  'src/test-utils/renderWithProviders.tsx',
  'src/__snapshots__/Button.test.tsx.snap',
  'src/components/__snapshots__/Card.tsx.snap',

  // --- .NET: the convention that was silently missed ------------------------
  // This is the file from the bug report: the old rules matched neither the
  // `.Tests` project folder nor the `Tests.cs` suffix, so a 222-line diff stayed
  // expanded on every backend PR.
  'Libraries/Domain/Pwrdby.QuickMD.Database.Tests/Repo/TreatmentCenterRepoTests.cs',
  'Libraries/Common/QuickMD.Middleware.Tests/StytchSessionHelperTests.cs',
  'Libraries/Common/QuickMD.Middleware.Tests/ActivityListenerCollection.cs', // no Test in the name; the folder decides
  'Solutions/Pwrdby.QuickMD.Admins.Api.Tests/TestData/VisitTypesOverrideStatusTestData.cs',
  'Solutions/Pwrdby.QuickMD.StartupTests/AssemblyDiscoveryTests.cs', // CamelCase folder, no delimiter
  'Libraries/Common/Pwrdby.QuickMD.TestInfrastructure/NoOpRedisClient.cs',
  'Libraries/Common/Pwrdby.QuickMD.Api.Services.Tests/Pwrdby.QuickMD.Api.Services.Tests.csproj',
  'Libraries/Zendesk/AZendeskTicketHelperTest.cs', // singular Test suffix
  'Foo/Bar.IntegrationTests/OrderFlowTests.cs',
  'src/Api.UnitTests/HandlerSpec.cs',

  // --- other ecosystems ------------------------------------------------------
  'ios/QuickMDTests/QuickMDTests.m',
  'ios/QuickMDTests/Info.plist', // not code, but the folder is a test target
  'pkg/server/handler_test.go',
  'app/models/user_spec.rb',
  'tests/test_client.py',
  'conftest.py',
  'lib/widget_test.dart',
  'src/main/java/com/x/OrderFlowIT.java',
  'features/checkout.feature',

  // --- runner bootstrap ------------------------------------------------------
  'jest.setup.js',
  'vitest.setup.tsx',
  'src/setupTests.ts',
];

const SHOULD_NOT_MATCH = [
  // --- ordinary source ------------------------------------------------------
  'src/components/Button.tsx',
  'src/hooks/useThing.ts',
  'README.md',
  'package.json',
  '.github/workflows/ci.yml',

  // --- "test" hiding inside a word ------------------------------------------
  // Every one of these is a real path from the QuickMD repos.
  'src/latest/index.ts',
  'src/contest.ts',
  'docs/protest-banner.png',
  'src/changelist/Changelist-LATEST.json', // LATEST ends in "test"
  'Libraries/Domain/Pwrdby.QuickMD.Storages/IntakeForms/Storages/IntakeFormTemplateStorage.cs', // "templaTEStorage"
  'Libraries/Domain/Pwrdby.QuickMD.Database/Implementations/DatabaseContext/EntityInspector.cs', // "inSPECtor"
  'src/features/devTools/components/DashboardStateInspector.tsx',
  'src/utils/hasSpecialChar.ts',
  'Libraries/Patients/.../Prescriptions/Models/PrescriptionLatestOrderPatientDataModel.cs',
  // Hypothetical, but they are the exact trap the CamelCase rules are case-sensitive
  // for: a case-insensitive `Tests?\.cs$` swallows every one of these.
  'src/Domain/Latest.cs',
  'src/Domain/latest.cs',
  'src/Domain/Contest.cs',
  'src/Domain/Greatest.java',
  'src/Domain/Manifest.kt',

  // --- production code that talks *about* testing ----------------------------
  // The backend ships a Notifications/TestMessages/ feature, and patient-mobile
  // ships a DevTools screen named ErrorBoundaryTests.tsx. Both are real code.
  'Libraries/Patients.Mobile.Api/Pwrdby.QuickMD.Patients.Mobile.Api.Contracts/Notifications/TestMessages/TestPushNotificationPatientMobileApiInContract.cs',
  'Libraries/Patients/Pwrdby.QuickMD.Patients.Api.Services/DrugScreens/RequestHandlers/OrderDrugScreenTestingKitPatientApiRequestHandler.cs',
  'src/Components/DevTools/screens/ErrorBoundaryTests.tsx',
  'src/features/devTools/components/ChartStateTester.tsx',
  'src/Components/DevTools/components/CrashTestButtons.tsx',
  'src/web/app/test-plans/generate/page.tsx', // release-helper's test-plan feature
  'api-runbooks/src/import/spec-matcher.ts',

  // --- environment config for the deployed "Autotest" environment ------------
  'Configurations/appsettings.Autotest.json',
  'Configurations/appsettings.Test.json',
  'src/env.Autotest.json',
  '.env.test.example',

  // --- CI and build config: changing what runs deserves a look --------------
  '.github/workflows/api_test.yml',
  '.github/workflows/run-unit-tests.yml',
  'Pipelines/deploy_autotest_backend.yml',
  'test.runsettings',
  'test.packages.props',
  'catalog/modules/stytch-patient/test.tf',
  'vitest.config.ts',
  'playwright.config.ts',
  'jest.config.js',

  // --- written specs and docs, not RSpec ------------------------------------
  'api-runbooks/specs/signup.md',
  'infrastructure/specs/GRAFANA_SPEC.md',
  'docs/superpowers/specs/2026-08-10-async-backwards-flow-design.md',
  'docs/TEST-PLAN.md',
  '.claude/skills/fe-pw-test-write/SKILL.md',
  '.claude/skills/fe-pw-test-write/references/data-testid-guide.md',
  '.claude/commands/write-api-test.md',

  // --- database migrations that happen to mention tests ---------------------
  'supabase/migrations/20260227000002_create_regression_tests.sql',
  'Databases/ManualScripts/SetPatientAddressToTestState.sql',
];

test('matches the file paths a reviewer would want auto-collapsed', () => {
  const isTestFile = loadMatcher();
  for (const filePath of SHOULD_MATCH) {
    assert.equal(isTestFile(filePath), true, `expected a test file: ${filePath}`);
  }
});

test('leaves non-test files alone', () => {
  const isTestFile = loadMatcher();
  for (const filePath of SHOULD_NOT_MATCH) {
    assert.equal(isTestFile(filePath), false, `expected NOT a test file: ${filePath}`);
  }
});

test('survives a path GitHub has ellipsis-truncated', () => {
  // GitHub renders the full path in the header link today and only truncates
  // visually via CSS, but the layout has changed before. A leading ellipsis
  // should not stop the basename rule from firing.
  const isTestFile = loadMatcher();
  assert.equal(isTestFile('…in/Pwrdby.QuickMD.Database.Tests/Repo/TreatmentCenterRepoTests.cs'), true);
  assert.equal(isTestFile('…ckMD.Api.Services/Booking/Helpers/BookingAvailabilityApiHelper.cs'), false);
});

test('tolerates junk input', () => {
  const isTestFile = loadMatcher();
  for (const junk of ['', '/', undefined, null, '///']) {
    assert.equal(isTestFile(junk), false, `expected false for ${JSON.stringify(junk)}`);
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
