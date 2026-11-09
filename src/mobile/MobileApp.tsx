import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  AlertCircle, ArrowLeft, ArrowRight, BarChart3, BookOpen, Building2, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Copy, Download, FileSpreadsheet, FileText, FolderOpen, Gauge, Home, Info, Landmark,
  Layers, Menu, MoreHorizontal, ParkingCircle, Plus, RefreshCcw, Save, Search, Settings, Share2, ShieldAlert,
  SlidersHorizontal, Trash2, Upload, Wallet, X
} from 'lucide-react';
import { runScenario } from '../core/engines';
import { assessRegulation, evidenceValid, parcelKey, plotSignature, validateEvidence } from '../core/regulationSelection';
import { defaultFinancial, defaultProductMix } from '../shared/defaults';
import type { AppStateFile, FinancialInputs, LanguageMode, PlotData, ProjectRecord, ProjectUse, RegulationPack, RegulationSelectionEvidence, Scenario, ScenarioResult } from '../shared/types';
import { useAppStore } from '../renderer/store';
import { exportExcel, exportPdf } from '../renderer/utils/exporters';

const iconUrl = new URL('../../assets/brand/developiq-app-icon.png', import.meta.url).href;
type Screen = 'home' | 'overview' | 'plot' | 'regulations' | 'development' | 'parking' | 'financial' | 'scenarios' | 'reports' | 'company' | 'backup' | 'settings' | 'about';
type LocalText = { ar: string; en: string };
type Notice = { message: string; error?: boolean } | null;
const names: Record<Screen, LocalText> = {
  home: { ar: 'الرئيسية', en: 'Home' }, overview: { ar: 'ملخص الدراسة', en: 'Overview' }, plot: { ar: 'بيانات الأرض', en: 'Plot' },
  regulations: { ar: 'أنظمة البناء', en: 'Regulations' }, development: { ar: 'التطوير', en: 'Development' },
  parking: { ar: 'المواقف', en: 'Parking' }, financial: { ar: 'الجدوى المالية', en: 'Financial' },
  scenarios: { ar: 'السيناريوهات', en: 'Scenarios' }, reports: { ar: 'التقارير', en: 'Reports' },
  company: { ar: 'الشركة', en: 'Company' }, backup: { ar: 'النسخ الاحتياطي', en: 'Backup' },
  settings: { ar: 'الإعدادات', en: 'Settings' }, about: { ar: 'عن التطبيق', en: 'About' }
};
const uses: ProjectUse[] = ['Residential Apartments', 'Residential Villas', 'Residential + Retail', 'Retail', 'Office', 'Retail + Office', 'Commercial', 'Manual / Custom Study'];
const unit = (n: number, digits = 0) => Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: digits }) : '—';
const cash = (n: number) => `${unit(n)} ر.س`;
const compact = (n: number) => Math.abs(n) >= 1e6 ? `${unit(n / 1e6, 2)} مليون` : Math.abs(n) >= 1000 ? `${unit(n / 1000, 1)} ألف` : unit(n);
const pct = (n: number) => `${unit(n * 100, 1)}%`;
const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const t = (lang: LanguageMode, v: LocalText) => lang === 'en' ? v.en : v.ar;
function Text({ ar, en }: LocalText) { const lang = useAppStore((s) => s.settings.language); return <span className="text-pair"><span>{t(lang, { ar, en })}</span>{lang === 'bi' && <small lang="en">{en}</small>}</span>; }
function Section({ title, children, action, detail }: { title: LocalText; children: ReactNode; action?: ReactNode; detail?: string }) { return <section className="m-card"><header className="card-heading"><div><h2><Text {...title} /></h2>{detail && <p>{detail}</p>}</div>{action}</header>{children}</section>; }
function Stat({ label, value, tone }: { label: LocalText; value: string; tone?: 'success' | 'danger' | 'gold' }) { return <div className={`stat ${tone || ''}`}><span className="stat-label"><Text {...label} /></span><strong dir="ltr">{value}</strong></div>; }
function Btn({ children, onClick, secondary = false, disabled = false, className = '' }: { children: ReactNode; onClick: () => void; secondary?: boolean; disabled?: boolean; className?: string }) { return <button className={`m-button ${secondary ? 'secondary' : ''} ${className}`} disabled={disabled} onClick={onClick}>{children}</button>; }
function Num({ label, value, onChange, suffix, max, min = 0, step = 'any', hint }: { label: LocalText; value: number | undefined; onChange: (n: number) => void; suffix?: string; max?: number; min?: number; step?: string; hint?: string }) {
  return <label className="m-field"><span className="field-label"><Text {...label} /></span><span className="input-shell"><input inputMode="decimal" type="number" min={min} max={max} step={step} value={value ?? ''} onChange={(e) => { if (e.target.value !== '') { const n = Number(e.target.value); if (Number.isFinite(n) && n >= min && (max === undefined || n <= max)) onChange(n); } else onChange(0); }} />{suffix && <em>{suffix}</em>}</span>{hint && <small className="field-hint">{hint}</small>}</label>;
}
function Input({ label, value, onChange, placeholder }: { label: LocalText; value: string; onChange: (v: string) => void; placeholder?: string }) { return <label className="m-field"><span className="field-label"><Text {...label} /></span><input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /></label>; }
function Select({ label, value, items, onChange }: { label: LocalText; value: string; items: { value: string; text: string }[]; onChange: (v: string) => void }) { return <label className="m-field"><span className="field-label"><Text {...label} /></span><select value={value} onChange={(e) => onChange(e.target.value)}>{items.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}</select></label>; }
function Alert({ children, danger = false }: { children: ReactNode; danger?: boolean }) { return <div className={`m-alert ${danger ? 'danger' : ''}`}><AlertCircle size={18} aria-hidden="true" /><span>{children}</span></div>; }
function NoStudy({ openNew }: { openNew: () => void }) { return <div className="empty"><Building2 size={42} /><h2>ابدأ بأول دراسة تطوير عقاري</h2><p>أنشئ مشروعًا جديدًا ثم أدخل المساحة والاشتراطات والتكاليف الفعلية.</p><Btn onClick={openNew}><Plus size={18} /> دراسة جديدة</Btn></div>; }
function findContext() {
  const s = useAppStore.getState();
  const project = s.projects.find((p) => p.info.id === s.activeProjectId) ?? s.projects[0] ?? null;
  const scenario = project?.scenarios.find((v) => v.id === project.activeScenarioId) ?? project?.scenarios[0] ?? null;
  const regulation = scenario ? project?.regulationSnapshots.find((r) => r.id === scenario.regulationId) ?? s.regulations.find((r) => r.id === scenario.regulationId) ?? null : null;
  return { project, scenario, regulation };
}
function changeScenario(transform: (s: Scenario) => Scenario) {
  const s = useAppStore.getState(); const { project, scenario } = findContext();
  if (!project || !scenario) return;
  s.updateProject({ ...project, scenarios: project.scenarios.map((v) => v.id === scenario.id ? transform(v) : v) });
}
function changeProject(transform: (p: ProjectRecord) => ProjectRecord) {
  const s = useAppStore.getState(); const { project } = findContext();
  if (project) s.updateProject(transform(project));
}
function setOverride(field: string, value: number) {
  changeScenario((s) => ({ ...s, overrides: [
    ...s.overrides.filter((o) => o.field !== field),
    { id: id('override'), field, originalValue: '', usedValue: String(value), reason: 'تم إدخال القيمة في تطبيق أندرويد', source: 'USER_OVERRIDE' as const, createdAt: new Date().toISOString() }
  ] }));
}
function Chart({ rows }: { rows: { month: number; cumulative: number }[] }) {
  if (!rows.length) return null;
  const values = rows.map((r) => r.cumulative);
  const low = Math.min(0, ...values), high = Math.max(1, ...values), span = high - low;
  const points = rows.map((r, i) => `${(i / Math.max(1, rows.length - 1) * 320).toFixed(1)},${(100 - ((r.cumulative - low) / span) * 90 - 5).toFixed(1)}`).join(' ');
  const zero = 100 - (0 - low) / span * 90 - 5;
  return <div className="flow-chart"><svg role="img" aria-label="مخطط التدفق النقدي التراكمي خلال فترة المشروع" viewBox="0 0 320 116" preserveAspectRatio="none"><line x1="0" x2="320" y1={zero} y2={zero} stroke="#b6c9c2" strokeDasharray="5 5" /><polyline points={points} fill="none" stroke="#1c806a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg><div className="chart-axis"><span>الشهر 1</span><span>الشهر {rows.length}</span></div></div>;
}
function PlotSketch({ area, length, width, setback }: { area: number; length: number; width: number; setback?: ScenarioResult['envelope']['setbacks'] }) {
  return <div className="plot-sketch"><div className="plot-street">شارع / Street</div><div className="plot-boundary"><span className="plot-dim x">{unit(width)} م</span><div className="plot-inside"><div className="plot-buildable">مساحة البناء المبدئية<br /><strong dir="ltr">{unit(area)} m²</strong></div></div><span className="plot-dim y">{unit(length)} م</span></div><div className="plot-legend">{setback ? `ارتدادات: أمامي ${setback.front ?? '؟'}م · خلفي ${setback.rear ?? '؟'}م · جانبي ${setback.left ?? '؟'}م / ${setback.right ?? '؟'}م` : 'الرسم تخطيطي وغير صالح للأبعاد التنفيذية'}</div></div>;
}

