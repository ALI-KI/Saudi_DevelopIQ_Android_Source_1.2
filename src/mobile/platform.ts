/** Saudi DevelopIQ Android platform adapter.
 * Device data is kept locally in the app's sandbox, not in any cloud service.
 * Previous slot is retained until a complete new snapshot has been written.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { AppStateFile, DiagnosticsInfo, ExportWriteResult } from '../shared/types';

const native = Capacitor.isNativePlatform();
const ROOT = 'SaudiDevelopIQ';
const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
const WEB_KEY = 'saudi-developiq-mobile-v1';
type Snapshot = { schema: 1; revision: number; checksum: string; payload: string };
let currentRevision = 0;
let saveQueue: Promise<unknown> = Promise.resolve();

function checksum(input: string): string {
  // Integrity checksum (accidental corruption detection, not authentication).
  let value = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    value ^= input.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, '0');
}
function isRecord(v: unknown): v is Record<string, unknown> { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }
export function validateBackup(value: unknown): AppStateFile {
  if (!isRecord(value) || !isRecord(value.settings) || !isRecord(value.company) || !Array.isArray(value.projects) || !Array.isArray(value.regulations)) {
    throw new Error('ملف النسخة الاحتياطية غير صالح: بنية البيانات غير متوقعة.');
  }
  for (const p of value.projects) {
    if (!isRecord(p) || !isRecord(p.info) || typeof p.info.id !== 'string' || typeof p.info.name !== 'string' || !Array.isArray(p.scenarios) || !Array.isArray(p.regulationSnapshots)) {
      throw new Error('ملف النسخة الاحتياطية يحتوي على مشروع غير صالح.');
    }
  }
  for (const r of value.regulations) {
    if (!isRecord(r) || typeof r.id !== 'string' || !isRecord(r.coverage) || !isRecord(r.setbacks) || !isRecord(r.far)) {
      throw new Error('ملف النسخة الاحتياطية يحتوي على نظام بناء غير صالح.');
    }
  }
  return value as unknown as AppStateFile;
}
const slots = [`${ROOT}/appstate-A.json`, `${ROOT}/appstate-B.json`];
function parseSnapshot(raw: string): { revision: number; state: AppStateFile } | null {
  try {
    const s = JSON.parse(raw) as Snapshot;
    if (s.schema !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 1 || typeof s.payload !== 'string' || checksum(s.payload) !== s.checksum) return null;
    return { revision: s.revision, state: validateBackup(JSON.parse(s.payload)) };
  } catch { return null; }
}
async function readSnapshot(path: string): Promise<{ revision: number; state: AppStateFile } | null> {
  try {
    const item = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 });
    const raw = typeof item.data === 'string' ? item.data : await item.data.text();
    return parseSnapshot(raw);
  } catch (error) {
    const message = String(error).toLowerCase();
    if (/not.exist|not.found|enoent|missing|does not exist/.test(message)) return null;
    throw error;
  }
}
async function loadState(): Promise<AppStateFile | null> {
  if (!native) {
    const raw = localStorage.getItem(WEB_KEY);
    return raw === null ? null : validateBackup(JSON.parse(raw));
  }
  const snapshots = await Promise.all(slots.map(readSnapshot));
  const selected = snapshots.filter((s): s is { revision: number; state: AppStateFile } => s !== null).sort((a, b) => b.revision - a.revision)[0];
  if (selected) currentRevision = selected.revision;
  return selected?.state ?? null;
}
async function saveStateRaw(state: AppStateFile): Promise<void> {
  const validState = validateBackup(state);
  if (!native) { localStorage.setItem(WEB_KEY, JSON.stringify(validState)); return; }
  const payload = JSON.stringify(validState);
  const revision = currentRevision + 1;
  const snapshot: Snapshot = { schema: 1, revision, checksum: checksum(payload), payload };
  await Filesystem.writeFile({
    directory: Directory.Data,
    path: slots[revision % 2],
    data: JSON.stringify(snapshot),
    encoding: Encoding.UTF8,
    recursive: true
  });
  currentRevision = revision;
}
function saveState(state: AppStateFile): Promise<{ ok: boolean }> {
  const data = structuredClone(state);
  const next = saveQueue.catch(() => undefined).then(() => saveStateRaw(data));
  saveQueue = next;
  return next.then(() => ({ ok: true }));
}
function safeName(value: string, extension = ''): string {
  let name = value.replace(/[\\/\u0000-\u001f:*?"<>|]+/g, '_').replace(/^\.+/, '').trim().slice(0, 120) || `SaudiDevelopIQ${extension}`;
  if (extension && !name.toLowerCase().endsWith(extension)) name += extension;
  return name;
}
function b64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
function blobFrom(bytes: Uint8Array, name: string): Blob {
  const mime = name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/json';
  return new Blob([new Uint8Array(bytes)], { type: mime });
}
function webDownload(name: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(blobFrom(bytes, name));
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function showShare(name: string, path: string, directory: Directory = Directory.Data): Promise<void> {
  if (!native) return;
  const file = await Filesystem.readFile({ path, directory });
  const content = typeof file.data === 'string' ? file.data : b64(new Uint8Array(await file.data.arrayBuffer()));
  const sharePath = `${ROOT}-share-${Date.now()}-${safeName(name)}`;
  await Filesystem.writeFile({ path: sharePath, data: content, directory: Directory.Cache, recursive: true });
  const { uri } = await Filesystem.getUri({ path: sharePath, directory: Directory.Cache });
  try { await Share.share({ title: name, url: uri, dialogTitle: 'حفظ أو مشاركة الملف' }); }
  catch (err) { console.warn('Android share dialog was dismissed or unavailable:', err); }
}
async function writeExport(fileName: string, bytes: number[]): Promise<ExportWriteResult> {
  try {
    if (!Array.isArray(bytes) || !bytes.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)) throw new Error('بيانات التصدير غير صالحة.');
    const name = safeName(fileName);
    const content = Uint8Array.from(bytes);
    if (!native) { webDownload(name, content); return { success: true, filePath: name }; }
    const path = `${ROOT}/exports/${Date.now()}-${name}`;
    await Filesystem.writeFile({ directory: Directory.Data, path, data: b64(content), recursive: true });
    await showShare(name, path);
    return { success: true, filePath: path };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
function chooseFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept; input.hidden = true;
    document.body.append(input);
    const finish = (file: File | null) => { input.remove(); resolve(file); };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => finish(null), { once: true });
    input.click();
  });
}
async function exportBackup(state: AppStateFile): Promise<string> {
  const validated = validateBackup(state);
  const name = `SaudiDevelopIQ-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const contents = new TextEncoder().encode(JSON.stringify({ format: 'SaudiDevelopIQ-v1', createdAt: new Date().toISOString(), data: validated }, null, 2));
  const result = await writeExport(name, Array.from(contents));
  if (!result.success) throw new Error(result.error || 'تعذر إنشاء النسخة الاحتياطية');
  return result.filePath ?? name;
}
async function importBackup(): Promise<AppStateFile | null> {
  const file = await chooseFile('.json,application/json');
  if (!file) return null;
  if (file.size > MAX_IMPORT_BYTES) throw new Error('النسخة الاحتياطية أكبر من الحد المسموح (50 ميجابايت).');
  const parsed = JSON.parse(await file.text()) as unknown;
  const data = isRecord(parsed) && parsed.format === 'SaudiDevelopIQ-v1' ? parsed.data : parsed;
  return validateBackup(data);
}
async function selectLogo(): Promise<{ dataUrl: string; filePath: string } | null> {
  const file = await chooseFile('image/png,image/jpeg,image/webp');
  if (!file) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error('الحد الأقصى للشعار 5 ميجابايت.');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  return { dataUrl, filePath: file.name };
}
async function openPath(target: string): Promise<void> {
  if (!native) throw new Error('تم حفظ الملف في التنزيلات بالمتصفح.');
  if (!target.startsWith(`${ROOT}/exports/`)) throw new Error('فتح مجلدات النظام غير مدعوم على أندرويد. استخدم المشاركة للملفات المصدّرة.');
  await showShare(target.split('/').pop() ?? 'SaudiDevelopIQ', target);
}
async function diagnostics(): Promise<DiagnosticsInfo> {
  return {
    appVersion: '1.3.0', databasePath: `${ROOT}/appstate-A.json | appstate-B.json`,
    userDataPath: 'Android private app storage',
    regulationPackVersion: 'user-reference/demo – check source in each study',
    reportOutputPath: `${ROOT}/exports`, logPath: 'Android Logcat (no cloud logs)', electronVersion: 'Not used (Capacitor Android)'
  };
}
export function installMobileBridge(): void {
  const api: Window['desktopAPI'] = {
    loadState: loadState as Window['desktopAPI']['loadState'],
    saveState, diagnostics, exportBackup, importBackup, selectLogo, writeExport, openPath
  };
  window.desktopAPI = api;
  window.saudiDevelopIQ = api;
}
