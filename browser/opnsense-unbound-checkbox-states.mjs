// Read-only: extract the actual checked/unchecked state of Unbound's
// Advanced-settings checkboxes (the "Logging Settings" section in
// particular), since plain text extraction doesn't reveal checkbox state.
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page = context.pages()[0];
await page.goto('https://192.168.50.1/ui/unbound/advanced', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1500);

const states = await page.evaluate(() => {
  const results = [];
  document.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    // Find the nearest preceding label text (OPNsense form-table layout)
    const row = cb.closest('tr') || cb.closest('.form-group') || cb.parentElement;
    const label = row ? row.querySelector('td, label, .control-label')?.textContent?.trim() : null;
    results.push({ id: cb.id || cb.name, checked: cb.checked, label });
  });
  return results;
});
console.log(JSON.stringify(states, null, 2));
process.exit(0);
