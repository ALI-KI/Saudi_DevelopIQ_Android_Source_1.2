import type { ReactNode } from 'react';
import { AlertCircle, BookOpen, Building2, Plus } from 'lucide-react';
import type { LanguageMode, ProjectRecord, ProjectUse, Scenario } from '../shared/types';
import { useAppStore } from '../renderer/store';

export type Screen = 'home' | 'overview' | 'plot' | 'regulations' | 'development' | 'parking' | 'financial' | 'scenarios' | 'reports' | 'company' | 'backup' | 'settings' | 'about';
export type LocalText = { ar: string; en: string };
export type Toast = (message: string, error?: boolean) => void;
export const uses: ProjectUse[] = ['Residential Villas', 'Residential Apartments', 'Residential + Retail', 'Retail', 'Office', 'Retail + Office', 'Commercial', 'Manual / Custom Study'];
export const useLabels: Record<string, string> = {
  'Residential Villas': 'فلل سكنية', 'Residential Apartments': 'عمارة شقق سكنية', 'Residential + Retail': 'سكني + تجاري',
  'Retail': 'تجاري (محلات)', 'Office': 'مكاتب', 'Retail + Office': 'تجاري + مكاتب', 'Commercial': 'تجاري عام', 'Manual / Custom Study': 'دراسة مخصصة'
};
export const sideLabels = { front: 'أمامي', rear: 'خلفي', left: 'أيسر', right: 'أيمن' } as const;
export const floorLabel = (floor: string) => floor === 'ground' ? 'الدور الأرضي' : floor === 'first' ? 'الدور الأول' : floor === 'roof annex' ? 'الملحق العلوي' : floor.startsWith('typical') ? `دور متكرر ${floor.replace('typical ', '')}` : floor;
export const unit = (n: number, digits = 0) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
export const cash = (n: number) => `${unit(n)} ر.س`;
export const compact = (n: number) => Math.abs(n) >= 1e6 ? `${unit(n / 1e6, 2)} مليون` : Math.abs(n) >= 1000 ? `${unit(n / 1000, 1)} ألف` : unit(n);
export const pct = (n: number) => `${unit(n * 100, 1)}%`;
export const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export const t = (lang: LanguageMode, v: LocalText) => lang === 'en' ? v.en : v.ar;
export function Text({ ar, en }: LocalText) { const lang = useAppStore((s) => s.settings.language); return <span className="text-pair"><span>{t(lang, { ar, en })}</span>{lang === 'bi' && <small lang="en">{en}</small>}</span>; }
export function Section({ title, children, action, detail }: { title: LocalText; children: ReactNode; action?: ReactNode; detail?: string }) { return <section className="m-card"><header className="card-heading"><div><h2><Text {...title} /></h2>{detail && <p>{detail}</p>}</div>{action}</header>{children}</section>; }
export function Stat({ label, value, tone }: { label: LocalText; value: string; tone?: 'success' | 'danger' | 'gold' }) { return <div className={`stat ${tone || ''}`}><span className="stat-label"><Text {...label} /></span><strong dir="ltr">{value}</strong></div>; }
export function Btn({ children, onClick, secondary = false, disabled = false, className = '' }: { children: ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean; className?: string }) { return <button className={`m-button ${secondary ? 'secondary' : ''} ${className}`} disabled={disabled} onClick={onClick}>{children}</button>; }
export function Num({ label, value, onChange, suffix, max, min = 0, step = 'any', hint }: { label: LocalText; value: number | undefined; onChange: (n: number) => void; suffix?: string; max?: number; min?: number; step?: string; hint?: string }) {
  return <label className="m-field"><span className="field-label"><Text {...label} /></span><span className="input-shell"><input inputMode="decimal" type="number" min={min} max={max} step={step} value={value ?? ''} onChange={(e) => { if (e.target.value !== '') { const n = Number(e.target.value); if (Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onChange(n); } else onChange(0); }} />{suffix && <em>{suffix}</em>}</span>{hint && <small className="field-hint">{hint}</small>}</label>;
}
export function Input({ label, value, onChange, placeholder }: { label: LocalText; value: string; onChange: (v: string) => void; placeholder?: string }) { return <label className="m-field"><span className="field-label"><Text {...label} /></span><input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>; }
export function Select({ label, value, items, onChange }: { label: LocalText; value: string; items: { value: string; text: string }[]; onChange: (v: string) => void }) { return <label className="m-field"><span className="field-label"><Text {...label} /></span><select value={value} onChange={(e) => onChange(e.target.value)}>{items.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}</select></label>; }
export function Alert({ children, danger = false }: { children: ReactNode; danger?: boolean }) { return <div className={`m-alert ${danger ? 'danger' : ''}`}><AlertCircle size={18} aria-hidden="true" /><span>{children}</span></div>; }
export function NoStudy({ openNew }: { openNew: () => void }) { return <div className="empty"><Building2 size={42} /><h2>ابدأ بأول دراسة تطوير عقاري</h2><p>أدخل بيانات الأرض وشوارعها، والتطبيق يحسب المسطحات والمواقف والجدوى.</p><Btn onClick={openNew}><Plus size={18} /> دراسة جديدة</Btn></div>; }
export function findContext() {
  const s = useAppStore.getState();
  const project = s.projects.find((p) => p.info.id === s.activeProjectId) ?? s.projects[0] ?? null;
  const scenario = project?.scenarios.find((v) => v.id === project.activeScenarioId) ?? project?.scenarios[0] ?? null;
  const regulation = scenario ? project?.regulationSnapshots.find((r) => r.id === scenario.regulationId) ?? s.regulations.find((r) => r.id === scenario.regulationId) ?? null : null;
  return { project, scenario, regulation };
}
export function changeScenario(transform: (s: Scenario) => Scenario) {
  const s = useAppStore.getState(); const { project, scenario } = findContext();
  if (!project || !scenario) return;
  s.updateProject({ ...project, scenarios: project.scenarios.map((v) => v.id === scenario.id ? transform(v) : v) });
}
export function changeProject(transform: (p: ProjectRecord) => ProjectRecord) {
  const s = useAppStore.getState(); const { project } = findContext();
  if (project) s.updateProject(transform(project));
}
export function setOverride(field: string, value: number) {
  changeScenario((s) => ({ ...s, overrides: [
    ...s.overrides.filter((o) => o.field !== field),
    { id: id('override'), field, originalValue: '', usedValue: String(value), reason: 'قيمة مدخلة من المستخدم', source: 'USER_OVERRIDE' as const, createdAt: new Date().toISOString() }
  ] }));
}
export function clearOverride(field: string) { changeScenario((s) => ({ ...s, overrides: s.overrides.filter((o) => o.field !== field) })); }
export function overrideValue(scenario: Scenario, field: string): number | undefined { const o = scenario.overrides.find((v) => v.field === field); return o ? Number(o.usedValue) : undefined; }
export function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong dir="auto">{value}</strong></div>; }
export function NoRegulation({ navigate }: { navigate: (s: Screen) => void }) { return <div className="empty"><BookOpen size={38}/><h2>اختر نظام البناء لهذه الأرض</h2><p>أدخل مساحة الأرض وشوارعها أولًا. الفلل على شوارع أقل من 30م تأخذ نظامها تلقائيًا، وباقي الحالات تختار نظامها من القائمة.</p><div className="actions-row"><Btn secondary onClick={() => navigate('plot')}>بيانات الأرض</Btn><Btn onClick={() => navigate('regulations')}>اختيار النظام</Btn></div></div>; }
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) { return <div className="segmented" role="tablist">{options.map((o) => <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>; }
