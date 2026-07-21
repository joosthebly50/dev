import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node render-cv-pdf.mjs <input.html> <output.pdf>');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.emulateMedia({ colorScheme: 'dark' });
await page.goto(pathToFileURL(inputPath).href, { waitUntil: 'load' });
await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; opacity: 1 !important; transform: none !important; }' });
await page.pdf({
  path: outputPath,
  format: 'A4',
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
