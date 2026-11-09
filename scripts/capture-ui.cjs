const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const out = path.join(root, 'qa-screenshots');
fs.mkdirSync(out, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const capture = async (win, name) => {
  await wait(450);
  const image = await win.webContents.capturePage();
  fs.writeFileSync(path.join(out, `${slug(name)}.png`), image.toPNG());
};

const assertNoLeak = async (win, page) => {
  const text = await win.webContents.executeJavaScript(`document.querySelector('.page-scroll')?.textContent || ''`);
  const errors = [];
  if (!['home', 'about'].includes(page) && text.includes('From Plot to Decision')) errors.push(`${page}: home tagline leaked`);
  if (page !== 'about' && text.includes('Developed & Conceptualized by')) errors.push(`${page}: about content leaked`);
  if (page !== 'settings' && text.includes('Database path')) errors.push(`${page}: diagnostics content leaked`);
  if (errors.length) throw new Error(errors.join('; '));
};

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    show: false,
    webPreferences: {
      preload: path.join(root, 'scripts', 'qa-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('preload-error', preloadPath, error);
  });
  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.error('renderer-console', message);
  });
  await win.loadFile(path.join(root, 'dist', 'index.html'));
  await wait(1200);
  const pages = ['home', 'overview', 'plot', 'regulations', 'development', 'parking', 'financial', 'scenarios', 'reports', 'settings', 'about'];
  await capture(win, 'home-bilingual');
  await assertNoLeak(win, 'home');
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('Open Demo Study'))?.click()`);
  await wait(700);
  for (const page of pages.slice(1)) {
    const navTitle = page === 'regulations' ? 'Regulation' : page[0].toUpperCase() + page.slice(1);
    if (page === 'reports') {
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('تصدير'))?.click()`);
    } else {
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find((b) => b.title && b.title.includes('${navTitle}'))?.click()`);
    }
    await capture(win, `${page}-bilingual`);
    await assertNoLeak(win, page);
    if (page === 'reports') {
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('Export Excel'))?.click()`);
      await wait(900);
      await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('Export PDF'))?.click()`);
      await wait(900);
    }
  }
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find((b) => b.title && b.title.includes('Settings'))?.click()`);
  await wait(250);
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.tabs button')).find((b) => b.textContent === 'Language')?.click()`);
  await wait(200);
  await win.webContents.executeJavaScript(`{ const select = Array.from(document.querySelectorAll('select')).find((el) => Array.from(el.options).some((o) => o.value === 'ar')); if (select) { select.value = 'ar'; select.dispatchEvent(new Event('change', { bubbles: true })); } }`);
  await capture(win, 'settings-arabic-rtl');
  await win.webContents.executeJavaScript(`{ const select = Array.from(document.querySelectorAll('select')).find((el) => Array.from(el.options).some((o) => o.value === 'en')); if (select) { select.value = 'en'; select.dispatchEvent(new Event('change', { bubbles: true })); } }`);
  await capture(win, 'settings-english-ltr');
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.tabs button')).find((b) => b.textContent === 'Appearance')?.click()`);
  await wait(200);
  await win.webContents.executeJavaScript(`{ const select = Array.from(document.querySelectorAll('select')).find((el) => Array.from(el.options).some((o) => o.value === 'dark')); if (select) { select.value = 'dark'; select.dispatchEvent(new Event('change', { bubbles: true })); } }`);
  await capture(win, 'settings-dark');
  await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Saudi DevelopIQ home')?.click()`);
  await wait(250);
  await capture(win, 'home-dark');
  await win.close();
  app.quit();
}).catch((error) => {
  console.error(error);
  app.quit();
  process.exitCode = 1;
});
