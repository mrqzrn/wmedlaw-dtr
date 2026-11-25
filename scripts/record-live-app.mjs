/**
 * WMedlaw DTR & Timekeeping — Live Browser Recording: Login to Payroll
 * Target: http://localhost:3001
 * 
 * Records the complete live system journey:
 * 1. Landing on localhost:3001 Login screen
 * 2. Authenticating as Administrator (admin.walkthrough@wmedlaw.com)
 * 3. Touring Admin Dashboard & Header Navigation
 * 4. Checking DTR Filings & Team Records
 * 5. Navigating to Pay Periods & Payroll Management
 * 6. Running Payroll Computations & KPI review
 * 7. Running Pre-Close Verification Checklist
 * 8. Reviewing employee bank accounts & gross payable lines
 * 9. Concluding on finalized payroll disbursement overview
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
  finalVideoName: 'localhost-login-to-payroll.webm',
  user: {
    email: 'admin.walkthrough@wmedlaw.com',
    password: 'Password123!',
  },
};

if (!fs.existsSync(CONFIG.recordingsDir)) {
  fs.mkdirSync(CONFIG.recordingsDir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Injects an animated cursor dot with click animations
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
    // ignore if frame is detached
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
  await locator.waitFor({ state: 'visible', timeout: 8000 });
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
async function humanType(page, selector, text, delayMs = 45) {
  await visualClick(page, selector);
  await page.locator(selector).pressSequentially(text, { delay: delayMs });
  await sleep(350);
}

async function recordLiveWalkthrough() {
  console.log('====================================================');
  console.log('🎥 Recording Live Session on http://localhost:3001');
  console.log('====================================================\n');

  console.log(`🌐 Application URL: ${CONFIG.url}`);
  console.log(`👤 Test Account:    ${CONFIG.user.email}`);
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
    // SCENE 1: Navigate to Login Page
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 1: Navigating to localhost:3001 Login Portal...');
    await page.goto(CONFIG.url);

    // Wait for Supabase connection to resolve and show form
    console.log('   ⏳ Waiting for Supabase connection & login screen...');
    await page.waitForFunction(
      () => !document.body.innerText.includes('Connecting to Supabase...'),
      { timeout: 25000 }
    );
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await injectVisualCursor(page);
    await sleep(1500);

    // Enter Email
    console.log(`   ✍️ Typing user email (${CONFIG.user.email})...`);
    await humanType(page, 'input[type="email"]', CONFIG.user.email, 35);
    await sleep(400);

    // Enter Password
    console.log('   ✍️ Typing password...');
    await humanType(page, 'input[type="password"]', CONFIG.user.password, 45);
    await sleep(400);

    // Check Remember Me
    const rememberMeCheckbox = page.locator('#auth-remember-me').first();
    if (await rememberMeCheckbox.isVisible()) {
      console.log('   ☑️ Checking "Remember me"...');
      await visualClick(page, rememberMeCheckbox);
      await sleep(300);
    }

    // Click Sign In
    console.log('   👉 Clicking "Sign In to Account"...');
    await visualClick(page, 'button[type="submit"]:has-text("Sign In")');

    // Wait for App to load
    console.log('   ⏳ Authenticating and loading dashboard...');
    await page.waitForFunction(
      () => !document.body.innerText.includes('Authenticating with Supabase...'),
      { timeout: 20000 }
    );
    await page.waitForSelector('button:has-text("Pay Periods & Payroll")', { timeout: 20000 });
    await injectVisualCursor(page);
    await sleep(2000);

    // -------------------------------------------------------------------------
    // SCENE 2: Tour Header & Admin Navigation
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 2: Exploring Admin Dashboard Header...');
    // Highlight Role Switcher dropdown / user profile
    await smoothMoveTo(page, '#role-switcher-dropdown');
    await sleep(1200);

    // Highlight Server Clock
    const clockBtn = page.locator('#server-clock-button').first();
    if (await clockBtn.isVisible()) {
      await smoothMoveTo(page, '#server-clock-button');
      await sleep(1000);
    }

    // Click "Admin Overview"
    const overviewTab = page.locator('button:has-text("Admin Overview")').first();
    if (await overviewTab.isVisible()) {
      console.log('   👉 Inspecting Admin Overview...');
      await visualClick(page, overviewTab);
      await sleep(1800);
    }

    // Click "DTR Filings & Approvals"
    const filingsTab = page.locator('button:has-text("DTR Filings & Approvals")').first();
    if (await filingsTab.isVisible()) {
      console.log('   👉 Viewing DTR Filings & Approvals...');
      await visualClick(page, filingsTab);
      await sleep(1800);

      // Smooth scroll down to view submitted timesheet entries
      await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
      await sleep(1200);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
      await sleep(800);
    }

    // -------------------------------------------------------------------------
    // SCENE 3: Enter "Pay Periods & Payroll"
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 3: Navigating to Pay Periods & Payroll Management...');
    const paymentsTab = page.locator('button:has-text("Pay Periods & Payroll")').first();
    await visualClick(page, paymentsTab);
    await sleep(2000);

    // Showcase Total Payroll KPI Cards
    console.log('   📊 Highlighting Total Computed Payroll and Hours KPIs...');
    await smoothMoveTo(page, 'text="Total Computed Payroll"');
    await sleep(1200);
    await smoothMoveTo(page, 'text="Total Approved Hours"');
    await sleep(1000);
    await smoothMoveTo(page, 'text="Total Paid to Date"');
    await sleep(1000);

    // Trigger "Compute Total Payroll"
    const computeBtn = page.locator('button:has-text("Compute Total Payroll"), #btn-compute-payroll-header').first();
    if (await computeBtn.isVisible()) {
      console.log('   🧮 Clicking "Compute Total Payroll"...');
      await visualClick(page, computeBtn);
      await sleep(2000);
    }

    // Trigger "Verify & Close Period" (Pre-Close Check)
    const precloseBtn = page.locator('button:has-text("Verify & Close Period"), #btn-run-preclose-check').first();
    if (await precloseBtn.isVisible()) {
      console.log('   🔍 Running Pre-Closing Verification Check...');
      await visualClick(page, precloseBtn);
      await sleep(2200);
    }

    // Scroll down to Individual Employee Payment Records
    console.log('   📋 Inspecting Employee Payment Records Table...');
    await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
    await sleep(1500);

    // Filter by Paid
    const paidFilter = page.locator('button:has-text("Paid (")').first();
    if (await paidFilter.isVisible()) {
      console.log('   🔍 Filtering by Paid status...');
      await visualClick(page, paidFilter);
      await sleep(1500);
    }

    // Filter by All
    const allFilter = page.locator('button:has-text("All (")').first();
    if (await allFilter.isVisible()) {
      await visualClick(page, allFilter);
      await sleep(1200);
    }

    // Inspect individual bank/wallet details and copy button
    const copyBtn = page.locator('button[title*="Copy"]').first();
    if (await copyBtn.isVisible()) {
      console.log('   📋 Hovering over Employee Bank Details...');
      await smoothMoveTo(page, copyBtn);
      await sleep(1000);
    }

    // Inspect Disbursement info
    const editRefBtn = page.locator('button:has-text("Edit Ref"), button:has-text("Mark Paid")').first();
    if (await editRefBtn.isVisible()) {
      console.log('   👉 Opening Payment Disbursement details...');
      await visualClick(page, editRefBtn);
      await sleep(1800);

      // In modal: click "Auto-Generate Ref" or Cancel
      const autoGenBtn = page.locator('button:has-text("Auto-Generate Ref")').first();
      if (await autoGenBtn.isVisible()) {
        await visualClick(page, autoGenBtn);
        await sleep(1000);
      }

      // Close modal
      const cancelBtn = page.locator('button:has-text("Cancel")').first();
      if (await cancelBtn.isVisible()) {
        await visualClick(page, cancelBtn);
        await sleep(1000);
      }
    }

    // -------------------------------------------------------------------------
    // SCENE 4: Concluding Overview
    // -------------------------------------------------------------------------
    console.log('🎬 Scene 4: Finalizing Overview...');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(3000);

  } catch (error) {
    console.error('❌ Error during live recording execution:', error);
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
      console.log('🎉 LIVE RECORDING FINISHED SUCCESSFULLY!');
      console.log('====================================================');
      console.log(`📹 Video File: ${finalPath}`);
      console.log(`📊 File Size:  ${sizeMB} MB`);
      console.log(`⏱️ URL Tested: ${CONFIG.url}\n`);
    }
  }
}

recordLiveWalkthrough();
