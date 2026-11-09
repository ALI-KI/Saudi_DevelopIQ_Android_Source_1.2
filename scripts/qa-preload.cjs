const { contextBridge } = require('electron');
const fs = require('fs');
const path = require('path');

const exportDir = path.join(__dirname, '..', 'qa-exports');
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
  parking: { id: 'parking', label: { ar: 'المواقف', en: 'Parking' }, value: [{ use: 'Residential Apartments', ratio: 1.2, basis: 'unit', status: 'DEMO_ONLY' }, { use: 'Retail', ratio: 3, basis: '100sqm', status: 'DEMO_ONLY' }, { use: 'Office', ratio: 2, basis: '100sqm', status: 'DEMO_ONLY' }], source: 'Demo only', status: 'DEMO_ONLY', type: 'CALCULATION_RULE' },
  notes: { ar: 'هذه حزمة تجريبية لا تمثل اشتراطات رسمية للرياض.', en: 'This demo pack is not an official Riyadh regulation.' }
};

const scenario = {
  id: 'scenario_qa',
  name: 'S01 Base Study',
  regulationId: regulation.id,
  plot: {
    officialArea: 900,
    length: 30,
    width: 30,
    accuracy: 'Approximate',
    boundaries: [
      { side: 'front', type: 'Street', width: 20 },
      { side: 'right', type: 'Neighbor' },
      { side: 'left', type: 'Neighbor' },
      { side: 'rear', type: 'Neighbor' }
    ]
  },
  financial: {
    landPrice: 3000,
    structuralRate: 1450,
    finishingRate: 950,
    mepRate: 650,
    basementRate: 1850,
    sellingPriceResidential: 6200,
    sellingPriceRetail: 9000,
    sellingPriceOffice: 7600,
    sellableEfficiencyResidential: 0.82,
    sellableEfficiencyRetail: 0.88,
    sellableEfficiencyOffice: 0.78,
    marketingPercent: 0.015,
    salesCommissionPercent: 0.025,
    contingencyPercent: 0.06
  },
  productMix: {
    averageUnitArea: 145,
    averageVillaPlotArea: 300,
    residentialShare: 0.8,
    retailShare: 0.1,
    officeShare: 0.1
  },
  basementCount: 1,
  overrides: []
};

const state = {
  settings: { language: 'bi', reportLanguage: 'bi', theme: 'light', appLockEnabled: false, autoBackup: false, startWithWindows: false },
  company: { companyNameAr: 'شركة التطوير العقاري', companyNameEn: 'Real Estate Development Company', preparedBy: 'Mahmoud Elgamsy', reviewedBy: '', approvedBy: '', primaryColor: '#1D6B5D', secondaryColor: '#D2A84F' },
  regulations: [regulation],
  projects: [{
    info: { id: 'project_qa', name: 'QA Riyadh Mixed Study', city: 'Riyadh', district: 'Al Olaya', location: 'Riyadh', owner: 'QA Owner', use: 'Residential Apartments', status: 'In Progress', updatedAt: new Date().toISOString() },
    scenarios: [scenario],
    activeScenarioId: scenario.id,
    versions: [{ id: 'version_qa', label: 'V01 Initial Study', createdAt: new Date().toISOString() }],
    changeLog: [],
    regulationSnapshots: [regulation]
  }]
};

const desktopAPI = {
  loadState: async () => state,
  saveState: async () => ({ ok: true }),
  diagnostics: async () => ({
    appVersion: '1.0 - Riyadh Edition',
    databasePath: 'QA',
    userDataPath: 'QA',
    regulationPackVersion: '1.0-demo',
    reportOutputPath: 'QA',
    logPath: 'QA',
    electronVersion: process.versions.electron
  }),
  exportBackup: async () => 'QA backup path',
  importBackup: async () => state,
  writeExport: async (fileName, bytes) => {
    const target = path.join(exportDir, fileName);
    fs.writeFileSync(target, Buffer.from(bytes));
    return { success: true, filePath: target };
  },
  openPath: async () => undefined
};

contextBridge.exposeInMainWorld('desktopAPI', desktopAPI);
contextBridge.exposeInMainWorld('saudiDevelopIQ', desktopAPI);
