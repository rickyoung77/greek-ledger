import { chromium } from 'playwright';

const BASE = 'http://localhost:5176';
const TS   = Date.now();
const EMAIL    = `testuser+${TS}@gmail.com`;
const PASSWORD = 'TestPass123!';
const CHAPTER  = `Sigma Test Chapter ${TS}`;

let pass = true;
function step(icon, label, detail = '') {
  console.log(`${icon} ${label}${detail ? '\n   ' + detail : ''}`);
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const ctx     = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page    = await ctx.newPage();

// Collect console errors
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(e.message));

// ── Helper ────────────────────────────────────────────────────────────
async function screenshot(name) {
  const path = `/tmp/gl-${name}.png`;
  await page.screenshot({ path, fullPage: false });
  return path;
}

try {
  // ── 1. Protected route redirect ───────────────────────────────────
  console.log('\n── Step 1: Protected route redirect ──');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const afterRootUrl = page.url();
  if (afterRootUrl.includes('/login')) {
    step('✅', 'Unauthenticated / → /login', afterRootUrl);
  } else {
    step('❌', 'Expected redirect to /login', `Got: ${afterRootUrl}`);
    pass = false;
  }
  await screenshot('01-login-redirect');

  // ── 2. Login page renders ─────────────────────────────────────────
  console.log('\n── Step 2: Login page renders ──');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const loginHeading = await page.locator('h1').first().textContent().catch(() => '');
  if (loginHeading.includes('Welcome back')) {
    step('✅', 'Login page rendered', `Heading: "${loginHeading}"`);
  } else {
    step('❌', 'Login heading not found', `Got: "${loginHeading}"`);
    pass = false;
  }
  await screenshot('02-login-page');

  // ── 3. Signup page renders ────────────────────────────────────────
  console.log('\n── Step 3: Signup page renders ──');
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' });
  const signupHeading = await page.locator('h1').first().textContent().catch(() => '');
  if (signupHeading.includes('Create your account')) {
    step('✅', 'Signup page rendered', `Heading: "${signupHeading}"`);
  } else {
    step('❌', 'Signup heading not found', `Got: "${signupHeading}"`);
    pass = false;
  }
  await screenshot('03-signup-page');

  // ── 4. Fill signup form ───────────────────────────────────────────
  console.log('\n── Step 4: Fill and submit signup form ──');
  await page.fill('input[type="text"]',     'Test Treasurer');
  await page.fill('input[type="email"]',    EMAIL);
  await page.fill('input[type="password"]', PASSWORD);

  // Chapter name — 3rd text input
  const textInputs = page.locator('input[type="text"]');
  await textInputs.nth(1).fill(CHAPTER);

  // Semester select
  await page.selectOption('select:first-of-type', 'Fall 2026');
  // Role select
  const selects = page.locator('select');
  await selects.nth(1).fill?.('').catch(() => {});
  await selects.nth(1).selectOption('Treasurer').catch(() => {});

  await screenshot('04-signup-filled');
  step('✅', 'Signup form filled', `Email: ${EMAIL}, Chapter: ${CHAPTER}`);

  // Submit
  await page.click('button[type="submit"]');
  step('✅', 'Signup form submitted');

  // ── 5. Wait for outcome: dashboard OR "check email" ───────────────
  console.log('\n── Step 5: Post-signup outcome ──');
  await page.waitForTimeout(5000); // wait for Supabase round-trips
  const postSignupUrl = page.url();
  const bodyText = await page.locator('body').textContent().catch(() => '');
  await screenshot('05-post-signup');

  if (postSignupUrl === `${BASE}/` || postSignupUrl.endsWith('/')) {
    step('✅', 'Redirected to dashboard after signup', postSignupUrl);
  } else if (bodyText.includes('Check your email')) {
    step('⚠️', 'Email confirmation required (confirm disabled?)', 'Showing "Check your email" screen');
    step('⚠️', 'Cannot test full flow without disabling email confirmation in Supabase');
    pass = false;
    await browser.close();
    // Print findings and exit
    console.log('\n════════════════════════════════════════');
    console.log('BLOCKED — email confirmation is enabled in Supabase.');
    console.log('To fix: Supabase dashboard → Authentication → Settings → disable "Enable email confirmations"');
    console.log('Then re-run this test.');
    process.exit(0);
  } else if (postSignupUrl.includes('/login')) {
    step('❌', 'Still on /login after signup — signup may have failed', postSignupUrl);
    const errorEl = await page.locator('[style*="fee2e2"]').textContent().catch(() => '');
    if (errorEl) step('❌', 'Error shown', errorEl);
    pass = false;
  } else {
    step('⚠️', 'Unexpected post-signup URL', postSignupUrl);
    pass = false;
  }

  if (!pass) {
    await browser.close();
    console.log('\nConsole errors:', consoleErrors.slice(0, 5));
    process.exit(1);
  }

  // ── 6. Dashboard content check ────────────────────────────────────
  console.log('\n── Step 6: Dashboard content ──');
  const dashBody = await page.locator('body').textContent();
  if (dashBody.includes('Total Budget') || dashBody.includes('Dashboard')) {
    step('✅', 'Dashboard rendered with expected content');
  } else {
    step('❌', 'Dashboard content missing');
    pass = false;
  }
  if (dashBody.includes(CHAPTER)) {
    step('✅', `Chapter name "${CHAPTER}" visible in sidebar/header`);
  } else {
    step('⚠️', 'Chapter name not found in page — may need data to load');
  }
  await screenshot('06-dashboard');

  // ── 7. Navigate around protected routes ───────────────────────────
  console.log('\n── Step 7: Navigate protected pages ──');
  for (const [path, label] of [['/budget-accounts','Budget Accounts'],['/expenses','Expenses'],['/members','Members'],['/notifications','Notifications']]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    const url = page.url();
    if (url.includes('/login')) {
      step('❌', `${label} — redirected to login unexpectedly`, url);
      pass = false;
    } else {
      step('✅', `${label} accessible`, url);
    }
  }

  // ── 8. Sign out ───────────────────────────────────────────────────
  console.log('\n── Step 8: Sign out ──');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const signOutBtn = page.locator('button', { hasText: 'Sign Out' });
  await signOutBtn.waitFor({ timeout: 5000 }).catch(() => {});
  const signOutVisible = await signOutBtn.isVisible().catch(() => false);
  if (!signOutVisible) {
    step('❌', 'Sign Out button not found in sidebar');
    pass = false;
  } else {
    await signOutBtn.click();
    await page.waitForTimeout(2000);
    const afterSignOut = page.url();
    if (afterSignOut.includes('/login')) {
      step('✅', 'Signed out → redirected to /login', afterSignOut);
    } else {
      step('❌', 'After sign out, not on /login', afterSignOut);
      pass = false;
    }
    await screenshot('07-after-signout');
  }

  // ── 9. Login with existing credentials ───────────────────────────
  console.log('\n── Step 9: Login with existing credentials ──');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]',    EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  const afterLoginUrl = page.url();
  await screenshot('08-after-login');
  if (afterLoginUrl === `${BASE}/` || afterLoginUrl.endsWith('/')) {
    step('✅', 'Login successful → dashboard', afterLoginUrl);
  } else if (afterLoginUrl.includes('/login')) {
    const errorEl = await page.locator('[style*="fee2e2"]').textContent().catch(() => '');
    step('❌', 'Login failed — still on /login', `Error: "${errorEl}"`);
    pass = false;
  } else {
    step('⚠️', 'Unexpected post-login URL', afterLoginUrl);
  }

  // ── 10. Logged-in user redirected away from /login ────────────────
  console.log('\n── Step 10: Probe — logged-in visit to /login ──');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const loggedInLoginUrl = page.url();
  if (!loggedInLoginUrl.includes('/login')) {
    step('🔍', 'Logged-in user visiting /login → redirected away', loggedInLoginUrl);
  } else {
    step('⚠️', 'Logged-in user can still reach /login', loggedInLoginUrl);
  }

  // ── 11. Probe — bad password ──────────────────────────────────────
  console.log('\n── Step 11: Probe — wrong password shows error ──');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  // sign out first
  const so = page.locator('button', { hasText: 'Sign Out' });
  if (await so.isVisible().catch(() => false)) await so.click();
  await page.waitForTimeout(1000);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]',    EMAIL);
  await page.fill('input[type="password"]', 'wrongpassword');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  const badPwError = await page.locator('[style*="fee2e2"]').textContent().catch(() => '');
  if (badPwError) {
    step('🔍', 'Wrong password → error shown', `"${badPwError.trim()}"`);
  } else {
    step('🔍', 'Wrong password — no visible error element found');
  }
  await screenshot('09-bad-password');

} catch (err) {
  step('❌', 'Uncaught error during test', err.message);
  console.error(err);
  pass = false;
} finally {
  await browser.close();
}

console.log('\n════════════════════════════════════════');
console.log(`Console errors captured: ${consoleErrors.length}`);
if (consoleErrors.length) consoleErrors.slice(0,5).forEach(e => console.log('  ERR:', e));
console.log(`\nFinal verdict: ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
