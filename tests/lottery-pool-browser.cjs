const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 850 }, serviceWorkers: 'block' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://**/*', route => route.abort());
      await page.goto('http://127.0.0.1:8123', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.OCLottery);
      await page.evaluate(() => {
        characters = Array.from({ length: 60 }, (_, i) => ({ id: `lottery-${i}`, name: `角色 ${i + 1}`, tags: ['測試'] }));
        mediaLibrary = [{ id: '__oc_media_settings__', kind: 'settings', lotteryData: { counts: { 'lottery-0': 3 } } }];
        window.__lotteryFullSaveCalls = 0;
        window.saveStateToLocalStorage = () => { window.__lotteryFullSaveCalls++; throw new Error('A pool toggle must not rewrite the complete workshop'); };
        OCLottery.open();
        OCLottery.setView('pool');
      });
      assert.equal(await page.locator('.lottery-pool-person').count(), 60);
      const style = await page.locator('.lottery-pool-grid').evaluate(el => ({ height: el.getBoundingClientRect().height, maxHeight: getComputedStyle(el).maxHeight, overflow: getComputedStyle(el).overflowY }));
      assert.ok(style.height > 500, `the list must extend past the old inner scrollbar at ${width}px`);
      assert.equal(style.maxHeight, 'none');
      assert.equal(style.overflow, 'visible');
      const rowIndex = width === 1280 ? 15 : 11;
      const sixthRow = page.locator('.lottery-pool-person').nth(rowIndex);
      await sixthRow.scrollIntoViewIfNeeded();
      const before = await page.locator('#lotteryScroll').evaluate(el => el.scrollTop);
      await sixthRow.click();
      assert.equal(await sixthRow.locator('input').isChecked(), false);
      assert.equal(await page.locator('.lottery-pool-person').count(), 60);
      assert.ok(await page.locator('#lotteryPanel').isVisible());
      assert.equal(await page.locator('.lottery-shell').evaluate(el => el.scrollTop), 0, 'the shell itself must never scroll when a hidden checkbox receives focus');
      assert.ok(await page.locator('.lottery-header').evaluate(el => el.getBoundingClientRect().top >= 0), 'header must stay in the viewport');
      const after = await page.locator('#lotteryScroll').evaluate(el => el.scrollTop);
      assert.ok(Math.abs(after - before) < 80, `toggling row should keep scroll position at ${width}px`);
      await page.locator('#lotteryNav [data-view="collection"]').click();
      assert.equal(await page.locator('.lottery-collection-item').count(), 59);
      assert.equal(await page.locator(`.lottery-collection-item[data-id="lottery-${rowIndex}"]`).count(), 0);
      assert.equal(await page.locator('.lottery-collection-item.is-unmet').count(), 58);
      assert.equal(await page.locator('.lottery-collection-item.is-found').count(), 1);
      assert.match(await page.locator('.lottery-count-badge').innerText(), /x3/);
      const opacity = await page.locator('.lottery-collection-item.is-unmet .lottery-portrait').first().evaluate(el => Number(getComputedStyle(el).opacity));
      assert.ok(opacity < 1, 'unmet portrait should be visibly muted');
      await page.locator('#lotteryNav [data-view=pool]').click();
      const stressRow = page.locator('.lottery-pool-person').nth(25);
      await stressRow.scrollIntoViewIfNeeded();
      for (let i = 0; i < 20; i++) await stressRow.click();
      assert.ok(await page.locator('.lottery-header').isVisible(), 'header must remain visible after repeated toggles');
      assert.equal(await page.locator('.lottery-shell').evaluate(el => el.scrollTop), 0);
      assert.ok(await page.locator('.lottery-pool-person').nth(59).isVisible(), 'full pool must remain rendered');
      assert.equal(await page.evaluate(() => window.__lotteryFullSaveCalls), 0);
      assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('oc_media_library')).some(row => row.id === '__oc_media_settings__' && row.lotteryData.poolIds)), 'pool choice must be saved');
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: long summon pool scroll and selection, active-only collection, muted unmet portraits on desktop and mobile.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
