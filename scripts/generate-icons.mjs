// Genera los PNG de la PWA a partir de public/icons/icon.svg usando el Chromium de Playwright.
// Uso: node scripts/generate-icons.mjs  (solo hace falta si cambias el ícono)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
const render = async (size, file, maskable = false) => {
  await page.setViewportSize({ width: size, height: size });
  const inner = maskable
    ? `<div style="width:100%;height:100%;background:#4a42dd;display:flex;align-items:center;justify-content:center">
         <div style="width:72%;height:72%">${svg.replace('rx="116"', 'rx="0"')}</div></div>`
    : svg;
  await page.setContent(`<html><body style="margin:0;background:transparent">
    <div style="width:${size}px;height:${size}px">${inner}</div>
    <style>svg{width:100%;height:100%;display:block}</style></body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${file}`, import.meta.url).pathname, omitBackground: true });
};
await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(512, 'icon-maskable-512.png', true);
await browser.close();
console.log('Íconos generados');
