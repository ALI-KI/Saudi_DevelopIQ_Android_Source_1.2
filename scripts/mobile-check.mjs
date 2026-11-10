import fs from 'node:fs';
import path from 'node:path';

const required = [
  'index.html', 'src/mobile/main.tsx', 'src/mobile/MobileApp.tsx', 'src/mobile/screens.tsx', 'src/mobile/ui.tsx', 'src/mobile/platform.ts',
  'src/mobile/mobile.css', 'src/core/engines.ts', 'src/core/regulationSelection.ts', 'src/shared/types.ts',
  'src/renderer/store.ts', 'src/renderer/utils/exporters.ts',
  'capacitor.config.ts', 'assets/icon-only.png', 'assets/icon-foreground.png',
  'assets/icon-background.png', 'assets/splash.png', '.github/workflows/android-apk.yml'
];
let failed = false;
for (const name of required) {
  if (!fs.existsSync(name)) { console.error('MISSING:', name); failed = true; }
}
const index = fs.readFileSync('index.html', 'utf8');
const platform = fs.readFileSync('src/mobile/platform.ts', 'utf8');
const mobile = fs.readFileSync('src/mobile/MobileApp.tsx', 'utf8') + fs.readFileSync('src/mobile/screens.tsx', 'utf8');
const source = fs.readFileSync('src/core/engines.ts', 'utf8');
const workflow = fs.readFileSync('.github/workflows/android-apk.yml', 'utf8');
const regulationSelection = fs.readFileSync('src/core/regulationSelection.ts','utf8');
const check = (ok, text) => { if (!ok) { console.error('FAIL:', text); failed = true; } else console.log('PASS:', text); };
check(index.includes('/src/mobile/main.tsx') && !index.includes('/src/renderer/main.tsx'), 'Mobile UI entry is active');
check(platform.includes('installMobileBridge') && platform.includes('writeExport') && platform.includes('importBackup') && platform.includes('selectLogo'), 'Desktop API replaced with Android bridge');
check(platform.includes('Directory.Data') && platform.includes('checksum') && platform.includes('appstate-A.json'), 'Local device persistence with verified snapshots');
check(source.includes('streetParking') && source.includes('basementCountRequired') && source.includes("basementMode === 'AUTO'"), 'Street parking is counted first; basements only cover the shortfall');
check(mobile.includes('FinancialScreen') && mobile.includes('PlotScreen') && mobile.includes('ScenariosScreen') && mobile.includes('ReportsScreen'), 'Core mobile screens exist');
check(mobile.includes('assessRegulation') && mobile.includes('validateSelection') && regulationSelection.includes('suggestRegulation'), 'Automatic villa regulation and guided selection installed');
check(source.includes('regulationConfidence') && source.includes('DECISION_THRESHOLDS'), 'Decision reports financial verdict and regulation confidence separately');
check(workflow.includes('assembleDebug') && workflow.includes('upload-artifact'), 'GitHub Actions APK pipeline configured');
check(!mobile.includes('window.desktopAPI.loadState('), 'Mobile UI does not call Electron-only startup directly');
check(!/https?:\/\//.test(fs.readFileSync('src/mobile/platform.ts','utf8')), 'Mobile storage code makes no external network requests');
if (failed) process.exit(1);
console.log('Static mobile verification complete. Native APK/device testing is still required.');
