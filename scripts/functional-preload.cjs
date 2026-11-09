const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const exportDir = path.join(root, 'qa-exports');
const statePath = path.join(exportDir, 'functional-state.json');
fs.mkdirSync(exportDir, { recursive: true });

const regulation = {
  id: 'DEMO_ONLY_RIYADH_MIXED_01',
  name: { ar: 'نظام تجريبي للتطوير المختلط', en: 'Demo Mixed-Use Development Regulation' },
  code: 'DEMO_ONLY',
  authority: { ar: 'بيانات تجريبية - ليست جهة تنظيمية', en: 'Demo data - not an authority' },
  planningZone: 'DEMO',
  city: 'Riyadh',
  version: '1.0-demo',
  effectiveDate: '2026-08-31',
  verificationDate: '2026-08-31',
  source: 'Internal demo seed',
  sourceReference: 'Demo data - not regulatory / بيانات تجريبية - ليست اشتراطات رسمية',
  verificationStatus: 'DEMO_ONLY',
  applicableUses: ['Residential Apartments', 'Residential + Retail', 'Commercial', 'Office', 'Retail + Office'],
  priority: 999,
  maxFloors: { id: 'floors', label: { ar: 'أقصى عدد أدوار', en: 'Maximum Floors' }, value: 4, source: 'Demo only', status: 'DEMO_ONLY', type: 'CALCULATION_RULE' },
  roofAnnexPercent: { id: 'roof', label: { ar: 'ملحق السطح', en: 'Roof Annex' }, value: 0.5, source: 'Demo only', status: 'DEMO_ONLY', type: 'CALCULATION_RULE' },
  coverage: { id: 'coverage', label: { ar: 'نسب التغطية', en: 'Coverage Rules' }, value: { ground: 0.6, first: 0.75, typical: 0.75, roof: 0.5 }, source: 'Demo only', status: 'DEMO_ONLY', type: 'CALCULATION_RULE' },
  far: { id: 'far', label: { ar: 'معامل البناء', en: 'FAR' }, value: 2.6, source: 'Demo only', status: 'DEMO_ONLY', type: 'CALCULATION_RULE' },
  setbacks: { id: 'setbacks', label: { ar: 'الارتدادات', en: 'Setbacks' }, value: { front: 3, right: 2, left: 2, rear: 2 }, source: 'Demo only', status: 'DEMO_ONLY', type: 'CALCULATION_RULE' },
  parking: { id: 'parking', label: { ar: 'المواقف', en: 'Parking' }, value: [{ use: 'Residential Apartments', ratio: 1.2, basis: 'unit', status: 'DEMO_ONLY' }], source: 'Demo only', status: 'DEMO_ONLY', type: 'CALCULATION_RULE' },
  notes: { ar: 'هذه حزمة تجريبية لا تمثل اشتراطات رسمية للرياض.', en: 'This demo pack is not an official Riyadh regulation.' }
};

const seed = {
  settings: { language: 'bi', reportLanguage: 'bi', theme: 'light', appLockEnabled: false, autoBackup: false, startWithWindows: false },
  company: { companyNameAr: 'شركة التطوير العقاري', companyNameEn: 'Real Estate Development Company', preparedBy: 'Mahmoud Elgamsy', reviewedBy: '', approvedBy: '', primaryColor: '#1D6B5D', secondaryColor: '#D2A84F' },
  regulations: [regulation],
  projects: []
};

let state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : seed;
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

const desktopAPI = {
  loadState: async () => state,
  saveState: async (next) => {
    state = next;
    save();
    return { ok: true };
  },
  diagnostics: async () => ({
    appVersion: '1.0 - Riyadh Edition',
    databasePath: statePath,
    userDataPath: exportDir,
    regulationPackVersion: '1.0-demo',
    reportOutputPath: exportDir,
    logPath: exportDir,
    electronVersion: process.versions.electron
  }),
  exportBackup: async (next) => {
    const target = path.join(exportDir, 'functional-backup.json');
    fs.writeFileSync(target, JSON.stringify(next, null, 2), 'utf8');
    return target;
  },
  importBackup: async () => (fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : state),
  selectLogo: async () => ({
    filePath: path.join(exportDir, 'qa-logo.svg'),
    dataUrl: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#16483D"/><path d="M18 58 42 18h42l18 40-28 10H32Z" fill="none" stroke="#D2A84F" stroke-width="8"/><rect x="52" y="36" width="14" height="24" fill="#FFFDF8"/><rect x="70" y="26" width="18" height="34" fill="#FFFDF8"/></svg>').toString('base64')
  }),
  writeExport: async (fileName, bytes) => {
    const target = path.join(exportDir, fileName);
    fs.writeFileSync(target, Buffer.from(bytes));
    return { success: true, filePath: target };
  },
  openPath: async () => undefined
};

contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);
contextBridge.exposeInMainWorld('saudiDevelopIQ', desktopAPI);
