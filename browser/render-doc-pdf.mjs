// Renders a markdown doc to a printed PDF: marked (markdown -> HTML) piped
// into a Chromium tab via Playwright, then page.pdf(). Reused for
// Documents/SOC_HOMELAB_MASTER_DOCUMENTATION.md -> .pdf, but works for any
// markdown file.
//
// Usage: node render-doc-pdf.mjs <input.md> <output.pdf> [--title "..."]
import { readFileSync, writeFileSync } from 'node:fs';
import { marked } from 'marked';
import { chromium } from 'playwright';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node render-doc-pdf.mjs <input.md> <output.pdf>');
  process.exit(1);
}

const md = readFileSync(inputPath, 'utf8');
const titleMatch = md.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1] : inputPath;
const bodyHtml = marked.parse(md);

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 20mm 16mm; }
  body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1a1a1a; }
  h1 { font-size: 20pt; border-bottom: 2px solid #2b8fd1; padding-bottom: 6px; margin-top: 0; }
  h2 { font-size: 15pt; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-top: 28px; page-break-after: avoid; }
  h3 { font-size: 12.5pt; margin-top: 20px; page-break-after: avoid; }
  h4 { font-size: 11pt; margin-top: 16px; page-break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  code { font-family: ui-monospace, "SF Mono", Consolas, monospace; background: #f2f2f2; padding: 0.1em 0.35em; border-radius: 3px; font-size: 0.92em; }
  pre { background: #f6f6f6; border: 1px solid #ddd; border-radius: 5px; padding: 10px 12px; white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 0.92em; page-break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #eef4fa; }
  blockquote { border-left: 3px solid #2b8fd1; margin: 12px 0; padding: 2px 14px; color: #444; background: #f8fafc; }
  a { color: #1a6fb0; }
  hr { border: none; border-top: 1px solid #ccc; margin: 24px 0; }
  img { max-width: 100%; }
</style></head>
<body>${bodyHtml}</body></html>`;

const tmpHtmlPath = outputPath + '.tmp.html';
writeFileSync(tmpHtmlPath, html, 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file://' + tmpHtmlPath, { waitUntil: 'load' });
await page.pdf({
  path: outputPath,
  format: 'A4',
  margin: { top: '20mm', bottom: '18mm', left: '16mm', right: '16mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="font-size:8px; width:100%; text-align:center; color:#888;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  printBackground: true,
});
await browser.close();

const { execSync } = await import('node:child_process');
execSync(`rm -f ${JSON.stringify(tmpHtmlPath)}`);

const pages = execSync(`pdfinfo ${JSON.stringify(outputPath)} 2>/dev/null | grep Pages || true`).toString().trim();
console.log(`PDF geschreven: ${outputPath}${pages ? ' (' + pages + ')' : ''}`);
