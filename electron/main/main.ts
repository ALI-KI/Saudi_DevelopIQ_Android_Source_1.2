import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import initSqlJs, { Database } from 'sql.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let db: Database | null = null;

const appVersion = '1.0 - Riyadh Edition';
if (process.env.SAUDI_DEVELOPIQ_USER_DATA) {
  app.setPath('userData', process.env.SAUDI_DEVELOPIQ_USER_DATA);
}

const ensureDir = (target: string) => fs.mkdirSync(target, { recursive: true });
const userDataPath = () => app.getPath('userData');
const databasePath = () => path.join(userDataPath(), 'SaudiDevelopIQ.sqlite');
const reportsPath = () => path.join(userDataPath(), 'reports');
const logsPath = () => path.join(userDataPath(), 'logs');
const brandingPath = () => path.join(userDataPath(), 'branding');

const log = (message: string) => {
  try {
    ensureDir(logsPath());
    fs.appendFileSync(path.join(logsPath(), 'app.log'), `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch {
    // Logging must never stop the app from opening.
  }
};

const schema = `
CREATE TABLE IF NOT EXISTS AppState (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS Projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT, updatedAt TEXT);
CREATE TABLE IF NOT EXISTS ProjectVersions (id TEXT PRIMARY KEY, projectId TEXT, label TEXT, createdAt TEXT);
CREATE TABLE IF NOT EXISTS Scenarios (id TEXT PRIMARY KEY, projectId TEXT, name TEXT, regulationId TEXT, json TEXT);
CREATE TABLE IF NOT EXISTS PlotData (projectId TEXT PRIMARY KEY, json TEXT);
CREATE TABLE IF NOT EXISTS RegulationSnapshots (projectId TEXT, regulationId TEXT, json TEXT);
CREATE TABLE IF NOT EXISTS RegulationPacks (id TEXT PRIMARY KEY, code TEXT, version TEXT, verificationStatus TEXT, json TEXT);
CREATE TABLE IF NOT EXISTS RegulationRules (id TEXT PRIMARY KEY, regulationId TEXT, type TEXT, status TEXT, json TEXT);
CREATE TABLE IF NOT EXISTS DevelopmentResults (scenarioId TEXT PRIMARY KEY, json TEXT);
CREATE TABLE IF NOT EXISTS ParkingResults (scenarioId TEXT PRIMARY KEY, json TEXT);
CREATE TABLE IF NOT EXISTS FinancialInputs (scenarioId TEXT PRIMARY KEY, json TEXT);
CREATE TABLE IF NOT EXISTS FinancialResults (scenarioId TEXT PRIMARY KEY, json TEXT);
CREATE TABLE IF NOT EXISTS CashFlows (scenarioId TEXT, month INTEGER, json TEXT);
CREATE TABLE IF NOT EXISTS CompanyProfiles (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT);
CREATE TABLE IF NOT EXISTS Settings (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT);
CREATE TABLE IF NOT EXISTS ChangeLogs (id TEXT PRIMARY KEY, projectId TEXT, json TEXT);
CREATE TABLE IF NOT EXISTS Reports (id TEXT PRIMARY KEY, projectId TEXT, type TEXT, path TEXT, createdAt TEXT);
`;

const seedState = () => ({
  settings: {
    language: 'bi',
    reportLanguage: 'bi',
    theme: 'system',
    appLockEnabled: false,
    autoBackup: false,
    startWithWindows: false
  },
  company: {
    companyNameAr: 'شركة التطوير العقاري',
    companyNameEn: 'Real Estate Development Company',
    preparedBy: 'Mahmoud Elgamsy',
    reviewedBy: '',
    approvedBy: '',
    primaryColor: '#176B5B',
    secondaryColor: '#C8A24A'
  },
  projects: [],
  regulations: []
});

const openDatabase = async () => {
  ensureDir(userDataPath());
  ensureDir(reportsPath());
  ensureDir(logsPath());
  ensureDir(brandingPath());
  const SQL = await initSqlJs();
  const dbFile = databasePath();
  db = fs.existsSync(dbFile) ? new SQL.Database(fs.readFileSync(dbFile)) : new SQL.Database();
  db.run(schema);
  const existing = db.exec('SELECT json FROM AppState WHERE id = 1');
  if (!existing.length) {
    db.run('INSERT INTO AppState (id, json, updatedAt) VALUES (1, ?, ?)', [JSON.stringify(seedState()), new Date().toISOString()]);
    persistDatabase();
  }
};

const persistDatabase = () => {
  if (!db) return;
  fs.writeFileSync(databasePath(), Buffer.from(db.export()));
};

const createWindow = () => {
  if (!isDev) Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1120,
    minHeight: 760,
    title: 'Saudi DevelopIQ - Riyadh Edition',
    backgroundColor: '#111916',
    show: false,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  if (process.env.SAUDI_DEVELOPIQ_QA_SCRIPT) {
    mainWindow.webContents.once('did-finish-load', async () => {
      try {
        const script = fs.readFileSync(process.env.SAUDI_DEVELOPIQ_QA_SCRIPT!, 'utf8');
        const result = await mainWindow?.webContents.executeJavaScript(script, true);
        if (process.env.SAUDI_DEVELOPIQ_QA_RESULT) {
          ensureDir(path.dirname(process.env.SAUDI_DEVELOPIQ_QA_RESULT));
          fs.writeFileSync(process.env.SAUDI_DEVELOPIQ_QA_RESULT, JSON.stringify({ success: true, result }, null, 2), 'utf8');
        }
      } catch (error) {
        if (process.env.SAUDI_DEVELOPIQ_QA_RESULT) {
          ensureDir(path.dirname(process.env.SAUDI_DEVELOPIQ_QA_RESULT));
          fs.writeFileSync(process.env.SAUDI_DEVELOPIQ_QA_RESULT, JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }, null, 2), 'utf8');
        }
      } finally {
        app.quit();
      }
    });
  }
};

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

app.whenReady().then(async () => {
  await openDatabase();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch((error) => {
  log(`startup-error ${String(error)}`);
  dialog.showErrorBox('Saudi DevelopIQ', `Project could not be loaded.\n${String(error)}`);
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('state:load', () => {
  const result = db?.exec('SELECT json FROM AppState WHERE id = 1');
  return result?.[0]?.values?.[0]?.[0] ? JSON.parse(String(result[0].values[0][0])) : seedState();
});

ipcMain.handle('state:save', (_event, state) => {
  db?.run('INSERT OR REPLACE INTO AppState (id, json, updatedAt) VALUES (1, ?, ?)', [JSON.stringify(state), new Date().toISOString()]);
  db?.run('DELETE FROM Projects');
  db?.run('DELETE FROM RegulationPacks');
  for (const project of state.projects ?? []) {
    db?.run('INSERT OR REPLACE INTO Projects (id, name, status, updatedAt) VALUES (?, ?, ?, ?)', [project.info.id, project.info.name, project.info.status, project.info.updatedAt]);
  }
  for (const regulation of state.regulations ?? []) {
    db?.run('INSERT OR REPLACE INTO RegulationPacks (id, code, version, verificationStatus, json) VALUES (?, ?, ?, ?, ?)', [regulation.id, regulation.code, regulation.version, regulation.verificationStatus, JSON.stringify(regulation)]);
  }
  persistDatabase();
  return { ok: true };
});

ipcMain.handle('diagnostics', () => ({
  appVersion,
  databasePath: databasePath(),
  userDataPath: userDataPath(),
  regulationPackVersion: '1.0-demo',
  reportOutputPath: reportsPath(),
  logPath: logsPath(),
  electronVersion: process.versions.electron
}));

ipcMain.handle('backup:export', async (_event, state) => {
  const file = await dialog.showSaveDialog(mainWindow!, {
    title: 'Export Project Backup',
    defaultPath: path.join(app.getPath('documents'), 'SaudiDevelopIQ-backup.json'),
    filters: [{ name: 'Saudi DevelopIQ Backup', extensions: ['json'] }]
  });
  if (file.canceled || !file.filePath) return '';
  fs.writeFileSync(file.filePath, JSON.stringify(state, null, 2), 'utf8');
  return file.filePath;
});

ipcMain.handle('backup:import', async () => {
  const file = await dialog.showOpenDialog(mainWindow!, {
    title: 'Import Project Backup',
    filters: [{ name: 'Saudi DevelopIQ Backup', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (file.canceled || !file.filePaths[0]) return null;
  return JSON.parse(fs.readFileSync(file.filePaths[0], 'utf8'));
});

ipcMain.handle('company:selectLogo', async () => {
  const file = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Company Logo',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg'] }],
    properties: ['openFile']
  });
  if (file.canceled || !file.filePaths[0]) return null;
  const source = file.filePaths[0];
  const ext = path.extname(source).toLowerCase();
  const bytes = fs.readFileSync(source);
  if (ext === '.svg') {
    const svg = bytes.toString('utf8');
    if (/<script\b|on\w+\s*=|javascript:/i.test(svg)) {
      throw new Error('Unsafe SVG logo was rejected.');
    }
  }
  ensureDir(brandingPath());
  const target = path.join(brandingPath(), `company-logo${ext}`);
  fs.copyFileSync(source, target);
  const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return { dataUrl: `data:${mime};base64,${fs.readFileSync(target).toString('base64')}`, filePath: target };
});

ipcMain.handle('export:write', async (_event, fileName: string, bytes: number[]) => {
  try {
    const outputDir = process.env.SAUDI_DEVELOPIQ_QA_EXPORT_DIR || reportsPath();
    ensureDir(outputDir);
    if (process.env.SAUDI_DEVELOPIQ_QA_EXPORT_DIR) {
      const target = path.join(outputDir, fileName);
      fs.writeFileSync(target, Buffer.from(bytes));
      return { success: true, filePath: target };
    }
    const file = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Report',
      defaultPath: path.join(outputDir, fileName),
      filters: [
        fileName.toLowerCase().endsWith('.xlsx')
          ? { name: 'Excel Workbook', extensions: ['xlsx'] }
          : { name: 'PDF Document', extensions: ['pdf'] }
      ]
    });
    if (file.canceled || !file.filePath) return { success: false, error: 'Export cancelled' };
    fs.writeFileSync(file.filePath, Buffer.from(bytes));
    return { success: true, filePath: file.filePath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle('shell:openPath', async (_event, target: string) => {
  await shell.openPath(target);
});
