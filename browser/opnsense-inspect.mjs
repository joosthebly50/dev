import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page = context.pages()[0];

const info = await page.evaluate(() => {
  const all = [...document.querySelectorAll('[id], [class]')]
    .filter((el) => /content/i.test(el.id) || /content/i.test(el.className))
    .map((el) => ({ tag: el.tagName, id: el.id, class: el.className, textLen: el.textContent.trim().length }));
  return all.slice(0, 40);
});
console.log(JSON.stringify(info, null, 2));
process.exit(0);
