const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const root = path.join(__dirname, '..');
const exportDir = path.join(root, 'qa-exports');
const statePath = path.join(exportDir, 'functional-state.json');
fs.mkdirSync(exportDir, { recursive: true });
if (fs.existsSync(statePath)) fs.unlinkSync(statePath);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const pass = (feature, test) => results.push({ feature, test, result: 'PASS' });
const fail = (feature, test, message) => {
  results.push({ feature, test, result: `FAIL: ${message}` });
  throw new Error(`${feature}: ${message}`);
};

const js = (win, code) => win.webContents.executeJavaScript(code);
const clickText = (win, text) => js(win, `Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').includes(${JSON.stringify(text)}))?.click()`);
const clickTitle = (win, text) => js(win, `Array.from(document.querySelectorAll('button')).find((b) => (b.title || '').includes(${JSON.stringify(text)}))?.click()`);
const setInput = (win, index, value) => js(win, `{
  const input = Array.from(document.querySelectorAll('.wizard input')).filter((el) => el.type !== 'checkbox')[${index}];
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(String(value))});
  input.dispatchEvent(new Event('input', { bubbles: true }));
}`);
const setNumber = (win, index, value) => js(win, `{
  const input = Array.from(document.querySelectorAll('input[type="number"]'))[${index}];
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(String(value))});
  input.dispatchEvent(new Event('input', { bubbles: true }));
}`);
const readState = (win) => js(win, 'window.desktopAPI.loadState()');

