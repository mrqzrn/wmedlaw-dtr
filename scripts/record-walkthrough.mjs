/**
 * WMedlaw DTR & Timekeeping — Automated Video Walkthrough Recorder
 * 
 * This Playwright automation script launches a browser, enables high-definition
 * video recording, clicks through the interactive system walkthrough, and exports
 * a video clip demonstrating:
 *   1. Live Employee Clock In / Out & Shift Timer
 *   2. Accomplishment remarks validation
 *   3. Admin Timesheet Bulk Approvals & Overtime Adjudication
 *   4. Role Walkthroughs (Employee, Administrator, Super Admin)
 *   5. Real-time Decimal & Overnight Shift Calculator
 *   6. Searchable Troubleshooting FAQ
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Configuration
const CONFIG = {
  width: 1280,
  height: 800,
  recordingsDir: path.join(projectRoot, 'recordings'),
  targetFile: path.join(projectRoot, 'interactive-user-guide.html'),
  finalVideoName: 'timekeeping-walkthrough-demo.webm',
};

// Ensure recordings folder exists
if (!fs.existsSync(CONFIG.recordingsDir)) {
  fs.mkdirSync(CONFIG.recordingsDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Injects an animated visual cursor on the page so clicks and movements are clear in video
async function injectVisualCursor(page) {
  await page.addStyleTag({
    content: `
      #playwright-mouse-cursor {
        position: fixed;
        top: 0;
        left: 0;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(37, 99, 235, 0.85);
        border: 2px solid white;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.35);
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        transition: transform 0.08s ease-out, background 0.15s ease;
      }
      .cursor-click-ripple {
        position: fixed;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid #2563eb;
        pointer-events: none;
        z-index: 999998;
        transform: translate(-50%, -50%) scale(0.2);
        animation: cursor-ripple-anim 0.5s ease-out forwards;
      }
      @keyframes cursor-ripple-anim {
        to {
          transform: translate(-50%, -50%) scale(1.6);
          opacity: 0;
        }
      }
    `
  });

  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'playwright-mouse-cursor';
    cursor.style.left = '-100px';
    cursor.style.top = '-100px';
    document.body.appendChild(cursor);

    window.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    });

    window.addEventListener('mousedown', (e) => {
      cursor.style.transform = 'translate(-50%, -50%) scale(0.75)';
      cursor.style.background = '#dc2626'; // red click indicator
      const ripple = document.createElement('div');
      ripple.className = 'cursor-click-ripple';
      ripple.style.left = e.clientX + 'px';
      ripple.style.top = e.clientY + 'px';
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    });

    window.addEventListener('mouseup', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      cursor.style.background = 'rgba(37, 99, 235, 0.85)';
    });
  });
}

// Moves cursor smoothly across coordinates
async function smoothMoveTo(page, selector) {
  const element = await page.locator(selector).first();
  await element.waitFor({ state: 'visible' });
  const box = await element.boundingBox();
  if (!box) return;

  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  await page.mouse.move(targetX, targetY, { steps: 25 });
  await sleep(150);
}

// Clicks with smooth movement and realistic pacing
async function visualClick(page, selector) {
  await smoothMoveTo(page, selector);
  const element = page.locator(selector).first();
  await element.click();
  await sleep(500);
}

// Human-like typing simulation
async function humanType(page, selector, text, delayMs = 45) {
  await visualClick(page, selector);
  await page.locator(selector).pressSequentially(text, { delay: delayMs });
  await sleep(300);
}

async function recordWalkthrough() {
  console.log('====================================================');
  console.log('🎥 Starting WMedlaw DTR Automated Video Recorder');
  console.log('====================================================\n');

  console.log(`📁 Target File: ${CONFIG.targetFile}`);
  console.log(`📹 Video Output Directory: ${CONFIG.recordingsDir}`);

  // Launch browser with video recording enabled
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

  // Auto-accept confirmation alerts (like "Clock Out Successful" or "Bulk Approval Finished")
  page.on('dialog', async (dialog) => {
    console.log(`   💬 System Notification Alert: "${dialog.message().split('\\n')[0]}"`);
    await sleep(600);
    await dialog.accept();
  });

  try {
    // -------------------------------------------------------------
    // SCENE 1: Navigate & Initial Landing
    // -------------------------------------------------------------
    console.log('🎬 Scene 1: Opening Application & Title Header...');
    const fileUrl = 'file://' + path.resolve(CONFIG.targetFile);
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
    await injectVisualCursor(page);
    await sleep(1500);

    // -------------------------------------------------------------
    // SCENE 2: Live Employee Punch Clock Simulation
    // -------------------------------------------------------------
    console.log('🎬 Scene 2: Testing Live Employee Punch Clock Station...');
    await visualClick(page, '#nav-simulator');
    await sleep(800);

    // Move to Clock In button and start shift
    console.log('   👉 Clocking in to start shift...');
    await visualClick(page, '#sim-clockin-controls button');
    
    // Wait for timer simulation to tick forward
    console.log('   ⏱️ Shift running (accumulating decimal hours)...');
    await sleep(2500);

    // Enter required accomplishment notes
    console.log('   ✍️ Typing accomplishment notes (10-char policy)...');
    await humanType(
      page,
      '#sim-remarks',
      'Completed legal intake review and verified timekeeping compliance records.',
      35
    );
    await sleep(1000);

    // Click Punch Out
    console.log('   👉 Clocking out and submitting DTR filing...');
    await visualClick(page, '#sim-clockout-controls button:first-child');
    await sleep(1500);

    // -------------------------------------------------------------
    // SCENE 3: Admin Timesheet Adjudication Queue
    // -------------------------------------------------------------
    console.log('🎬 Scene 3: Administrator Overtime Adjudication Queue...');
    await page.locator('#admin-queue-container').scrollIntoViewIfNeeded();
    await sleep(1000);

    // Click "Bulk Approve Clean Entries"
    console.log('   👉 Executing Bulk Approval on clean shifts...');
    await visualClick(page, 'button:has-text("Bulk Approve Clean Entries")');
    await sleep(1200);

    // Review Jane Doe's approved badge
    await smoothMoveTo(page, '#badge-item-1');
    await sleep(1000);

    // Review Mark Santos's overtime (10.5h) and Approve All
    console.log('   👉 Adjudicating overtime shift (Approve All 10.5h)...');
    await visualClick(page, '#actions-item-2 button:first-child');
    await sleep(1500);

    // -------------------------------------------------------------
    // SCENE 4: Role-Based System Documentation Walkthrough
    // -------------------------------------------------------------
    console.log('🎬 Scene 4: Touring Role Portals...');
    // Scroll back to top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(800);

    // Employee Guide tab
    console.log('   📖 Navigating to Employee Portal Guide...');
    await visualClick(page, '#nav-employee-guide');
    await sleep(1800);

    // Administrator Guide tab
    console.log('   📖 Navigating to Administrator Guide...');
    await visualClick(page, '#nav-admin-guide');
    await sleep(1800);

    // Super Admin Guide tab
    console.log('   📖 Navigating to Super Admin Governance...');
    await visualClick(page, '#nav-sysadmin-guide');
    await sleep(1800);

    // -------------------------------------------------------------
    // SCENE 5: Decimal Hour & Overnight Shift Calculator
    // -------------------------------------------------------------
    console.log('🎬 Scene 5: Testing Decimal & Overnight Shift Calculator...');
    await visualClick(page, '#nav-calculator');
    await sleep(1000);

    // Test standard preset
    console.log('   🔢 Testing standard shift preset (08:00 - 17:00)...');
    await visualClick(page, 'button:has-text("08:00 – 17:00")');
    await sleep(1200);

    // Test midnight-crossing overnight preset
    console.log('   🌙 Testing overnight shift preset (22:00 - 06:00)...');
    await visualClick(page, 'button:has-text("22:00 – 06:00")');
    await sleep(1800);

    // Highlight calculated gross pay
    await smoothMoveTo(page, '#calc-gross');
    await sleep(1000);

    // -------------------------------------------------------------
    // SCENE 6: Searchable FAQ & Troubleshooting
    // -------------------------------------------------------------
    console.log('🎬 Scene 6: Testing Searchable FAQ...');
    await visualClick(page, '#nav-faq');
    await sleep(800);

    console.log('   🔍 Filtering FAQ by "wage"...');
    await humanType(page, '#faq-search', 'wage', 70);
    await sleep(1500);

    console.log('   🔍 Filtering FAQ by "overnight"...');
    await page.locator('#faq-search').fill('');
    await humanType(page, '#faq-search', 'overnight', 70);
    await sleep(1500);

    // Concluding view
    console.log('🎬 Scene 7: Finalizing Walkthrough...');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1500);

  } catch (error) {
    console.error('❌ Error during walkthrough execution:', error);
  } finally {
    // Retrieve video path before closing
    const video = page.video();
    const tempVideoPath = await video.path();

    // Close page & browser to flush video file to disk
    await page.close();
    await context.close();
    await browser.close();

    const finalPath = path.join(CONFIG.recordingsDir, CONFIG.finalVideoName);

    // Rename to user-friendly name
    if (fs.existsSync(tempVideoPath)) {
      if (fs.existsSync(finalPath)) {
        fs.unlinkSync(finalPath);
      }
      fs.renameSync(tempVideoPath, finalPath);
      const stats = fs.statSync(finalPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log('\n====================================================');
      console.log('🎉 VIDEO RECORDING COMPLETE!');
      console.log('====================================================');
      console.log(`📹 Video File: ${finalPath}`);
      console.log(`📊 File Size:  ${sizeMB} MB`);
      console.log('💡 You can open and view this video directly in your browser,');
      console.log('   QuickTime Player, VLC, or convert to MP4 via ffmpeg.\n');
    }
  }
}

recordWalkthrough();