export function MobileApp() {
  const store = useAppStore();
  const [starting, setStarting] = useState(true);
  const [initialError, setInitialError] = useState('');
  const [menu, setMenu] = useState(false);
  const [wizard, setWizard] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [regEdit, setRegEdit] = useState<string | null>(null);
  const lang = store.settings.language;
  const screen = (names[store.activeView as Screen] ? store.activeView : 'home') as Screen;
  const project = store.projects.find((p) => p.info.id === store.activeProjectId) ?? store.projects[0] ?? null;
  const scenario = project?.scenarios.find((s) => s.id === project.activeScenarioId) ?? project?.scenarios[0] ?? null;
  const regulation = scenario ? project?.regulationSnapshots.find((r) => r.id === scenario.regulationId) ?? store.regulations.find((r) => r.id === scenario.regulationId) ?? null : null;
  const result = useMemo(() => scenario && regulation ? runScenario(scenario, regulation) : null, [scenario, regulation]);
  const toast = (message: string, error = false) => { setNotice({ message, error }); window.setTimeout(() => setNotice((v) => v?.message === message ? null : v), 4200); };
  useEffect(() => {
    let alive = true;
    useAppStore.getState().load().catch((e) => { if (alive) setInitialError(String(e)); }).finally(() => { if (alive) setStarting(false); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let disposed = false;
    let listener: { remove: () => Promise<void> } | null = null;
    void CapacitorApp.addListener('backButton', () => {
      if (regEdit) setRegEdit(null);
      else if (wizard) setWizard(false);
      else if (menu) setMenu(false);
      else if (screen !== 'home') store.setActiveView('home');
      else void CapacitorApp.minimizeApp();
    }).then((v) => { if (disposed) void v.remove(); else listener = v; });
    return () => { disposed = true; if (listener) void listener.remove(); };
  }, [regEdit, wizard, menu, screen, store.setActiveView]);
  useEffect(() => { document.documentElement.lang = lang === 'en' ? 'en' : 'ar'; document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl'; }, [lang]);
  const navigate = (s: Screen) => { setMenu(false); setRegEdit(null); store.setActiveView(s); document.getElementById('mobile-scroll')?.scrollTo({ top: 0, behavior: 'instant' }); };
  if (starting || !store.hydrated) return <div className="loading-page"><img src={iconUrl} alt="Saudi DevelopIQ" /><h1>Saudi DevelopIQ</h1><p>{initialError || 'جارٍ تحميل بيانات الدراسات من الجهاز…'}</p>{initialError && <button onClick={() => window.location.reload()}>إعادة المحاولة</button>}</div>;
  const requiresStudy = ['overview', 'plot', 'development', 'parking', 'financial', 'scenarios', 'reports'].includes(screen);
  return <div className={`mobile-root theme-${store.settings.theme}`} dir={lang === 'en' ? 'ltr' : 'rtl'}>
    <header className="app-header"><button className="brand-mini" aria-label="الرئيسية" onClick={() => navigate('home')}><img src={iconUrl} alt="" /><span>Develop<span className="gold">IQ</span><small>RIYADH EDITION</small></span></button><div className="header-right"><button className="head-action" title="دراسة جديدة" aria-label="دراسة جديدة" onClick={() => setWizard(true)}><Plus size={20} /></button><button className="head-action" title="قائمة الصفحات" aria-label="قائمة الصفحات" onClick={() => setMenu(true)}><Menu size={21} /></button></div></header>
    <div className="page-title"><div><small>SAUDI DEVELOP<span className="gold">IQ</span> / {names[screen].en}</small><h1><Text {...names[screen]} /></h1>{project && screen !== 'home' && <p className="sub-project">{project.info.name} · {project.info.district}</p>}</div>{project && screen !== 'home' && <button className="outline-mini" onClick={() => navigate('home')}><FolderOpen size={16} /></button>}</div>
    <main id="mobile-scroll" className="mobile-scroll"><div className="page-container">
      {store.storageError && <Alert danger>تعذر حفظ آخر التغييرات: {store.storageError}. أنشئ نسخة احتياطية بعد معالجة المشكلة.</Alert>}
      {requiresStudy && !project ? <NoStudy openNew={() => setWizard(true)} /> :
       screen === 'home' ? <HomeScreen project={project} navigate={navigate} openNew={() => setWizard(true)} /> :
       screen === 'company' ? <CompanyScreen toast={toast} /> :
       screen === 'settings' ? <SettingsScreen /> :
       screen === 'about' ? <AboutScreen /> :
       screen === 'backup' ? <BackupScreen toast={toast} /> :
       screen === 'regulations' ? <RegulationsScreen project={project} onEdit={setRegEdit} toast={toast} /> :
       project && scenario && screen === 'plot' ? <PlotScreen project={project} scenario={scenario} result={result} navigate={navigate} /> :
       project && scenario && screen === 'overview' ? <OverviewScreen result={result} regulation={regulation} navigate={navigate} /> :
       project && scenario && screen === 'development' ? <DevelopmentScreen scenario={scenario} result={result} regulation={regulation} navigate={navigate} /> :
       project && scenario && screen === 'parking' ? <ParkingScreen scenario={scenario} result={result} navigate={navigate} /> :
       project && scenario && screen === 'financial' ? <FinancialScreen scenario={scenario} result={result} navigate={navigate} /> :
       project && screen === 'scenarios' ? <ScenariosScreen project={project} navigate={navigate} toast={toast} /> :
       project && screen === 'reports' ? <ReportsScreen project={project} regulation={regulation} result={result} toast={toast} /> :
       <NoStudy openNew={() => setWizard(true)} /> }
      <div className="bottom-spacer" />
    </div></main>
    <nav className="bottom-nav" aria-label="القائمة الرئيسية">{([
      ['home', Home, 'الرئيسية', 'Home'], ['plot', Landmark, 'الأرض', 'Plot'], ['development', Layers, 'التطوير', 'Build'],
      ['financial', Wallet, 'المالية', 'Finance']
    ] as const).map(([v, Icon, ar, en]) => <button className={screen === v ? 'selected' : ''} key={v} onClick={() => navigate(v)}><Icon size={21} /><span>{lang === 'en' ? en : ar}</span></button>)}<button className={menu || !['home','plot','development','financial'].includes(screen) ? 'selected' : ''} onClick={() => setMenu(true)}><MoreHorizontal size={22} /><span>{lang === 'en' ? 'More' : 'المزيد'}</span></button></nav>
    {menu && <div className="overlay" onClick={() => setMenu(false)}><div className="menu-sheet" onClick={(e) => e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><strong>صفحات التطبيق</strong><button onClick={() => setMenu(false)} aria-label="إغلاق"><X size={20}/></button></div><div className="sheet-grid">{([
      ['overview', Gauge], ['regulations', BookOpen], ['parking', ParkingCircle], ['scenarios', Copy], ['reports', FileText], ['company', Building2], ['backup', RefreshCcw], ['settings', Settings], ['about', Info]
    ] as const).map(([key, Icon]) => <button key={key} onClick={() => navigate(key)}><Icon size={20} /><Text {...names[key]} /></button>)}</div></div></div>}
    {wizard && <NewProjectModal close={() => setWizard(false)} navigate={navigate} toast={toast} />}
    {regEdit && <RegulationEditor idValue={regEdit} close={() => setRegEdit(null)} toast={toast} />}
    {notice && <div role="status" className={`m-toast ${notice.error ? 'is-error' : ''}`}>{notice.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}{notice.message}</div>}
  </div>;
}

function HomeScreen({ project, navigate, openNew }: { project: ProjectRecord | null; navigate: (s: Screen) => void; openNew: () => void }) {
  const store = useAppStore();
  return <div className="stack">
    <section className="hero"><div className="hero-watermark">IQ</div><span className="hero-eyebrow">REAL ESTATE INTELLIGENCE</span><h2>من الأرض<br /><span>إلى قرار التطوير</span></h2><p>دراسة البناء والمواقف والجدوى المالية في مكان واحد — بياناتك محفوظة محليًا على جهازك.</p><Btn onClick={openNew}><Plus size={19}/> إنشاء دراسة جديدة</Btn></section>
    {project && <Section title={{ ar: 'الدراسة الحالية', en: 'Current Study' }} action={<button className="text-link" onClick={() => navigate('overview')}>عرض التفاصيل <ChevronLeft size={16}/></button>}><div className="current-study"><div className="study-icon"><Building2/></div><div><strong>{project.info.name}</strong><small>{project.info.district} · {project.info.use}</small></div></div><div className="chip">{project.scenarios.length} سيناريو</div></Section>}
    <Section title={{ ar: 'الدراسات المحفوظة', en: 'Saved Studies' }}><div className="study-list">{store.projects.length === 0 ? <div className="empty-inline">لا توجد دراسات حتى الآن. استخدم زر «إنشاء دراسة جديدة» للبدء.</div> : store.projects.map((p) => <button className="study-row" key={p.info.id} onClick={() => { store.setActiveProject(p.info.id); navigate('overview'); }}><div className="study-icon"><Building2 size={19} /></div><div><strong>{p.info.name}</strong><small>{p.info.district} · {new Date(p.info.updatedAt).toLocaleDateString('ar-SA')}</small></div><ChevronLeft size={19}/></button>)}</div></Section>
    <div className="two-actions"><button onClick={() => navigate('regulations')}><BookOpen/><strong>أنظمة البناء</strong><span>مصادر وافتراضات</span></button><button onClick={() => navigate('backup')}><ShieldAlert/><strong>النسخ الاحتياطي</strong><span>تصدير واستعادة</span></button></div>
    <Alert>القيم التنظيمية في المكتبة مراجع أو بيانات تجريبية؛ لا تُعد موافقة رسمية على تطوير قطعة أرض.</Alert>
  </div>;
}
function NewProjectModal({ close, navigate, toast }: { close: () => void; navigate: (s: Screen) => void; toast: (v: string, error?: boolean) => void }) {
  const store = useAppStore();
  const [name, setName] = useState(''); const [district, setDistrict] = useState(''); const [owner, setOwner] = useState('');
  const [use, setUse] = useState<ProjectUse>('Residential Apartments');
  const ready = name.trim().length > 1 && district.trim().length > 1;
  const create = () => { if (!ready) return; store.createProject({ name: name.trim(), district: district.trim(), owner: owner.trim(), use }); close(); navigate('plot'); toast('تم إنشاء الدراسة دون نظام بناء. أدخل بيانات القطعة ثم راجع الأنظمة المرشحة.'); };
  return <div className="modal-overlay"><div className="modal-panel"><div className="modal-title"><div><small>NEW FEASIBILITY STUDY</small><h2>دراسة تطوير جديدة</h2></div><button className="icon-btn" onClick={close}><X/></button></div><div className="modal-scroller"><div className="form-grid"><Input label={{ ar: 'اسم الدراسة', en: 'Project Name' }} value={name} onChange={setName} placeholder="مثال: مشروع النرجس السكني" /><Input label={{ ar: 'الحي', en: 'District' }} value={district} onChange={setDistrict} /><Input label={{ ar: 'المالك (اختياري)', en: 'Owner (Optional)' }} value={owner} onChange={setOwner} /><Select label={{ ar: 'نوع التطوير', en: 'Development Use' }} value={use} onChange={(v) => setUse(v as ProjectUse)} items={uses.map((v) => ({ value: v, text: v }))} /></div><Alert>لن يُختار نظام بناء عند إنشاء الدراسة. الخطوة التالية هي تحديد القطعة ثم مقارنة الاشتراطات المرشحة وتوثيق سبب انطباق النظام.</Alert></div><div className="modal-footer"><Btn secondary onClick={close}>إلغاء</Btn><Btn disabled={!ready} onClick={create}>إنشاء الدراسة وتحديد الأرض <ArrowLeft size={17}/></Btn></div></div></div>;
}
function OverviewScreen({ result, regulation, navigate }: { result: ScenarioResult | null; regulation: RegulationPack | null; navigate: (s: Screen) => void }) {
  if (!result || !regulation) return <NoRegulation navigate={navigate} />;
  const r = result;
  return <div className="stack"><div className="stats-grid"><Stat label={{ ar: 'مساحة الأرض', en: 'Plot Area' }} value={`${unit(r.envelope.plotArea)} m²`} /><Stat label={{ ar: 'المسطحات البنائية', en: 'Built-Up Area' }} value={`${unit(r.envelope.achievedGfa)} m²`} /><Stat label={{ ar: 'المساحة البيعية', en: 'Sellable Area' }} value={`${unit(r.outputs.sellableResidential + r.outputs.sellableRetail + r.outputs.sellableOffice)} m²`} /><Stat label={{ ar: 'الربح المتوقع', en: 'Profit' }} value={compact(r.financial.profit)} tone={r.financial.profit < 0 ? 'danger' : 'success'} /></div>
    <section className={`decision-card ${r.decision.status === 'PROCEED' ? 'positive' : ''}`}><small>DEVELOPMENT DECISION / قرار التطوير</small><h2>{r.decision.label.ar}</h2><p>{r.decision.reasons.map((a) => a.ar).join(' · ')}</p><div className="decision-foot"><span>ROI: <b dir="ltr">{pct(r.financial.roi)}</b></span><span>{r.parking.status === 'OK' ? 'المواقف كافية تقديريًا' : 'المواقف تتطلب مراجعة'}</span></div></section>
    <Section title={{ ar: 'مؤشرات الدراسة', en: 'Study Metrics' }}><div className="metric-list"><Metric label="معامل البناء المستغل" value={unit(r.envelope.achievedFar,2)} /><Metric label="نسبة الاستفادة من FAR" value={pct(r.envelope.farUtilization)} /><Metric label="الوحدات المقترحة" value={unit(r.outputs.units)} /><Metric label="الأدوار المحسوبة" value={unit(r.envelope.floorAreas.filter((v) => v.floor !== 'roof annex').length)} /><Metric label="المواقف المطلوبة" value={unit(r.parking.requiredSpaces)} /><Metric label="الأقبية المقدمة" value={unit(r.parking.providedBasements)} /></div></Section>
    <Section title={{ ar: 'حالة الاشتراطات', en: 'Regulation Status' }}><div className="source-line"><BookOpen size={20}/><div><strong>{regulation.name.ar}</strong><small>{regulation.code} · {regulation.verificationStatus} · {regulation.version}</small></div></div>{r.envelope.warnings.map((w, i) => <div className="warning-row" key={i}><AlertCircle size={15}/>{w}</div>)}<Btn secondary className="full" onClick={() => navigate('regulations')}>مراجعة أنظمة البناء</Btn></Section>
  </div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong dir="ltr">{value}</strong></div>; }
function NoRegulation({ navigate }: { navigate: (s: Screen) => void }) { return <div className="empty"><BookOpen size={38}/><h2>نظام البناء غير محدد لهذه الأرض</h2><p>أدخل بيانات القطعة، ثم قارن الأنظمة المحتملة ووثّق انطباق النظام بمستند مرتبط بالموقع.</p><Btn onClick={() => navigate('regulations')}>مكتبة الأنظمة</Btn></div>; }

function PlotScreen({ project, scenario, result, navigate }: { project: ProjectRecord; scenario: Scenario; result: ScenarioResult | null; navigate: (s: Screen)=>void }) {
  const plot = scenario.plot;
  const updatePlot = (patch: Partial<PlotData>) => changeScenario((s) => ({ ...s, plot: { ...s.plot, ...patch } }));
  return <div className="stack"><Section title={{ ar: 'تحديد القطعة قبل اختيار النظام', en: 'Parcel Identification' }} detail="لا يمكن تحديد النظام المنطبق من اسم الحي فقط"><div className="form-grid">
      <Input label={{ar:'رقم المخطط',en:'Plan Number'}} value={project.info.planNumber??''} onChange={v=>changeProject(p=>({...p,info:{...p.info,planNumber:v}}))}/>
      <Input label={{ar:'رقم القطعة',en:'Plot Number'}} value={project.info.plotNumber??''} onChange={v=>changeProject(p=>({...p,info:{...p.info,plotNumber:v}}))}/>
      <Input label={{ar:'رقم الصك أو مرجع بديل',en:'Deed Reference'}} value={project.info.deedNumber??''} onChange={v=>changeProject(p=>({...p,info:{...p.info,deedNumber:v}}))}/>
      <Input label={{ar:'رابط الموقع (اختياري)',en:'Location URL'}} value={project.info.location??''} onChange={v=>changeProject(p=>({...p,info:{...p.info,location:v}}))}/>
    </div><Alert>بيانات القطعة وتوثيق اشتراطها مطلوبة. أي تغيير في تعريف القطعة أو حدودها يلغي صلاحية مراجعة الانطباق السابقة تلقائيًا.</Alert><Btn secondary onClick={()=>navigate('regulations')}>انتقل لمقارنة أنظمة البناء <BookOpen size={17}/></Btn></Section><Section title={{ ar: 'أبعاد ومساحة الأرض', en: 'Plot Dimensions' }} detail="أدخل الأرقام كما هي في الصك أو الرفع المساحي"><div className="form-grid"><Num label={{ ar: 'المساحة حسب الصك', en: 'Official Plot Area' }} value={plot.officialArea} suffix="م²" onChange={(officialArea) => updatePlot({ officialArea })} /><Num label={{ ar: 'طول الأرض', en: 'Length' }} value={plot.length} suffix="م" onChange={(length) => updatePlot({ length })} /><Num label={{ ar: 'عرض واجهة الأرض', en: 'Front Width' }} value={plot.width} suffix="م" onChange={(width) => updatePlot({ width })} /><Select label={{ ar: 'دقة البيانات', en: 'Input Accuracy' }} value={plot.accuracy} onChange={(v) => updatePlot({ accuracy: v as PlotData['accuracy'] })} items={[{ value: 'Exact', text: 'دقيق من الرفع المساحي' }, { value: 'Approximate', text: 'تقريبي' }, { value: 'Area Only', text: 'المساحة فقط' }]} /></div>{plot.length && plot.width && Math.abs(plot.length * plot.width - plot.officialArea) > 1 ? <Alert danger>يوجد فرق بين المساحة حسب الصك ({unit(plot.officialArea)} م²) والمساحة المحسوبة ({unit(plot.length * plot.width)} م²).</Alert> : null}</Section>
    <Section title={{ ar: 'رسم تخطيطي للأرض', en: 'Plot Visualization' }}><PlotSketch area={result?.envelope.finalFootprint ?? 0} length={plot.length ?? 0} width={plot.width ?? 0} setback={result?.envelope.setbacks} /></Section>
    <Section title={{ ar: 'حدود الأرض', en: 'Boundaries' }} detail="عرض الشارع مختلف عن طول واجهة الأرض"><div className="boundaries">{plot.boundaries.map((b) => <div key={b.side} className="boundary-item"><strong>{({ front:'أمامي', rear:'خلفي', left:'أيسر', right:'أيمن' })[b.side]}</strong><Select label={{ ar: 'نوع الحد', en: 'Boundary Type' }} value={b.type} items={['Street','Neighbor','Corridor','Other'].map((v)=>({value:v,text:v}))} onChange={(type) => updatePlot({ boundaries: plot.boundaries.map((old) => old.side === b.side ? { ...old, type: type as typeof b.type } : old) })} />{b.type === 'Street' && <Num label={{ ar: 'عرض الشارع', en: 'Street Width' }} suffix="م" value={b.width} onChange={(width) => updatePlot({ boundaries: plot.boundaries.map((old) => old.side === b.side ? { ...old, width } : old) })} />}<span className="minor">الارتداد: {result?.envelope.setbacks[b.side] ?? 'غير معروف'} م</span></div>)}</div></Section>
  </div>;
}

function RegulationsScreen({ project, onEdit, toast }: { project: ProjectRecord | null; onEdit: (id: string) => void; toast: (v: string, error?: boolean) => void }) {
  const store = useAppStore();
  const [search,setSearch]=useState('');
  const [showExcluded,setShowExcluded]=useState(false);
  const [selected,setSelected]=useState<string | null>(null);
  const [reference,setReference]=useState('');
  const [reason,setReason]=useState('');
  const [precedence,setPrecedence]=useState('');
  const [reviewer,setReviewer]=useState('');
  const scenario=project?.scenarios.find(s=>s.id===project.activeScenarioId)??null;
  const projectUse=scenario?.developmentUse??project?.info.use??'Residential Apartments';
  const candidates=project ? store.regulations.map(reg=>({reg,assessment:assessRegulation(reg,project.info,projectUse)})) : [];
  const nonExcluded=candidates.filter(x=>x.assessment.status!=='EXCLUDED');
  const visible=candidates.filter(x=>(showExcluded||x.assessment.status!=='EXCLUDED')&&`${x.reg.code} ${x.reg.name.ar} ${x.reg.name.en} ${x.reg.planningZone}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const activeReg=scenario ? project?.regulationSnapshots.find(r=>r.id===scenario.regulationId) ?? store.regulations.find(r=>r.id===scenario.regulationId):null;
  const hasEvidence=Boolean(scenario&&activeReg&&evidenceValid(scenario,activeReg));
  const attach=(reg:RegulationPack)=>{
    if(!project||!scenario)return toast('أدخل بيانات الدراسة أولًا.',true);
    const evidence={documentReference:reference,applicabilityReason:reason,precedenceReason:precedence,reviewer};
    const errors=validateEvidence(reg,project.info,scenario,evidence,nonExcluded.length>1,store.regulations);
    if(errors.length)return toast(errors[0],true);
    const record:RegulationSelectionEvidence={
      regulationId:reg.id,regulationVersion:reg.version,parcelKey:parcelKey(project.info),plotSignature:plotSignature(scenario.plot),
      developmentUse:projectUse,documentReference:reference.trim(),applicabilityReason:reason.trim(),
      precedenceReason:precedence.trim(),reviewer:reviewer.trim(),recordedAt:new Date().toISOString(),status:'USER_DOCUMENTED'
    };
    changeProject(p=>({...p,scenarios:p.scenarios.map(s=>s.id===p.activeScenarioId?{...s,regulationId:reg.id,regulationEvidence:record}:s),regulationSnapshots:[...p.regulationSnapshots.filter(r=>r.id!==reg.id),structuredClone(reg)]}));
    setSelected(null);
    toast('تم ربط النظام مع سجل المراجعة اليدوية. النتيجة تظل مبدئية حتى التحقق الرسمي من الانطباق.');
  };
  const labels={GENERAL:'نظام عام',SPECIAL:'نظام خاص',LOCAL:'نظام محلي',REFERENCE:'مرجع غير معتمد',DEMO:'تجريبي',UNCLASSIFIED:'الأولوية والنطاق غير موثقين'};
  return <div className="stack">
    <Alert danger>لا يجوز اختيار النظام الأعلى مسطحًا أو ربحًا. التطبيق لا يملك تحققًا مباشرًا من الجهات الرسمية؛ الأنظمة في المكتبة مرشحة للمراجعة وليست إثباتًا لانطباقها على قطعة الأرض.</Alert>
    {!project||!scenario ? <Alert>أنشئ دراسة وحدد قطعة الأرض أولًا لتتم المقارنة بحسب الاستخدام والموقع.</Alert> : <Section title={{ar:'الأرض محل التحقق',en:'Parcel Under Review'}}>
      <div className="metric-list"><Metric label="الحي" value={project.info.district}/><Metric label="المخطط" value={project.info.planNumber||'غير مدخل'}/><Metric label="القطعة" value={project.info.plotNumber||'غير مدخلة'}/><Metric label="الصك" value={project.info.deedNumber||'غير مدخل'}/><Metric label="الاستخدام" value={projectUse}/></div>
      {hasEvidence?<Alert>النظام المرتبط: {activeReg?.name.ar||scenario.regulationId}. توثيق المستخدم: {scenario.regulationEvidence?.documentReference}. لا يمثل تحققًا رسميًا آليًا.</Alert>:<Alert danger>لم يُوثّق نظام منطبق لهذه الأرض. المسطحات والجدوى تظل استكشافية ولا يصدر قرار بالمضي.</Alert>}
    </Section>}
    <Section title={{ar:'مقارنة المرشحين والأولوية',en:'Candidate Comparison'}} detail="التصفية حسب الاستخدام والنطاق المسجل؛ غياب نطاق القطعة لا يُعد تطابقًا">
      <div className="metric-list"><Metric label="أنظمة غير مستبعدة مبدئيًا" value={String(nonExcluded.length)}/><Metric label="نطاق مكاني موثق ومطابق" value={String(nonExcluded.filter(x=>x.assessment.locationMatched).length)}/><Metric label="مصدر الترجيح" value="مستند رسمي خاص بالقطعة"/></div>
      {nonExcluded.length>1&&<Alert danger>توجد عدة حزم مرشحة، وهذا لا يثبت وجود تعارض قانوني بينها. لا يُحسم النظام العام/الخاص أو أولوية أحدهما بالمساحة الأكبر أو الرقم priority؛ يجب توثيق نطاق الانطباق وعلاقة القواعد بمصدر مختص.</Alert>}
      <div className="search-field"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن كود نظام أو منطقة"/></div>
      <label className="review-check"><input type="checkbox" checked={showExcluded} onChange={e=>setShowExcluded(e.target.checked)}/> إظهار الأنظمة المستبعدة لعدم مطابقة الاستخدام أو الموقع أو لأنها تجريبية</label>
    </Section>
    {visible.map(({reg,assessment})=>{
      const disabled=assessment.status==='EXCLUDED';
      const preview=scenario && !disabled && scenario.plot.officialArea>0 && reg.calculationReady!==false && reg.maxFloors.value!==null && reg.coverage.value.ground!==null && Object.values(reg.setbacks.value).every(v=>v!==null) ? runScenario({...scenario,regulationId:reg.id,regulationEvidence:undefined},reg):null;
      return <Section key={reg.id} title={{ar:reg.name.ar,en:reg.name.en}} detail={`${reg.code} · ${labels[assessment.kind]}`}>
        <div className="reg-meta"><span>{disabled?'مستبعد':assessment.locationMatched?'نطاق مطابق مبدئيًا':'انطباق الموقع غير محسوم'}</span><span className="reg-status">{reg.verificationStatus}</span></div>
        {assessment.reasons.map((v,i)=><div className="reg-note" key={i}>• {v}</div>)}
        <div className="metric-list"><Metric label="الجهة المدونة" value={reg.authority.ar}/><Metric label="الإصدار" value={reg.version}/><Metric label="الأدوار القصوى" value={reg.maxFloors.value===null?'غير محددة':String(reg.maxFloors.value)}/><Metric label="نسبة الأرضي" value={reg.coverage.value.ground===null?'غير محددة':pct(reg.coverage.value.ground)}/><Metric label="FAR النظامي المسجل" value={reg.far.value===null?'غير محدد':unit(reg.far.value,2)}/><Metric label="مصدر الحزمة" value={reg.sourceReference}/>{reg.applicabilityScope?.supersedesPackIds?.length?<Metric label="علاقة الإحلال المدونة" value={`يحل محل: ${reg.applicabilityScope.supersedesPackIds.join('، ')}`}/>:null}
        <Metric label="تقدير المسطحات للمقارنة فقط" value={preview?`${unit(preview.envelope.achievedGfa)} م² — غير معتمد`:'غير قابل للحساب الموثوق بالمدخلات الحالية'}/></div>
        {selected===reg.id&&project&&scenario&&!disabled&&<div className="reg-evidence-panel"><strong>توثيق سبب انطباق النظام على القطعة</strong>
          <Alert>التوثيق هنا إدخال مستخدم وليس مصادقة إلكترونية على النظام. لا تنقل القيمة الأكثر ربحية للنظام المنطبق دون دليل.</Alert>
          <Input label={{ar:'رقم مستند الانطباق أو رابطه',en:'Official Document / Parcel Reference'}} value={reference} onChange={setReference} placeholder="قرار مساحي أو إفادة مختصة أو مرجع قابل للتتبع"/>
          <label className="m-field"><span className="field-label">كيف يثبت المستند انطباق هذا النظام على القطعة؟</span><textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3}/></label>
          {nonExcluded.length>1&&<label className="m-field"><span className="field-label">تفسير أولوية النظام أو عدم تعارض الأنظمة المرشحة مع ذكر مستند</span><textarea value={precedence} onChange={e=>setPrecedence(e.target.value)} rows={3}/></label>}
          <Input label={{ar:'اسم من راجع مستندات الانطباق',en:'Reviewed by'}} value={reviewer} onChange={setReviewer}/>
          <div className="actions-row"><Btn onClick={()=>attach(reg)}><ShieldAlert size={16}/> ربط مرجعي موثق — دراسة مبدئية</Btn><Btn secondary onClick={()=>setSelected(null)}>إلغاء</Btn></div>
        </div>}
        <div className="actions-row">
          {!disabled&&selected!==reg.id&&<Btn onClick={()=>{setSelected(reg.id);setReference('');setReason('');setPrecedence('');setReviewer('')}} disabled={!project}>مراجعة الانطباق قبل الربط</Btn>}
          <Btn secondary onClick={()=>{if(reg.verificationStatus==='DEMO_ONLY'){toast('لا يُنسخ نظام تجريبي كأساس تنظيمي حقيقي.',true);return;}const copy={...structuredClone(reg),id:id('reg'),code:`${reg.code}-CUSTOM`,name:{ar:`نسخة من ${reg.name.ar}`,en:`Copy of ${reg.name.en}`},verificationStatus:'USER_REFERENCE_CALCULABLE' as const,version:'user-1',source:'User edited custom reference',sourceReference:'يتطلب التحقق من المرجع الرسمي',calculationReady:true,applicabilityScope:{kind:'REFERENCE' as const}};useAppStore.setState({regulations:[copy,...useAppStore.getState().regulations]});void useAppStore.getState().persist();onEdit(copy.id);toast('نسخة مخصصة مرجعية فقط، لا تعني انطباقًا نظاميًا.')}}><Copy size={15}/> نسخة مرجعية</Btn>
          {reg.code.endsWith('-CUSTOM')&&<Btn secondary onClick={()=>onEdit(reg.id)}>تعديل</Btn>}
        </div>
      </Section>;
    })}
    {visible.length===0&&<div className="empty-inline">لا توجد حزم مطابقة. يلزم الرجوع إلى مستندات الموقع والجهة المختصة قبل اختيار نظام.</div>}
  </div>;
}

function RegulationEditor({ idValue, close, toast }: { idValue: string; close: () => void; toast: (v: string, error?: boolean) => void }) {
  const store = useAppStore(); const reg = store.regulations.find((v) => v.id === idValue);
  const [draft, setDraft] = useState<RegulationPack | null>(reg ? structuredClone(reg) : null);
  if (!draft) return null;
  const edit = (patch: Partial<RegulationPack>) => setDraft((p) => p ? { ...p, ...patch } : p);
  const save = () => { if (!draft || draft.maxFloors.value === null || draft.maxFloors.value < 1) return toast('يجب إدخال عدد أدوار صحيح', true); store.updateRegulation({...draft,verificationStatus:'USER_REFERENCE_CALCULABLE'}); close(); toast('تم حفظ النظام المخصص. أعد تطبيقه على السيناريو لتحديث اللقطة المرجعية.'); };
  return <div className="modal-overlay"><div className="modal-panel"><div className="modal-title"><h2>تعديل نظام بناء مخصص</h2><button className="icon-btn" onClick={close}><X/></button></div><div className="modal-scroller"><Alert>تصنيف النظام العام أو الخاص والمناطق ورقم المخطط هنا بيانات مرجعية من المستخدم، ولا تعني توثيقًا رسميًا. الحزم المخصصة لا تحصل على حالة VERIFIED تلقائيًا.</Alert><Select label={{ar:'نوع النطاق التنظيمي (مدخل يدوي)',en:'Declared Scope Kind'}} value={draft.applicabilityScope?.kind??'REFERENCE'} items={[{value:'REFERENCE',text:'مرجع غير معتمد'},{value:'GENERAL',text:'نظام عام (بحاجة إلى إثبات)'},{value:'SPECIAL',text:'نظام خاص (بحاجة إلى إثبات)'},{value:'LOCAL',text:'نظام محلي (بحاجة إلى إثبات)'}]} onChange={kind=>edit({applicabilityScope:{...draft.applicabilityScope,kind:kind as 'REFERENCE'|'GENERAL'|'SPECIAL'|'LOCAL'}})}/><Input label={{ar:'الأحياء المشمولة (مفصولة بفواصل)',en:'Districts'}} value={(draft.applicabilityScope?.districts??[]).join(', ')} onChange={value=>edit({applicabilityScope:{kind:draft.applicabilityScope?.kind??'REFERENCE',...draft.applicabilityScope,districts:value.split(',').map(x=>x.trim()).filter(Boolean)}})}/><Input label={{ar:'أرقام المخططات التي يشملها المرجع',en:'Plan Numbers'}} value={(draft.applicabilityScope?.planNumbers??[]).join(', ')} onChange={value=>edit({applicabilityScope:{kind:draft.applicabilityScope?.kind??'REFERENCE',...draft.applicabilityScope,planNumbers:value.split(',').map(x=>x.trim()).filter(Boolean)}})}/><Input label={{ar:'أرقام القطع المشمولة',en:'Plot Numbers'}} value={(draft.applicabilityScope?.plotNumbers??[]).join(', ')} onChange={value=>edit({applicabilityScope:{kind:draft.applicabilityScope?.kind??'REFERENCE',...draft.applicabilityScope,plotNumbers:value.split(',').map(x=>x.trim()).filter(Boolean)}})}/><Input label={{ar:'معرّفات الأنظمة التي تحل محلها هذه القاعدة (إذا نص مستند على ذلك)',en:'Superseded Rules'}} value={(draft.applicabilityScope?.supersedesPackIds??[]).join(', ')} onChange={value=>edit({applicabilityScope:{kind:draft.applicabilityScope?.kind??'REFERENCE',...draft.applicabilityScope,supersedesPackIds:value.split(',').map(x=>x.trim()).filter(Boolean)}})}/><Input label={{ar:'مستند تعريف النطاق (مرجعي)',en:'Scope Document'}} value={draft.applicabilityScope?.authorityDocument??''} onChange={value=>edit({applicabilityScope:{kind:draft.applicabilityScope?.kind??'REFERENCE',...draft.applicabilityScope,authorityDocument:value}})}/><Input label={{ ar:'اسم النظام',en:'Regulation Name' }} value={draft.name.ar} onChange={(ar) => edit({ name:{ ...draft.name, ar } })}/><Input label={{ ar:'المصدر المرجعي',en:'Source Reference' }} value={draft.sourceReference} onChange={(sourceReference) => edit({ sourceReference })}/><Num label={{ ar:'عدد الأدوار',en:'Max Floors' }} value={draft.maxFloors.value ?? undefined} min={1} max={120} onChange={(value)=>edit({maxFloors:{...draft.maxFloors,value}})} /><Num label={{ ar:'معامل البناء FAR',en:'FAR' }} value={draft.far.value ?? undefined} max={100} onChange={(value)=>edit({far:{...draft.far,value,source:'User supplied reference'}})} /><Num label={{ar:'تغطية الأرض',en:'Ground Coverage'}} value={(draft.coverage.value.ground ?? 0)*100} suffix="%" max={100} onChange={(n)=>edit({coverage:{...draft.coverage,value:{...draft.coverage.value,ground:n/100}}})}/><Num label={{ar:'تغطية الدور الأول',en:'First Coverage'}} value={(draft.coverage.value.first ?? 0)*100} suffix="%" max={100} onChange={(n)=>edit({coverage:{...draft.coverage,value:{...draft.coverage.value,first:n/100}}})}/><Num label={{ar:'تغطية الأدوار المتكررة',en:'Typical Coverage'}} value={(draft.coverage.value.typical ?? 0)*100} suffix="%" max={100} onChange={(n)=>edit({coverage:{...draft.coverage,value:{...draft.coverage.value,typical:n/100}}})}/>{(['front','rear','left','right'] as const).map((side) => <Num key={side} label={{ar:`ارتداد ${({front:'أمامي',rear:'خلفي',left:'أيسر',right:'أيمن'})[side]}`,en:`${side} setback`}} value={typeof draft.setbacks.value[side] === 'number' ? draft.setbacks.value[side] as number : undefined} suffix="م" onChange={(n)=>edit({setbacks:{...draft.setbacks,value:{...draft.setbacks.value,[side]:n}},setbackProfiles:undefined})} />)}<Alert>النسخة مخصصة من إدخالك، ولا تصبح معتمدة لمجرد حفظها.</Alert></div><div className="modal-footer"><Btn secondary onClick={close}>إلغاء</Btn><Btn onClick={save}><Save size={17}/> حفظ النظام</Btn></div></div></div>;
}

function DevelopmentScreen({ scenario, result, regulation, navigate }: { scenario: Scenario; result: ScenarioResult | null; regulation: RegulationPack | null; navigate: (s: Screen) => void }) {
  if (!result || !regulation) return <NoRegulation navigate={navigate}/>;
  return <div className="stack"><div className="stats-grid"><Stat label={{ar:'بصمة البناء',en:'Footprint'}} value={`${unit(result.envelope.finalFootprint)} m²`}/><Stat label={{ar:'المسطحات الإجمالية',en:'GFA'}} value={`${unit(result.envelope.achievedGfa)} m²`}/><Stat label={{ar:'FAR المسموح',en:'Permitted FAR'}} value={`${unit(result.envelope.permittedGfa)} m²`}/><Stat label={{ar:'المنفعة من FAR',en:'FAR Used'}} value={pct(result.envelope.farUtilization)}/></div>
    {result.envelope.farSource === 'NOT_DEFINED' && <Alert danger>معامل البناء غير محدد. نتائج المسطحات استرشادية وغير صالحة للاعتماد.</Alert>}
    <Section title={{ar:'الافتراضات والتعديلات',en:'Scenario Assumptions'}}><Num label={{ar:'الأقبية تحت الأرض',en:'Basements'}} min={0} max={30} value={scenario.basementCount} onChange={(basementCount)=>changeScenario((s)=>({...s,basementCount}))}/><Num label={{ar:'معامل بناء يدوي للسيناريو',en:'Manual FAR Override'}} value={Number(scenario.overrides.find((v)=>v.field==='far')?.usedValue ?? 0)} max={100} onChange={(value)=>setOverride('far',value)} hint="قيمة دراسة فقط، لا تغير النظام الأصلي ولا تمثل موافقة تنظيمية"/><div className="actions-row"><Btn secondary onClick={()=>changeScenario((s)=>({...s,overrides:s.overrides.filter((v)=>v.field!=='far')}))}>إلغاء FAR اليدوي</Btn></div></Section>
    <Section title={{ar:'تفاصيل مسطحات الأدوار',en:'Floor-by-floor Areas'}}><div className="floor-list">{result.envelope.floorAreas.map((floor,i)=> <div key={i} className="floor-row"><span className="floor-indicator"/><div><strong>{floor.floor}</strong><small>حد التغطية: {unit(floor.coverageLimit)} م²</small></div><strong dir="ltr">{unit(floor.finalAllowedArea)} m²</strong></div>)}</div></Section>
    <Section title={{ar:'ملخص المساحات',en:'Area Summary'}}><div className="metric-list"><Metric label="المساحة البيعية للسكني" value={`${unit(result.outputs.sellableResidential)} م²`}/><Metric label="المساحة البيعية للتجاري" value={`${unit(result.outputs.sellableRetail)} م²`}/><Metric label="المساحة البيعية للمكاتب" value={`${unit(result.outputs.sellableOffice)} م²`}/><Metric label="قيد التطوير المؤثر" value={result.envelope.controllingConstraint}/></div></Section>{result.envelope.warnings.length>0 && <Section title={{ar:'تحذيرات الحساب',en:'Calculation Warnings'}}>{result.envelope.warnings.map((w,i)=><div className="warning-row" key={i}><AlertCircle size={15}/>{w}</div>)}</Section>}
  </div>;
}
function ParkingScreen({ scenario, result, navigate }: { scenario: Scenario; result: ScenarioResult | null; navigate: (s: Screen)=>void }) {
  if (!result) return <NoRegulation navigate={navigate}/>;
  const p=result.parking;
  return <div className="stack"><div className="stats-grid"><Stat label={{ar:'المطلوب',en:'Required'}} value={unit(p.requiredSpaces)}/><Stat label={{ar:'المتاح المؤكد',en:'Available'}} value={unit(p.providedSpaces)}/><Stat label={{ar:'الرصيد',en:'Balance'}} value={unit(p.balance)} tone={p.balance<0?'danger':'success'}/><Stat label={{ar:'عدد الأقبية المطلوبة',en:'Basements Needed'}} value={unit(p.basementCountRequired)}/></div><Alert danger>المواقف السطحية المحسوبة من الواجهة تقدير مبدئي فقط، ولا تُضاف للمواقف المتاحة حتى تقوم بتأكيدها يدويًا بناءً على المخطط والجهة المختصة.</Alert>
    <Section title={{ar:'المدخلات المؤثرة',en:'Parking Inputs'}}><div className="form-grid"><Num label={{ar:'الأقبية المقترحة',en:'Provided Basements'}} value={scenario.basementCount} min={0} max={30} onChange={(basementCount)=>changeScenario((s)=>({...s,basementCount}))}/><Num label={{ar:'مساحة الموقف شاملة الحركة',en:'Parking Efficiency'}} value={scenario.parkingEfficiencySqmPerSpace??30} suffix="م²/موقف" min={12} max={200} onChange={(parkingEfficiencySqmPerSpace)=>changeScenario((s)=>({...s,parkingEfficiencySqmPerSpace}))}/><Num label={{ar:'مواقف سطحية مؤكدة فقط',en:'Confirmed Surface Spaces'}} value={scenario.surfaceParking??0} min={0} max={10000} onChange={(surfaceParking)=>changeScenario((s)=>({...s,surfaceParking}))}/><Num label={{ar:'عدد المواقف المطلوبة يدويًا',en:'Manual Required Spaces'}} value={Number(scenario.overrides.find((v)=>v.field==='parking.requiredSpaces')?.usedValue??p.requiredSpaces)} min={0} max={100000} onChange={(n)=>setOverride('parking.requiredSpaces',n)} /></div><div className="actions-row"><Btn secondary onClick={()=>changeScenario((s)=>({...s,surfaceParking:undefined,overrides:s.overrides.filter((o)=>o.field!=='parking.requiredSpaces')}))}>إعادة إلى الحساب الافتراضي</Btn></div></Section>
    <Section title={{ar:'تقييم المواقف',en:'Parking Assessment'}}><div className="metric-list"><Metric label="المواقف التقديرية على الواجهة (غير محتسبة)" value={unit(p.autoSurfaceParking)}/><Metric label="المواقف المؤكدة على الأرض" value={unit(p.surfaceParking)}/><Metric label="المواقف لكل قبو" value={unit(p.spacesPerBasement)}/><Metric label="اتجاه الاصطفاف الافتراضي" value={p.parkingLayout}/><Metric label="حالة المواقف" value={p.status}/></div>{p.warnings.map((v,i)=><div className="warning-row" key={i}><AlertCircle size={15}/>{v}</div>)}</Section>
  </div>;
}

const financeSections = [{ id:'land',title:'الأرض والاستحواذ'},{id:'build',title:'الإنشاء'},{id:'soft',title:'التكاليف الإضافية'},{id:'sales',title:'البيع'},{id:'mix',title:'الاستخدامات والكفاءة'}] as const;
type FinanceTab = typeof financeSections[number]['id'];
function FinField({ f, setF, field, ar, en, suffix = 'ر.س', percent = false }: { f: FinancialInputs; setF: (key: keyof FinancialInputs, value: number) => void; field: keyof FinancialInputs; ar: string; en: string; suffix?: string; percent?: boolean }) {
  return <Num label={{ ar, en }} value={percent ? (f[field] ?? 0) * 100 : f[field] ?? 0} suffix={percent ? '%' : suffix} max={percent ? 100 : undefined} onChange={(n) => setF(field, percent ? n / 100 : n)} />;
}
function MixField({ scenario, setMix, field, ar, en }: { scenario: Scenario; setMix: (key: keyof Scenario['productMix'], value: number) => void; field: keyof Scenario['productMix']; ar: string; en: string }) {
  return <Num label={{ ar, en }} value={scenario.productMix[field] * 100} suffix="%" max={100} onChange={(n) => setMix(field, n / 100)} />;
}
function FinancialScreen({ scenario, result, navigate }: { scenario: Scenario; result: ScenarioResult | null; navigate: (s: Screen)=>void }) {
  const [tab,setTab]=useState<FinanceTab>('land');
  if(!result) return <NoRegulation navigate={navigate}/>;
  const f=scenario.financial;
  const setF=(key:keyof FinancialInputs,value:number)=>changeScenario((s)=>({...s,financial:{...s.financial,[key]:value}}));
  const setMix=(key:keyof Scenario['productMix'],value:number)=>changeScenario((s)=>({...s,productMix:{...s.productMix,[key]:value}}));
  const revenue=result.financial.revenue,cost=result.financial.totalCost,profit=result.financial.profit;
  return <div className="stack"><section className="finance-hero"><small>FEASIBILITY / جدوى التطوير</small><span>صافي الربح المقدر</span><strong dir="ltr">{cash(profit)}</strong><div><span>العائد على الاستثمار <b dir="ltr">{pct(result.financial.roi)}</b></span><span>هامش الربح <b dir="ltr">{pct(result.financial.profitMargin)}</b></span></div></section><div className="stats-grid"><Stat label={{ar:'إجمالي التكاليف',en:'Total Cost'}} value={compact(cost)}/><Stat label={{ar:'إجمالي الإيرادات',en:'Revenue'}} value={compact(revenue)} tone="success"/></div>
    <Section title={{ar:'مدخلات الجدوى',en:'Feasibility Inputs'}} detail="جميع الأسعار تقديرية وقابلة للتعديل"><div className="tab-strip">{financeSections.map((v)=><button key={v.id} className={tab===v.id?'on':''} onClick={()=>setTab(v.id)}>{v.title}</button>)}</div><div className="form-grid">
      {tab==='land' && <><FinField f={f} setF={setF} field="landPrice" ar="سعر الأرض للمتر" en="Land Price / m²" suffix="ر.س/م²"/><FinField f={f} setF={setF} field="brokeragePercent" ar="سمسرة الشراء" en="Brokerage" percent/><FinField f={f} setF={setF} field="otherAcquisitionCost" ar="تكاليف شراء أخرى" en="Other Acquisition Costs"/></>}
      {tab==='build' && <><FinField f={f} setF={setF} field="structuralRate" ar="تكلفة العظم" en="Structure / m²" suffix="ر.س/م²"/><FinField f={f} setF={setF} field="finishingRate" ar="تكلفة التشطيبات" en="Finishing / m²" suffix="ر.س/م²"/><FinField f={f} setF={setF} field="mepRate" ar="الكهروميكانيكا" en="MEP / m²" suffix="ر.س/م²"/><FinField f={f} setF={setF} field="basementRate" ar="تكلفة الأقبية" en="Basements / m²" suffix="ر.س/م²"/></>}
      {tab==='soft' && <><FinField f={f} setF={setF} field="designCost" ar="التصميم" en="Design"/><FinField f={f} setF={setF} field="consultancyCost" ar="الاستشارات" en="Consultancy"/><FinField f={f} setF={setF} field="supervisionCost" ar="الإشراف" en="Supervision"/><FinField f={f} setF={setF} field="permitsCost" ar="رسوم الرخص" en="Permits"/><FinField f={f} setF={setF} field="adminCost" ar="الإدارة" en="Administration"/><FinField f={f} setF={setF} field="externalWorksCost" ar="الأعمال الخارجية" en="External Works"/><FinField f={f} setF={setF} field="contingencyPercent" ar="مخصص الطوارئ من الإنشاء" en="Contingency (construction)" percent/><FinField f={f} setF={setF} field="marketingPercent" ar="التسويق من الإيرادات" en="Marketing (revenue)" percent/><FinField f={f} setF={setF} field="salesCommissionPercent" ar="عمولة البيع من الإيرادات" en="Sales Commission (revenue)" percent/></>}
      {tab==='sales' && <><FinField f={f} setF={setF} field="sellingPriceResidential" ar="بيع السكني للمتر" en="Residential Price / m²" suffix="ر.س/م²"/><FinField f={f} setF={setF} field="sellingPriceRetail" ar="بيع التجاري للمتر" en="Retail Price / m²" suffix="ر.س/م²"/><FinField f={f} setF={setF} field="sellingPriceOffice" ar="بيع المكتبي للمتر" en="Office Price / m²" suffix="ر.س/م²"/></>}
      {tab==='mix' && <><MixField scenario={scenario} setMix={setMix} field="residentialShare" ar="نسبة الاستخدام السكني" en="Residential Share"/><MixField scenario={scenario} setMix={setMix} field="retailShare" ar="نسبة التجاري" en="Retail Share"/><MixField scenario={scenario} setMix={setMix} field="officeShare" ar="نسبة المكتبي" en="Office Share"/><FinField f={f} setF={setF} field="sellableEfficiencyResidential" ar="كفاءة بيع السكني" en="Residential Efficiency" percent/><FinField f={f} setF={setF} field="sellableEfficiencyRetail" ar="كفاءة بيع التجاري" en="Retail Efficiency" percent/><FinField f={f} setF={setF} field="sellableEfficiencyOffice" ar="كفاءة بيع المكتبي" en="Office Efficiency" percent/><Num label={{ar:'متوسط مساحة الوحدة',en:'Average Unit Area'}} suffix="م²" value={scenario.productMix.averageUnitArea} onChange={(averageUnitArea)=>changeScenario((s)=>({...s,productMix:{...s.productMix,averageUnitArea}}))}/></>}
    </div>{tab==='mix'&&<Alert danger>إجمالي نسب الاستخدام: {pct(scenario.productMix.residentialShare+scenario.productMix.retailShare+scenario.productMix.officeShare)}. يجب أن يكون 100% للحصول على قرار استثماري صالح.</Alert>}</Section>
    <Section title={{ar:'تفصيل النتائج',en:'Financial Breakdown'}}><div className="metric-list"><Metric label="الأرض" value={cash(result.financial.landCost)}/><Metric label="الإنشاء" value={cash(result.financial.constructionCost)}/><Metric label="المصاريف الأخرى" value={cash(result.financial.softCosts)}/><Metric label="إجمالي الإيرادات" value={cash(result.financial.revenue)}/><Metric label="صافي الربح" value={cash(result.financial.profit)}/><Metric label="تمويل الذروة" value={cash(result.financial.peakFunding)}/><Metric label="IRR سنوي تقديري" value={result.financial.irr===null?'غير متاح':pct(result.financial.irr)}/><Metric label="NPV (10% سنويًا)" value={cash(result.financial.npv)}/></div></Section>
    <Section title={{ar:'التدفقات النقدية التقديرية',en:'Cash Flow'}} detail="توزيع زمني افتراضي 18 شهرًا؛ وليس جدول صرف معتمد"><Chart rows={result.financial.monthlyCashFlow}/></Section><Alert>الدراسة المالية استرشادية حتى يتم اعتماد كميات المشروع وتكاليفه وجدول التنفيذ والمبيعات.</Alert>
  </div>;
}
function ScenariosScreen({ project, navigate, toast }: { project: ProjectRecord; navigate:(v:Screen)=>void;toast:(v:string,error?:boolean)=>void }) {
  const store=useAppStore();const [rename,setRename]=useState<string|null>(null);const [newName,setNewName]=useState('');
  const rows=project.scenarios.map((s)=>{const reg=project.regulationSnapshots.find((r)=>r.id===s.regulationId)??store.regulations.find((r)=>r.id===s.regulationId);return {scenario:s,result:reg?runScenario(s,reg):null};});
  const duplicate=(source:Scenario)=>{store.duplicateScenario(project.info.id,source.id);toast('تم نسخ السيناريو وفتح النسخة الجديدة.');};
  const del=(source:Scenario)=>{if(project.scenarios.length===1)return toast('لا يمكن حذف آخر سيناريو',true);if(!window.confirm(`هل تريد حذف السيناريو ${source.name} نهائيًا؟`))return;const scenarios=project.scenarios.filter((s)=>s.id!==source.id);store.updateProject({...project,scenarios,activeScenarioId:project.activeScenarioId===source.id?scenarios[0].id:project.activeScenarioId});toast('تم حذف السيناريو.');};
  return <div className="stack"><Alert>انسخ السيناريو لتجربة عدد أقبية مختلف أو أسعار واشتراطات أخرى دون التأثير على الأصل.</Alert>{rows.map(({scenario:s,result:r},i)=><Section key={s.id} title={{ar:s.name,en:`Scenario ${i+1}`}} action={project.activeScenarioId===s.id?<span className="active-chip">نشط</span>:<button className="text-link" onClick={()=>changeProject((p)=>({...p,activeScenarioId:s.id}))}>تفعيل</button>}><div className="metric-list"><Metric label="المسطحات" value={`${unit(r?.envelope.achievedGfa??0)} م²`}/><Metric label="الربح" value={r?cash(r.financial.profit):'—'}/><Metric label="ROI" value={r?pct(r.financial.roi):'—'}/><Metric label="الأقبية" value={unit(s.basementCount)}/></div><div className="actions-row"><Btn secondary onClick={()=>{changeProject((p)=>({...p,activeScenarioId:s.id}));navigate('financial');}}>فتح التفاصيل</Btn><Btn secondary onClick={()=>duplicate(s)}><Copy size={16}/> نسخ</Btn><Btn secondary onClick={()=>{setRename(s.id);setNewName(s.name)}}>تسمية</Btn><button aria-label="حذف السيناريو" className="small-danger" onClick={()=>del(s)}><Trash2 size={18}/></button></div>{rename===s.id&&<div className="rename-row"><input value={newName} onChange={(e)=>setNewName(e.target.value)}/><Btn onClick={()=>{if(!newName.trim())return;changeProject((p)=>({...p,scenarios:p.scenarios.map((v)=>v.id===s.id?{...v,name:newName.trim()}:v)}));setRename(null);}}>حفظ</Btn></div>}</Section>)}<div className="sticky-add"><Btn onClick={()=>duplicate(project.scenarios.find((s)=>s.id===project.activeScenarioId)??project.scenarios[0])}><Plus size={18}/> سيناريو جديد من الحالي</Btn></div></div>;
}
function ReportsScreen({ project, regulation, result, toast }: {project:ProjectRecord;regulation:RegulationPack|null;result:ScenarioResult|null;toast:(v:string,error?:boolean)=>void}) {
  const store=useAppStore(); const [working,setWorking]=useState<'excel'|'pdf'|null>(null);const [last,setLast]=useState('');
  if(!regulation||!result) return <Alert danger>يجب تحديد نظام بناء أولًا.</Alert>;
  const exportFile=async(type:'excel'|'pdf')=>{setWorking(type);try{const path=type==='excel'?await exportExcel(project,store.regulations,store.settings.reportLanguage,store.company):await exportPdf(project,store.regulations,store.settings.reportLanguage,store.company);setLast(path);toast(`تم إنشاء تقرير ${type==='excel'?'Excel':'PDF'}؛ اختر حفظ الملف من نافذة المشاركة.`)}catch(e){toast(`فشل التصدير: ${String(e)}`,true)}finally{setWorking(null)}};
  return <div className="stack"><Alert danger>هذه الدراسة استكشافية ما لم يُثبت انطباق النظام على القطعة من جهة مختصة. توثيق المستخدم وحده لا يمثل تحققًا رسميًا.</Alert><Section title={{ar:'ملخص التقرير',en:'Report Preview'}}><div className="report-preview"><span>Saudi DevelopIQ</span><small>RIYADH EDITION</small><strong>{project.info.name}</strong><p>{project.info.district}</p><div className="report-div"><Metric label="المسطحات" value={`${unit(result.envelope.achievedGfa)} م²`}/><Metric label="الربح" value={cash(result.financial.profit)}/><Metric label="قرار التطوير" value={result.decision.label.ar}/></div></div></Section><Section title={{ar:'التصدير والمشاركة',en:'Export & Share'}}><Select label={{ar:'لغة التقرير',en:'Report Language'}} value={store.settings.reportLanguage} onChange={(v)=>store.updateSettings({reportLanguage:v as LanguageMode})} items={[{value:'ar',text:'العربية'},{value:'en',text:'English'},{value:'bi',text:'العربية والإنجليزية'}]}/><div className="report-actions"><Btn disabled={working!==null} onClick={()=>void exportFile('excel')}><FileSpreadsheet size={20}/>{working==='excel'?'جارٍ تجهيز Excel…':'إنشاء تقرير Excel'}</Btn><Btn secondary disabled={working!==null} onClick={()=>void exportFile('pdf')}><FileText size={20}/>{working==='pdf'?'جارٍ تجهيز PDF…':'إنشاء تقرير PDF'}</Btn></div>{last&&<Btn secondary className="full" onClick={()=>void window.desktopAPI.openPath(last).catch((e)=>toast(String(e),true))}><Share2 size={17}/> مشاركة آخر تقرير مرة أخرى</Btn>}<Alert>التقرير يُنشأ على الجهاز دون إرسال بيانات المشروع إلى خادم. احفظ نسخة خارج التطبيق من قائمة المشاركة.</Alert></Section></div>;
}
function CompanyScreen({ toast }: {toast:(v:string,error?:boolean)=>void}) {
  const store=useAppStore();const c=store.company;const update=(key:keyof typeof c,value:string)=>store.updateCompany({[key]:value});
  return <div className="stack"><Section title={{ar:'بيانات الجهة',en:'Company Details'}}><div className="form-grid">{([
    ['companyNameAr','اسم الشركة بالعربية','Company Name Arabic'],['companyNameEn','اسم الشركة بالإنجليزية','Company Name English'],['crNumber','السجل التجاري','CR Number'],['vatNumber','الرقم الضريبي','VAT Number'],['addressAr','العنوان بالعربية','Address Arabic'],['email','البريد الإلكتروني','Email'],['phone','رقم الهاتف','Phone'],['preparedBy','أعد الدراسة','Prepared By'],['reviewedBy','راجع الدراسة','Reviewed By'],['approvedBy','اعتمد الدراسة','Approved By']
  ] as const).map(([k,ar,en])=><Input key={k} label={{ar,en}} value={String(c[k]??'')} onChange={(v)=>update(k,v)} />)}</div></Section><Section title={{ar:'الشعار الرسمي',en:'Company Branding'}}><div className="company-brand">{c.logoDataUrl?<img src={c.logoDataUrl} alt="شعار الشركة"/>:<div className="study-icon"><Building2/></div>}<Btn secondary onClick={async()=>{try{const logo=await window.desktopAPI.selectLogo();if(logo){store.updateCompany({logoDataUrl:logo.dataUrl});toast('تم إضافة شعار الشركة')}}catch(e){toast(String(e),true)}}}><Upload size={17}/> اختيار شعار</Btn></div></Section></div>;
}
function BackupScreen({toast}:{toast:(v:string,error?:boolean)=>void}) {
  const [busy,setBusy]=useState(false);const store=useAppStore();
  const act=async(action:'export'|'import')=>{setBusy(true);try{if(action==='export'){await store.persist();const path=await store.exportBackup();toast(`تم تجهيز النسخة الاحتياطية: ${path}`)}else{if(!window.confirm('استعادة نسخة احتياطية ستستبدل دراساتك الحالية. هل تريد المتابعة؟'))return;const ok=await store.importBackup();if(ok)toast('تمت استعادة البيانات بنجاح');else toast('لم يتم اختيار ملف للنسخ الاحتياطي')}}catch(e){toast(String(e),true)}finally{setBusy(false)}};
  return <div className="stack"><Section title={{ar:'بياناتك تحت سيطرتك',en:'Your Data, Your Control'}}><div className="backup-intro"><ShieldAlert size={36}/><p>كل الدراسات والمشاريع محفوظة محليًا على هذا الجهاز. احفظ نسخة احتياطية دورية خارج التطبيق، لأن حذف التطبيق قد يحذف بياناته.</p></div><div className="report-actions"><Btn disabled={busy} onClick={()=>void act('export')}><Download size={18}/> تصدير نسخة JSON</Btn><Btn secondary disabled={busy} onClick={()=>void act('import')}><Upload size={18}/> استيراد نسخة احتياطية</Btn></div><Alert danger>الاستعادة تستبدل قائمة المشاريع الحالية بالبيانات الموجودة في ملف النسخة المختارة. صدّر نسخة قبل الاستعادة.</Alert></Section></div>;
}
function SettingsScreen() {
  const store=useAppStore();return <div className="stack"><Section title={{ar:'اللغة والمظهر',en:'Language & Appearance'}}><Select label={{ar:'لغة الواجهة',en:'UI Language'}} value={store.settings.language} onChange={(v)=>store.updateSettings({language:v as LanguageMode})} items={[{value:'ar',text:'العربية'},{value:'en',text:'English'},{value:'bi',text:'عربي + English'}]}/><Select label={{ar:'الوضع',en:'Theme'}} value={store.settings.theme} onChange={(v)=>store.updateSettings({theme:v as typeof store.settings.theme})} items={[{value:'light',text:'فاتح'},{value:'dark',text:'داكن'},{value:'system',text:'حسب النظام'}]}/></Section><Section title={{ar:'الأمان والتخزين',en:'Storage & Privacy'}}><div className="metric-list"><Metric label="التخزين" value="على الجهاز فقط"/><Metric label="مزامنة سحابية" value="غير مستخدمة"/><Metric label="نسخ احتياطي تلقائي" value="غير مفعل"/><Metric label="إصدار قاعدة البيانات" value="محلي متعدد النسخ"/></div><Alert>خيار قفل التطبيق غير متاح حاليًا؛ لا يتم عرض زر غير فعال يوحي بالحماية.</Alert></Section></div>;
}
function AboutScreen() { return <div className="stack"><section className="about-hero"><img src={iconUrl} alt="DevelopIQ"/><h2>Saudi Develop<span>IQ</span></h2><small>RIYADH EDITION · ANDROID 1.2.0</small><p>From Plot to Decision<br/>من الأرض إلى قرار التطوير</p></section><Section title={{ar:'تصميم وتطوير',en:'Designed & Developed By'}}><div className="about-maker"><strong>م. محمود الجمصي</strong><span>Mahmoud Elgamsy</span><a href="mailto:mobd3on@gmail.com">mobd3on@gmail.com</a><a href="https://www.linkedin.com/in/melgamsy/">LinkedIn · melgamsy</a><a href="tel:+966562284194">+966 56 228 4194</a></div></Section><Alert>Saudi DevelopIQ أداة تقديرية للدراسات المبدئية، ولا تغني عن المخططات المعتمدة ودراسة التربة والاشتراطات الرسمية.</Alert></div>; }