const makeWindow = async () => {
  const win = new BrowserWindow({
    width: 1440,
    height: 940,
    show: false,
    backgroundColor: '#111916',
    webPreferences: {
      preload: path.join(root, 'scripts', 'functional-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  await win.loadFile(path.join(root, 'dist', 'index.html'));
  await wait(1200);
  return win;
};

app.whenReady().then(async () => {
  let win = await makeWindow();
  let pageText = await js(win, `document.querySelector('.page-scroll')?.textContent || ''`);
  if (pageText.includes('Demo Residential Project')) fail('Clean Profile', 'first run has no demo project', 'Demo appeared automatically');
  pass('Clean Profile', 'first run opens Home without automatic demo');

  await clickText(win, 'دراسة جديدة');
  await wait(300);
  await setInput(win, 0, 'Functional QA Study');
  await setInput(win, 1, 'Al Malqa');
  await setInput(win, 2, 'QA Owner');
  for (let i = 0; i < 4; i += 1) {
    if (i === 3) {
      await js(win, `{ const select = document.querySelector('.wizard select'); if (select) { select.value = 'RIYADH-M111'; select.dispatchEvent(new Event('change', { bubbles: true })); } }`);
      await wait(200);
    }
    await js(win, `document.querySelector('.wizard-footer .button.primary')?.click()`);
    await wait(250);
  }
  await js(win, `document.querySelector('.wizard-footer .button.primary')?.click()`);
  await wait(500);
  const wizardDebug = await js(win, `({
    text: document.querySelector('.wizard')?.textContent || '',
    inputs: Array.from(document.querySelectorAll('.wizard input')).map((input) => input.value),
    stepButtons: Array.from(document.querySelectorAll('.stepper button')).map((button) => button.className + ':' + button.textContent)
  })`);
  let state = await readState(win);
  if (state.projects.length !== 1 || state.projects[0].info.name !== 'Functional QA Study') fail('New Study', 'wizard creates project and persists state', `project was not created ${JSON.stringify(wizardDebug)}`);
  pass('New Study', 'wizard creates project and persists state');

  await setNumber(win, 0, 3000);
  await setNumber(win, 1, 30);
  await setNumber(win, 2, 100);
  await setNumber(win, 3, 30);
  await wait(350);
  state = await readState(win);
  const plot = state.projects[0].scenarios[0].plot;
  pageText = await js(win, `document.querySelector('.page-scroll')?.textContent || ''`);
  if (plot.officialArea !== 3000 || plot.length !== 30 || plot.width !== 100 || plot.boundaries[0].width !== 30 || !pageText.includes('Actual: 6 m')) fail('Plot', '30x100 street 30 calculates front setback 6m from width/5', 'plot or dynamic setback did not update');
  pass('Plot', '30x100 street 30 calculates front setback 6m from width/5');

  await clickTitle(win, 'Regulation');
  await wait(350);
  await clickText(win, 'Use');
  await wait(350);
  state = await readState(win);
  if (!state.projects[0].regulationSnapshots.length) fail('Regulation Use', 'use updates project regulation snapshot', 'no regulation snapshot found');
  pass('Regulation Use', 'use updates project regulation snapshot');
  await clickText(win, 'Custom Copy');
  await wait(350);
  await clickText(win, 'Use');
  await wait(350);
  state = await readState(win);
  if (!state.regulations.some((reg) => reg.code === 'CUSTOM') || !state.projects[0].scenarios[0].regulationId.startsWith('custom_reg_')) fail('Custom Regulation', 'custom regulation can be created saved and used', 'custom regulation was not active');
  pass('Custom Regulation', 'custom regulation can be created saved and used');
  await js(win, `{ const search = document.querySelector('.search-box input'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(search, 'M112'); search.dispatchEvent(new Event('input', { bubbles: true })); }`);
  await wait(250);
  await clickText(win, 'Use');
  await wait(350);
  await clickTitle(win, 'Plot');
  await wait(350);
  pageText = await js(win, `document.querySelector('.page-scroll')?.textContent || ''`);
  if (!pageText.includes('Actual: 6 m')) fail('Regulation Change', 'M112 width/5 min 3m regulation updates plot immediately', 'M112 setback not reflected');
  pass('Regulation Change', 'M112 width/5 min 3m regulation updates plot immediately');

  await clickTitle(win, 'Regulation');
  await wait(350);
  await js(win, `{ const search = document.querySelector('.search-box input'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(search, 'M112'); search.dispatchEvent(new Event('input', { bubbles: true })); }`);
  await wait(250);
  await js(win, `{ let calls = 0; window.prompt = () => calls++ === 0 ? '2.4' : 'حسب إفادة المشروع'; undefined; }`);
  await clickText(win, 'Details');
  await wait(250);
  await clickText(win, 'Enter FAR');
  await wait(350);
  state = await readState(win);
  const farOverride = state.projects[0].scenarios[0].overrides.find((item) => item.field === 'far');
  const packStillNull = state.regulations.find((reg) => reg.id === 'RIYADH-M112')?.far?.value === null;
  if (!farOverride || farOverride.usedValue !== '2.4' || farOverride.source !== 'USER_OVERRIDE' || !packStillNull) fail('Manual Override', 'FAR override is saved without mutating pack', 'override missing or pack mutated');
  pass('Manual Override', 'FAR override is saved without mutating pack');
  await clickText(win, 'Close');
  await wait(150);
  await clickTitle(win, 'Plot');
  await wait(250);

  await clickTitle(win, 'Financial');
  await wait(350);
  await setNumber(win, 0, 3600);
  await wait(350);
  state = await readState(win);
  if (state.projects[0].scenarios[0].financial.landPrice !== 3600) fail('Financial', 'land price updates and persists', 'land price did not update');
  pass('Financial', 'land price updates and persists');

  await clickTitle(win, 'Scenarios');
  await wait(350);
  await clickText(win, 'Duplicate Scenario');
  await wait(350);
  state = await readState(win);
  if (state.projects[0].scenarios.length !== 2 || state.projects[0].scenarios[0].id === state.projects[0].scenarios[1].id) fail('Scenarios', 'duplicate creates independent scenario', 'duplicate scenario failed');
  pass('Scenarios', 'duplicate creates independent scenario');

  await clickTitle(win, 'Company');
  await wait(350);
  await clickText(win, 'Branding');
  await wait(200);
  await clickText(win, 'Upload Logo');
  await wait(350);
  state = await readState(win);
  if (!state.company.logoDataUrl) fail('Company Logo', 'upload stores logo data url', 'logo data was not saved');
  pass('Company Logo', 'upload stores logo data url');

  await clickTitle(win, 'Reports');
  await wait(350);
  await clickText(win, 'Export Excel');
  await wait(900);
  await clickText(win, 'Export PDF');
  await wait(900);
  const xlsx = fs.readdirSync(exportDir).find((name) => name.endsWith('.xlsx') && name.includes('Functional_QA_Study'));
  const pdf = fs.readdirSync(exportDir).find((name) => name.endsWith('.pdf') && name.includes('Functional_QA_Study'));
  if (!xlsx || !pdf) fail('Reports', 'Excel and PDF files are written', 'exports were not created');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(exportDir, xlsx));
  const workbookText = wb.worksheets.flatMap((sheet) => sheet.getSheetValues().flat().map((cell) => typeof cell === 'object' && cell?.formula ? String(cell.result ?? '') : String(cell ?? ''))).join(' ');
  if (!workbookText.includes('USER_OVERRIDE') || !workbookText.includes('2.4')) fail('Reports', 'Excel includes manual override source and value', 'manual override not found in workbook');
  pass('Reports', 'Excel includes manual override source and value');
  pass('Reports', 'Excel and PDF files are written');

  await clickTitle(win, 'Settings');
  await wait(350);
  await clickText(win, 'Appearance');
  await wait(200);
  await js(win, `{ const select = Array.from(document.querySelectorAll('select')).find((el) => Array.from(el.options).some((o) => o.value === 'dark')); select.value = 'dark'; select.dispatchEvent(new Event('change', { bubbles: true })); }`);
  await wait(350);
  state = await readState(win);
  if (state.settings.theme !== 'dark') fail('Theme', 'dark mode setting persists to state', 'theme was not saved');
  pass('Theme', 'dark mode setting persists to state');

  await win.close();
  win = await makeWindow();
  const hasDark = await js(win, `document.querySelector('.app-shell.theme-dark') !== null`);
  state = await readState(win);
  const persistedOverride = state.projects[0].scenarios[0].overrides.find((item) => item.field === 'far' && item.usedValue === '2.4' && item.source === 'USER_OVERRIDE');
  if (!hasDark || state.projects[0].info.name !== 'Functional QA Study' || !persistedOverride) fail('Persistence', 'relaunch restores project dark theme and manual override', 'relaunch did not restore state');
  pass('Persistence', 'relaunch restores project dark theme and manual override');
  await win.close();

  console.table(results);
  fs.writeFileSync(path.join(exportDir, 'functional-qa-results.json'), JSON.stringify(results, null, 2), 'utf8');
  app.quit();
}).catch((error) => {
  console.error(error);
  console.table(results);
  fs.writeFileSync(path.join(exportDir, 'functional-qa-results.json'), JSON.stringify(results, null, 2), 'utf8');
  app.quit();
  process.exitCode = 1;
});
