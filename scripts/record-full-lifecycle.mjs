/**
 * WMedlaw DTR & Timekeeping — Full End-to-End Lifecycle Video Recorder
 * Target: http://localhost:3001
 * 
 * Recorded Flow:
 * 1. Employee Login
 * 2. Employee Live Punch In -> Running Timer -> Punch Out with remarks
 * 3. Employee Manual Shift Filing with shift times & deliverables
 * 4. Admin Login & DTR Review -> Approving Employee Filings
 * 5. Employee Login & Finalize -> Reviewing shifts & Monthly Self-Approval certification
 * 6. Admin Login -> Pay Periods & Payroll -> Compute Total Payroll
 * 7. Admin Payment Disbursement -> Tagging Individual Payment with Reference No.
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const CONFIG = {
  url: 'http://localhost:3001',
  width: 1366,
  height: 850,
  recordingsDir: path.join(projectRoot, 'recordings'),
  finalVideoName: 'timekeeping-full-lifecycle.webm',
  employee: {
    email: 'employee.walkthrough@wmedlaw.com',
    password: 'Password123!',
    name: 'Maria Santos',
  },
  admin: {
    email: 'admin.walkthrough@wmedlaw.com',
    password: 'Password123!',
    name: 'Admin Reviewer',
  },
};

if (!fs.existsSync(CONFIG.recordingsDir)) {
  fs.mkdirSync(CONFIG.recordingsDir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Injects an animated cursor dot with click ripple animations
async function injectVisualCursor(page) {
  try {
    await page.addStyleTag({
      content: `
        #playwright-mouse-cursor {
          position: fixed;
          top: 0;
          left: 0;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(37, 99, 235, 0.9);
          border: 2.5px solid #ffffff;
          box-shadow: 0 0 12px rgba(0, 0, 0, 0.45);
          pointer-events: none;
          z-index: 9999999;
          transform: translate(-50%, -50%);
          transition: transform 0.08s ease-out, background 0.15s ease;
        }
        .cursor-click-ripple {
          position: fixed;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 3px solid #2563eb;
          pointer-events: none;
          z-index: 9999998;
          transform: translate(-50%, -50%) scale(0.2);
          animation: cursor-ripple-anim 0.5s ease-out forwards;
        }
        @keyframes cursor-ripple-anim {
          to {
            transform: translate(-50%, -50%) scale(1.7);
            opacity: 0;
          }
        }
      `,
    });

    await page.evaluate(() => {
      let cursor = document.getElementById('playwright-mouse-cursor');
      if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'playwright-mouse-cursor';
        cursor.style.left = '-100px';
        cursor.style.top = '-100px';
        document.body.appendChild(cursor);
      }

      window.addEventListener('mousemove', (e) => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      });

      window.addEventListener('mousedown', (e) => {
        cursor.style.transform = 'translate(-50%, -50%) scale(0.75)';
        cursor.style.background = '#dc2626';
        const ripple = document.createElement('div');
        ripple.className = 'cursor-click-ripple';
        ripple.style.left = e.clientX + 'px';
        ripple.style.top = e.clientY + 'px';
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
      });

      window.addEventListener('mouseup', () => {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        cursor.style.background = 'rgba(37, 99, 235, 0.9)';
      });
    });
  } catch (err) {
    // ignore
  }
}

// Smoothly moves cursor to target selector
async function smoothMoveTo(page, selectorOrLocator) {
  let locator;
  if (typeof selectorOrLocator === 'string') {
    locator = page.locator(selectorOrLocator).first();
  } else {
    locator = selectorOrLocator;
  }
  await locator.waitFor({ state: 'visible', timeout: 10000 });
  const box = await locator.boundingBox();
  if (!box) return;

  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;
  await page.mouse.move(targetX, targetY, { steps: 22 });
  await sleep(150);
}

// Visual click with cursor movement
async function visualClick(page, selectorOrLocator) {
  await smoothMoveTo(page, selectorOrLocator);
  let locator;
  if (typeof selectorOrLocator === 'string') {
    locator = page.locator(selectorOrLocator).first();
  } else {
    locator = selectorOrLocator;
  }
  await locator.click();
  await sleep(650);
}

// Human-like typing with visual focus
async function humanType(page, selectorOrLocator, text, delayMs = 35) {
  await visualClick(page, selectorOrLocator);
  const loc = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator).first() : selectorOrLocator;
  await loc.pressSequentially(text, { delay: delayMs });
  await sleep(300);
}

// Helper: Sign In
async function loginAs(page, email, password, roleLabel) {
  console.log(`   🔑 Logging in as ${roleLabel} (${email})...`);
  await page.waitForFunction(
    () => !document.body.innerText.includes('Connecting to Supabase...'),
    { timeout: 25000 }
  );
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await injectVisualCursor(page);

  await page.locator('input[type="email"]').fill('');
  await humanType(page, 'input[type="email"]', email, 25);

  await page.locator('input[type="password"]').fill('');
  await humanType(page, 'input[type="password"]', password, 30);

  const rememberMe = page.locator('#auth-remember-me').first();
  if (await rememberMe.isVisible()) {
    const isChecked = await rememberMe.isChecked();
    if (!isChecked) {
      await visualClick(page, rememberMe);
    }
  }

  await visualClick(page, 'button[type="submit"]:has-text("Sign In")');

  await page.waitForFunction(
    () => !document.body.innerText.includes('Authenticating with Supabase...'),
    { timeout: 20000 }
  );
  await page.waitForSelector('#role-switcher-dropdown', { timeout: 20000 });
  await injectVisualCursor(page);
  await sleep(2000);
}

// Helper: Sign Out
async function logout(page) {
  console.log('   🔒 Logging out...');
  await visualClick(page, '#role-switcher-dropdown');
  await sleep(400);
  await visualClick(page, '#btn-nav-sign-out');
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await injectVisualCursor(page);
  await sleep(1200);
}

async function recordFullLifecycle() {
  console.log('====================================================');
  console.log('🎥 Recording Full Lifecycle: Punch In/Out to Payroll');
  console.log('====================================================\n');

  console.log(`🌐 Application URL: ${CONFIG.url}`);
  console.log(`📹 Video Output:    ${CONFIG.recordingsDir}`);

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: CONFIG.width, height: CONFIG.height },
    recordVideo: {
      dir: CONFIG.recordingsDir,
      size: { width: CONFIG.width, height: CONFIG.height },
    },
  });

  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    console.log(`   💬 Alert: "${dialog.message().split('\n')[0]}"`);
    await sleep(600);
    await dialog.accept();
  });

  try {
    // -------------------------------------------------------------------------
    // SCENE 1: Navigate to localhost:3001 & Employee Sign In
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 1: Initial Landing & Employee Sign In...');
    await page.goto(CONFIG.url);
    await page.waitForFunction(
      () => !document.body.innerText.includes('Connecting to Supabase...'),
      { timeout: 25000 }
    );
    await injectVisualCursor(page);
    await sleep(1500);

    const existingDropdown = page.locator('#role-switcher-dropdown').first();
    if (await existingDropdown.isVisible()) {
      await logout(page);
    }

    await loginAs(page, CONFIG.employee.email, CONFIG.employee.password, 'Employee');

    // -------------------------------------------------------------------------
    // SCENE 2: Employee Live Punch In & Punch Out
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 2: Employee Live Punch Clock (In & Out)...');
    const punchTab = page.locator('#tab-punch-clock-mode').first();
    if (await punchTab.isVisible()) {
      await visualClick(page, punchTab);
    }

    // Click Punch In
    console.log('   👉 Clocking in shift...');
    const punchInBtn = page.locator('#btn-punch-clock-in').first();
    await visualClick(page, punchInBtn);
    
    // Wait for the active shift ticker
    console.log('   ⏱️ Shift in progress (timer running)...');
    await page.waitForSelector('#punch-clock-out-remarks', { timeout: 10000 });
    await sleep(2500);

    // Type accomplishment notes
    console.log('   ✍️ Entering shift deliverables...');
    await humanType(
      page,
      '#punch-clock-out-remarks',
      'Completed legal document reviews, conducted client intake calls, and updated operations tracker.',
      30
    );
    await sleep(1200);

    // Click Punch Out
    console.log('   👉 Clocking out shift...');
    const punchOutBtn = page.locator('#btn-punch-clock-out').first();
    await visualClick(page, punchOutBtn);
    await sleep(2000);

    // -------------------------------------------------------------------------
    // SCENE 3: Employee Manual Shift Filing
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 3: Employee Manual Shift Filing...');
    const manualTab = page.locator('#tab-manual-file-mode').first();
    await visualClick(page, manualTab);
    await sleep(1200);

    // Select yesterday to avoid any intraday interval overlap
    console.log('   📅 Setting shift date & 08:00 to 17:00 schedule...');
    const dateInput = page.locator('#dtr-input-date').first();
    await dateInput.fill('2026-10-20');

    const timeInInput = page.locator('#dtr-input-time-in').first();
    await timeInInput.fill('08:00');

    const timeOutInput = page.locator('#dtr-input-time-out').first();
    await timeOutInput.fill('17:00');
    await sleep(800);

    // Fill accomplishments
    console.log('   ✍️ Documenting manual shift deliverables...');
    await humanType(
      page,
      '#dtr-input-remarks',
      'Prepared monthly compliance documentation and attended court pre-trial hearing with senior counsel.',
      30
    );
    await sleep(1000);

    // Submit manual DTR
    console.log('   👉 Submitting manual DTR filing...');
    const submitDtrBtn = page.locator('#btn-submit-dtr-entry').first();
    await visualClick(page, submitDtrBtn);
    await sleep(2500);

    // -------------------------------------------------------------------------
    // SCENE 4: Admin Login & DTR Approvals
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 4: Switching to Administrator to Approve DTR...');
    await logout(page);
    await loginAs(page, CONFIG.admin.email, CONFIG.admin.password, 'Administrator');

    // Go to DTR Filings & Approvals
    console.log('   👉 Opening DTR Filings & Approvals...');
    const filingsNav = page.locator('#nav-admin-filings, button:has-text("DTR Filings & Approvals")').first();
    await visualClick(page, filingsNav);
    await sleep(2500);

    // Select employee filter for Maria Santos or look for submitted entries
    const empSelect = page.locator('#filing-filter-employee').first();
    if (await empSelect.isVisible()) {
      await empSelect.selectOption({ label: 'Maria Santos (Operations)' }).catch(() => {});
      await sleep(1000);
    }

    // Approve the employee's submitted entry
    const approveBtn = page.locator('button:has-text("Approve"), [id^="btn-approve-"]').first();
    if (await approveBtn.isVisible()) {
      console.log('   ✅ Approving employee DTR filing...');
      await visualClick(page, approveBtn);
      await sleep(1800);
    }

    // Inspect approved status
    await page.evaluate(() => window.scrollBy({ top: 250, behavior: 'smooth' }));
    await sleep(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1000);

    // -------------------------------------------------------------------------
    // SCENE 5: Employee Login & Finalize (Monthly Self-Approval)
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 5: Employee Finalizes DTR (Monthly Self-Approval)...');
    await logout(page);
    await loginAs(page, CONFIG.employee.email, CONFIG.employee.password, 'Employee');

    // Go to "My DTR Records"
    console.log('   👉 Opening My DTR Records...');
    const myDtrNav = page.locator('#nav-emp-dtr, button:has-text("My DTR Records")').first();
    await visualClick(page, myDtrNav);
    await sleep(2000);

    // Locate the "Finalize & Self-Approve Month" button
    const finalizeBtn = page.locator('#btn-finalize-monthly-dtr, button:has-text("Finalize & Self-Approve Month")').first();
    if (await finalizeBtn.isVisible()) {
      console.log('   👉 Clicking Finalize & Self-Approve Month...');
      await visualClick(page, finalizeBtn);
      await sleep(1500);

      // Check attestation checkbox
      console.log('   ☑️ Checking employee attestation statement...');
      const attestCheck = page.locator('#checkbox-attestation').first();
      await visualClick(page, attestCheck);
      await sleep(600);

      // Type note
      const attestNote = page.locator('textarea[placeholder*="Add any note"]').first();
      if (await attestNote.isVisible()) {
        await humanType(page, 'textarea[placeholder*="Add any note"]', 'All October 2026 shifts reviewed and certified accurate.', 30);
      }

      // Confirm self-approval
      console.log('   👉 Submitting final self-approval certification...');
      const confirmSelfApprove = page.locator('#btn-confirm-self-approve, button:has-text("Certify & Submit")').first();
      await visualClick(page, confirmSelfApprove);
      await sleep(2500);

      // View submission certificate
      const viewCertBtn = page.locator('#btn-view-certificate, button:has-text("View Submission Certificate")').first();
      if (await viewCertBtn.isVisible()) {
        console.log('   📜 Viewing certified submission certificate...');
        await visualClick(page, viewCertBtn);
        await sleep(2000);
        const closeCertBtn = page.locator('button:has-text("Close")').first();
        if (await closeCertBtn.isVisible()) {
          await visualClick(page, closeCertBtn);
          await sleep(800);
        }
      }
    } else {
      console.log('   ℹ️ Month certified, highlighting badge...');
      await smoothMoveTo(page, 'text="Finalized & Self-Approved"');
      await sleep(1500);
    }

    // -------------------------------------------------------------------------
    // SCENE 6: Admin Login & Compute Payroll
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 6: Admin Computes Payroll...');
    await logout(page);
    await loginAs(page, CONFIG.admin.email, CONFIG.admin.password, 'Administrator');

    // Go to Pay Periods & Payroll
    console.log('   👉 Navigating to Pay Periods & Payroll Management...');
    const payrollNav = page.locator('#nav-admin-payments, button:has-text("Pay Periods & Payroll")').first();
    await visualClick(page, payrollNav);
    await sleep(2000);

    // Compute Total Payroll
    console.log('   🧮 Computing total payroll across approved DTRs...');
    const computePayrollBtn = page.locator('button:has-text("Compute Total Payroll"), #btn-compute-payroll-header, #btn-recompute-period-payroll').first();
    await visualClick(page, computePayrollBtn);
    await sleep(2200);

    // Highlight KPI cards
    await smoothMoveTo(page, 'text="Total Computed Payroll"');
    await sleep(1000);
    await smoothMoveTo(page, 'text="Total Approved Hours"');
    await sleep(1000);

    // Run Pre-Close verification check
    const precloseCheckBtn = page.locator('button:has-text("Verify & Close Period"), #btn-run-preclose-check').first();
    if (await precloseCheckBtn.isVisible()) {
      console.log('   🔍 Running Pre-Closing Verification Check...');
      await visualClick(page, precloseCheckBtn);
      await sleep(2000);
    }

    // -------------------------------------------------------------------------
    // SCENE 7: Admin Payment / Disbursement
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 7: Admin Payment Disbursement...');
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await sleep(1500);

    // Look for Mark Paid or Edit Ref on the payment row
    const markPaidAction = page.locator('button:has-text("Mark Paid"), button:has-text("Edit Ref"), button[id^="btn-mark-paid-"]').first();
    if (await markPaidAction.isVisible()) {
      console.log('   👉 Opening Payment Disbursement details...');
      await visualClick(page, markPaidAction);
      await sleep(1800);

      // Auto-generate reference number
      const autoGenRef = page.locator('button:has-text("Auto-Generate Ref")').first();
      if (await autoGenRef.isVisible()) {
        console.log('   🔢 Generating transaction confirmation number...');
        await visualClick(page, autoGenRef);
        await sleep(800);
      }

      // Confirm payment disbursement
      console.log('   ✅ Recording disbursement as PAID...');
      const confirmPaymentBtn = page.locator('button[type="submit"]:has-text("Confirm Individual Payment")').first();
      if (await confirmPaymentBtn.isVisible()) {
        await visualClick(page, confirmPaymentBtn);
        await sleep(2200);
      } else {
        const cancelModal = page.locator('button:has-text("Cancel")').first();
        if (await cancelModal.isVisible()) {
          await visualClick(page, cancelModal);
        }
      }
    }

    // Final overview
    console.log('🎬 Scene 8: Finalizing Overview...');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(3000);

  } catch (error) {
    console.error('❌ Error during full lifecycle recording execution:', error);
  } finally {
    const video = page.video();
    const tempVideoPath = video ? await video.path() : null;

    await page.close();
    await context.close();
    await browser.close();

    if (tempVideoPath && fs.existsSync(tempVideoPath)) {
      const finalPath = path.join(CONFIG.recordingsDir, CONFIG.finalVideoName);
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
      }
      fs.renameSync(tempVideoPath, finalPath);
      const stats = fs.statSync(finalPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log('\n====================================================');
      console.log('🎉 FULL LIFECYCLE VIDEO RECORDING COMPLETE!');
      console.log('====================================================');
      console.log(`📹 Video File: ${finalPath}`);
      console.log(`📊 File Size:  ${sizeMB} MB`);
      console.log(`⏱️ Flow Completed: Punch In/Out -> Manual Filing -> Admin DTR Approve -> Employee Finalize -> Admin Compute Payroll -> Payment\n`);
    }
  }
}

recordFullLifecycle();
