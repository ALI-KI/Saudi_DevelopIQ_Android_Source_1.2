import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, BarChart3, Check, ChevronRight, CircleHelp, Copy, Download, Eye, FileDown,
  FolderOpen, Gauge, Home, Image as ImageIcon, Info, Landmark, Layers3, Library, Map, PackageOpen,
  PanelLeftClose, PanelLeftOpen, ParkingCircle, Plus, RotateCcw, Save, Search, Settings, Sparkles, Upload, X
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import { runScenario } from '../../core/engines';
import { dirFor, L } from '../../core/i18n';
import { ManualOverride, ProjectRecord, ProjectUse, RegulationPack, Scenario, ScenarioResult, VerificationStatus } from '../../shared/types';
import { useAppStore } from '../store';
import { exportExcel, exportPdf } from '../utils/exporters';

type ViewKey = 'home' | 'overview' | 'plot' | 'regulations' | 'development' | 'parking' | 'financial' | 'scenarios' | 'reports' | 'company' | 'backup' | 'settings' | 'about';
type Toast = { id: string; tone: 'success' | 'warning' | 'info'; message: string };

const projectUses: ProjectUse[] = ['Residential Villas', 'Residential Apartments', 'Residential + Retail', 'Commercial', 'Retail', 'Office', 'Retail + Office', 'Manual / Custom Study'];
const chartColors = ['#1d6b5d', '#d2a84f', '#4f7f87', '#766f63', '#9c6b3e'];
const officialBrandIcon = new URL('../../../assets/brand/developiq-app-icon.png', import.meta.url).href;

const navPrimary = [
  ['overview', Home, { ar: 'نظرة عامة', en: 'Overview' }],
  ['plot', Map, { ar: 'الأرض', en: 'Plot' }],
  ['regulations', Library, { ar: 'أنظمة البناء', en: 'Regulation' }],
  ['development', Layers3, { ar: 'التطوير', en: 'Development' }],
  ['parking', ParkingCircle, { ar: 'المواقف', en: 'Parking' }],
  ['financial', BarChart3, { ar: 'المالية', en: 'Financial' }],
  ['scenarios', Copy, { ar: 'السيناريوهات', en: 'Scenarios' }],
  ['reports', FileDown, { ar: 'التقارير', en: 'Reports' }]
] as const;

const navSecondary = [
  ['company', Landmark, { ar: 'الشركة', en: 'Company' }],
  ['backup', Archive, { ar: 'النسخ', en: 'Backup' }],
  ['settings', Settings, { ar: 'الإعدادات', en: 'Settings' }],
  ['about', Info, { ar: 'حول', en: 'About' }]
] as const;

const formatNumber = (value: number, suffix = '') => `${Math.round(value).toLocaleString()}${suffix}`;
const formatCompactSar = (value: number) => `SAR ${(value / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })} M`;
const formatSar = (value: number) => `SAR ${Math.round(value).toLocaleString()}`;
const formatPercent = (value: number) => `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
const nowLabel = (iso: string) => new Date(iso).toLocaleDateString();
const formatSetbackRule = (value: RegulationPack['setbacks']['value']['front']) => value === null ? 'Not Defined' : typeof value === 'number' ? `${value} m` : value.type === 'fixed' ? `${value.value} m` : `Street width / ${value.divisor}`;
const formatNullablePercent = (value: number | null) => value === null ? 'Not Defined' : formatPercent(value);
const inputNumberOrNull = (value: string) => value.trim() === '' ? null : Number(value);
const percentInput = (value: number | null) => value === null ? '' : String(Number((value * 100).toFixed(3)));
const percentOutput = (value: string) => value.trim() === '' ? null : Number(value) / 100;
const fixedSetbackInput = (value: RegulationPack['setbacks']['value']['front']) => typeof value === 'number' ? String(value) : value?.type === 'fixed' ? String(value.value) : '';
const divisorSetbackInput = (value: RegulationPack['setbacks']['value']['front']) => typeof value === 'object' && value?.type === 'streetWidthDivisor' ? String(value.divisor) : '';
const setbackFromInputs = (fixed: string, divisor: string, min: string, max: string): RegulationPack['setbacks']['value']['front'] => {
  if (divisor.trim()) return { type: 'streetWidthDivisor', divisor: Number(divisor), min: inputNumberOrNull(min) ?? undefined, max: inputNumberOrNull(max) ?? undefined };
  if (fixed.trim()) return Number(fixed);
  return null;
};
const definedMissingRules = (reg: RegulationPack) => {
  if (reg.definedRules || reg.missingRules) return { defined: reg.definedRules ?? [], missing: reg.missingRules ?? [] };
  const defined: string[] = [];
  const missing: string[] = [];
  if (reg.maxFloors.value === null) missing.push('Floors'); else defined.push('Floors');
  Object.entries(reg.coverage.value).forEach(([key, value]) => (value === null ? missing : defined).push(`Coverage ${key}`));
  if (reg.far.source === 'NO_FAR') defined.push('NO_FAR');
  else if (reg.far.value === null) missing.push('FAR');
  else defined.push('FAR');
  Object.entries(reg.setbacks.value).forEach(([key, value]) => (value === null ? missing : defined).push(`Setback ${key}`));
  if (reg.roofAnnexPercent.value === null) missing.push('Roof annex'); else defined.push('Roof annex');
  if (reg.parking.value.length === 0) missing.push('Parking'); else defined.push('Parking');
  return { defined, missing };
};
const manualRuleFields = (reg: RegulationPack) => {
  const rows: { label: string; field: string }[] = [];
  if (reg.maxFloors.value === null) rows.push({ label: 'Floors', field: 'maxFloors' });
  Object.entries(reg.coverage.value).forEach(([key, value]) => { if (value === null) rows.push({ label: `Coverage ${key}`, field: `coverage.${key}` }); });
  if (reg.far.value === null) rows.push({ label: reg.far.source === 'NO_FAR' ? 'Manual FAR Override for NO_FAR scenario' : 'FAR', field: 'far' });
  Object.entries(reg.setbacks.value).forEach(([key, value]) => { if (value === null) rows.push({ label: `Setback ${key}`, field: `setback.${key}` }); });
  if (reg.roofAnnexPercent.value === null) rows.push({ label: 'Roof annex percent', field: 'roofAnnexPercent' });
  if (reg.developmentDepth?.value === null) rows.push({ label: 'Development Depth', field: 'developmentDepth' });
  if (reg.parking.value.length === 0) rows.push({ label: 'Required Parking Spaces', field: 'parking.requiredSpaces' });
  return rows;
};
const desktopAPI = () => {
  if (!window.desktopAPI) throw new Error('desktopAPI preload bridge is not available.');
  return window.desktopAPI;
};
const overrideValue = (scenario: Scenario, field: string) => scenario.overrides.find((item) => item.field === field)?.usedValue ?? '';
const upsertOverride = (scenario: Scenario, field: string, usedValue: string, reason: string): Scenario => {
  const existing = scenario.overrides.find((item) => item.field === field);
  const override: ManualOverride = {
    id: existing?.id ?? crypto.randomUUID(),
    field,
    originalValue: existing?.originalValue ?? 'null',
    usedValue,
    source: 'USER_OVERRIDE',
    reason,
    createdAt: new Date().toISOString()
  };
  return { ...scenario, overrides: [...scenario.overrides.filter((item) => item.field !== field), override] };
};

export function App() {
  const store = useAppStore();
  const [toastList, setToastList] = useState<Toast[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [splash, setSplash] = useState(true);
  const [diagnostics, setDiagnostics] = useState<Record<string, string> | null>(null);
  const [dirty, setDirty] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => { void store.load(); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 700);
    return () => window.clearTimeout(timer);
  }, []);

  const lang = store.settings.language;
  const activeProject = store.projects.find((p) => p.info.id === store.activeProjectId) ?? store.projects[0] ?? null;
  const activeView = (store.activeView as ViewKey) || 'home';
  const projectContext = activeView !== 'home' && activeProject;
  const projectHeaderViews = ['overview', 'plot', 'development', 'parking', 'financial', 'scenarios', 'reports'];
  const activeScenario = activeProject?.scenarios.find((s) => s.id === activeProject.activeScenarioId) ?? activeProject?.scenarios[0];
  const activeRegulation = activeProject && activeScenario?.regulationId ? activeProject.regulationSnapshots.find((r) => r.id === activeScenario.regulationId) : null;

  useEffect(() => {
    pageRef.current?.scrollTo({ top: 0 });
  }, [activeView, store.activeProjectId]);

  const toast = (message: string, tone: Toast['tone'] = 'success') => {
    const item = { id: crypto.randomUUID(), tone, message };
    setToastList((items) => [...items, item]);
    window.setTimeout(() => setToastList((items) => items.filter((t) => t.id !== item.id)), 3200);
  };

  const markSaved = async () => {
    await store.persist();
    setDirty(false);
    toast('تم الحفظ | Project saved');
  };

  if (!store.hydrated) return <Splash theme="system" />;

  const needsProject = ['overview', 'plot', 'development', 'parking', 'financial', 'scenarios', 'reports'].includes(activeView);
  const needsRegulation = ['overview', 'plot', 'development', 'parking', 'financial', 'reports'].includes(activeView);
  const page = activeView === 'home' ? <HomeView onNew={() => setWizardOpen(true)} onOpen={() => setProjectPickerOpen(true)} toast={toast} />
    : projectContext && needsRegulation && !activeRegulation ? <NoActiveRegulationView />
    : projectContext && activeView === 'overview' ? <OverviewView project={activeProject} />
    : projectContext && activeView === 'plot' ? <PlotView project={activeProject} setDirty={setDirty} />
    : activeView === 'regulations' ? <RegulationLibraryView toast={toast} />
    : projectContext && activeView === 'development' ? <DevelopmentView project={activeProject} setDirty={setDirty} />
    : projectContext && activeView === 'parking' ? <ParkingView project={activeProject} setDirty={setDirty} />
    : projectContext && activeView === 'financial' ? <FinancialView project={activeProject} setDirty={setDirty} />
    : projectContext && activeView === 'scenarios' ? <ScenariosView project={activeProject} toast={toast} />
    : projectContext && activeView === 'reports' ? <ReportsView project={activeProject} toast={toast} />
    : activeView === 'company' ? <CompanyView setDirty={setDirty} toast={toast} />
    : activeView === 'backup' ? <BackupView toast={toast} />
    : activeView === 'settings' ? <SettingsView diagnostics={diagnostics} setDiagnostics={setDiagnostics} toast={toast} />
    : activeView === 'about' ? <AboutView />
    : needsProject ? <NoProjectView onNew={() => setWizardOpen(true)} onOpen={() => setProjectPickerOpen(true)} />
    : <HomeView onNew={() => setWizardOpen(true)} onOpen={() => setProjectPickerOpen(true)} toast={toast} />;

  if (splash) return <Splash theme={store.settings.theme} />;

  return (
    <div className={`app-shell theme-${store.settings.theme} ${store.settings.language === 'en' ? 'lang-en' : ''}`} dir={dirFor(lang)}>
      <Sidebar activeProject={activeProject} onNew={() => setWizardOpen(true)} />
      <main className="main-pane">
        <TopHeader activeView={activeView} activeProject={projectHeaderViews.includes(activeView) ? activeProject : null} dirty={dirty} onSave={markSaved} onExport={() => store.setActiveView('reports')} />
        <div className="page-scroll" ref={pageRef}>
          {page}
        </div>
      </main>
      {wizardOpen && <NewStudyWizard onClose={() => setWizardOpen(false)} toast={toast} />}
      {projectPickerOpen && <ProjectPicker onClose={() => setProjectPickerOpen(false)} toast={toast} />}
      <ToastStack items={toastList} />
    </div>
  );
}

function Splash({ theme = 'system' }: { theme?: string }) {
  return (
    <div className={`splash theme-${theme}`}>
      <BrandMark size="xl" />
      <h1>Saudi DevelopIQ</h1>
      <p>Riyadh Edition</p>
      <span>From Plot to Decision</span>
    </div>
  );
}

function BrandMark({ size = 'md', mono = false }: { size?: 'sm' | 'md' | 'lg' | 'xl'; mono?: boolean }) {
  return <img className={`brand-mark ${size} ${mono ? 'mono' : ''}`} src={officialBrandIcon} alt="DevelopIQ Land Intelligence" />;
}

function Sidebar({ activeProject, onNew }: { activeProject: ProjectRecord | null; onNew: () => void }) {
  const store = useAppStore();
  const lang = store.settings.language;
  const activeView = store.activeView as ViewKey;
  const [collapsed, setCollapsed] = useState(false);
  const go = (view: ViewKey) => store.setActiveView(activeProject || view === 'home' || navSecondary.some(([v]) => v === view) || view === 'regulations' ? view : 'home');

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button className="brand-lockup" onClick={() => store.setActiveView('home')} aria-label="Saudi DevelopIQ home">
        <BrandMark size="lg" />
        <span><strong>Saudi DevelopIQ</strong><small>Riyadh Edition</small></span>
      </button>
      <button className="collapse-control" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
      </button>
      <button className="new-study" onClick={onNew}><Plus size={17} /> <Bi ar="دراسة جديدة" en="New Study" /></button>
      <NavSection items={navPrimary} activeView={activeView} go={go} />
      <NavSection items={navSecondary} activeView={activeView} go={go} />
      <div className="current-project">
        <Caption ar="المشروع الحالي" en="Current Project" />
        {activeProject ? (
          <>
            <strong>{activeProject.info.name}</strong>
            <StatusBadge status={activeProject.info.status} />
          </>
        ) : (
          <p>{lang === 'en' ? 'No active study' : 'لا توجد دراسة نشطة'}</p>
        )}
      </div>
    </aside>
  );
}

function NavSection({ items, activeView, go }: { items: readonly (readonly [ViewKey, typeof Home, { ar: string; en: string }])[]; activeView: ViewKey; go: (view: ViewKey) => void }) {
  return (
    <nav className="nav-section">
      {items.map(([view, Icon, label]) => (
        <button key={view} className={activeView === view ? 'active' : ''} onClick={() => go(view)} title={`${label.en} / ${label.ar}`}>
          <Icon size={17} />
          <Bi ar={label.ar} en={label.en} />
        </button>
      ))}
    </nav>
  );
}

function TopHeader({ activeView, activeProject, dirty, onSave, onExport }: { activeView: ViewKey; activeProject: ProjectRecord | null; dirty: boolean; onSave: () => void; onExport: () => void }) {
  const store = useAppStore();
  if (!activeProject) {
    const titles: Record<ViewKey, string> = {
      home: 'Home',
      overview: 'Overview',
      plot: 'Plot',
      regulations: 'Regulation Library',
      development: 'Development',
      parking: 'Parking',
      financial: 'Financial',
      scenarios: 'Scenarios',
      reports: 'Reports',
      company: 'Company Profile',
      backup: 'Backup',
      settings: 'Settings',
      about: 'About'
    };
    return (
      <header className="top-header">
        <div><Breadcrumb items={['Saudi DevelopIQ', titles[activeView] ?? 'Home']} /><h1>{titles[activeView] ?? 'Home'}</h1><p>{activeView === 'home' ? 'Welcome workspace' : 'Local application workspace'}</p></div>
        <StatusBadge status="Ready" />
      </header>
    );
  }
  return (
    <header className="top-header">
      <div><Breadcrumb items={['Project', store.activeView]} /><h1>{activeProject.info.name}</h1><p>{activeProject.info.use} • Riyadh</p></div>
      <div className="header-actions">
        <StatusBadge status={activeProject.info.status} />
        <StatusBadge status={dirty ? 'Unsaved changes' : 'All changes saved'} tone={dirty ? 'warning' : 'success'} />
        <button className="button ghost" onClick={onSave}><Save size={16} />حفظ</button>
        <button className="button primary" onClick={onExport}><Download size={16} />تصدير</button>
      </div>
    </header>
  );
}

function HomeView({ onNew, onOpen, toast }: { onNew: () => void; onOpen: () => void; toast: (message: string, tone?: Toast['tone']) => void }) {
  const store = useAppStore();
  const lang = store.settings.language;
  return (
    <div className="home-layout">
      <section className="home-hero">
        <div>
          <BrandMark size="xl" />
          <Caption ar="إصدار الرياض" en="Riyadh Edition" />
          <h2>Saudi DevelopIQ</h2>
          <p>From Plot to Decision<br />من الأرض إلى قرار التطوير</p>
        </div>
        <div className="hero-actions">
          <button className="button primary large" onClick={onNew}><Plus size={18} />دراسة جديدة</button>
          <button className="button secondary large" onClick={onOpen}><FolderOpen size={18} />Open Project</button>
          <button className="button ghost large" onClick={() => { store.openDemoProject(); toast('تم فتح الدراسة التجريبية | Demo study opened', 'info'); }}><PackageOpen size={18} />Open Demo Study</button>
        </div>
      </section>
      <section className="section-block">
        <SectionHeader titleAr="المشروعات الحديثة" titleEn="Recent Projects" />
        {store.projects.length === 0 ? (
          <EmptyState title="لا توجد دراسات بعد" text="ابدأ بدراسة جديدة أو افتح الدراسة التجريبية للاختبار." action="Create your first study" onClick={onNew} />
        ) : (
          <div className="project-card-grid">{store.projects.map((project) => <ProjectCard key={project.info.id} project={project} />)}</div>
        )}
      </section>
      <section className="quick-actions">
        <QuickAction icon={<Plus size={20} />} ar="دراسة جديدة" en="New Study" onClick={onNew} />
        <QuickAction icon={<Library size={20} />} ar="مكتبة الأنظمة" en="Regulation Library" onClick={() => store.setActiveView('regulations')} />
        <QuickAction icon={<Landmark size={20} />} ar="ملف الشركة" en="Company Profile" onClick={() => store.setActiveView('company')} />
        <QuickAction icon={<Upload size={20} />} ar="استيراد نسخة" en="Import Backup" onClick={async () => { await store.importBackup(); toast('تم الاستيراد | Imported'); }} />
      </section>
      <p className="fine-print">{lang === 'en' ? 'Demo regulation packs are clearly marked and are not official Riyadh regulations.' : 'حزم الأنظمة التجريبية مميزة بوضوح وليست اشتراطات رسمية لمدينة الرياض.'}</p>
    </div>
  );
}

function NoProjectView({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  return (
    <div className="content-grid">
      <section className="panel span-12">
        <EmptyState title="لا توجد دراسة نشطة" text="اختر دراسة محفوظة أو أنشئ دراسة جديدة قبل فتح هذه الصفحة." action="Create New Study" onClick={onNew} />
        <div className="empty-actions">
          <button className="button secondary" onClick={onOpen}><FolderOpen size={16} />Open Project</button>
        </div>
      </section>
    </div>
  );
}

function ProjectPicker({ onClose, toast }: { onClose: () => void; toast: (message: string, tone?: Toast['tone']) => void }) {
  const store = useAppStore();
  return (
    <div className="modal-backdrop">
      <section className="wizard project-picker">
        <div className="wizard-header">
          <div><Caption ar="فتح مشروع" en="Open Project" /><h2>Project Picker</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {store.projects.length === 0 ? (
          <EmptyState title="لا توجد مشروعات محفوظة" text="أنشئ دراسة جديدة أو افتح الدراسة التجريبية للاختبار." action="Create New Study" onClick={() => { onClose(); store.setActiveView('home'); }} />
        ) : (
          <div className="project-picker-list">
            {store.projects.map((project) => (
              <button key={project.info.id} onClick={() => { store.setActiveProject(project.info.id); store.setActiveView('overview'); toast('تم فتح المشروع | Project opened'); onClose(); }}>
                <div>
                  <strong>{project.info.name}</strong>
                  <span>{project.info.district} • {project.info.use}</span>
                </div>
                <StatusBadge status={project.info.status} />
              </button>
            ))}
          </div>
        )}
        <button className="button ghost full" onClick={async () => { await store.importBackup(); toast('تم استيراد النسخة | Backup imported'); onClose(); }}><Upload size={16} />Import Backup</button>
      </section>
    </div>
  );
}

function QuickAction({ icon, ar, en, onClick }: { icon: React.ReactNode; ar: string; en: string; onClick: () => void }) {
  return <button onClick={onClick}>{icon}<Bi ar={ar} en={en} /></button>;
}

function ProjectCard({ project }: { project: ProjectRecord }) {
  const store = useAppStore();
  const regulation = project.regulationSnapshots.find((r) => r.id === project.scenarios[0]?.regulationId);
  const result = project.scenarios[0] && regulation ? runScenario(project.scenarios[0], regulation) : null;
  return (
    <article className="project-card">
      <div className="card-top"><h3>{project.info.name}</h3><StatusBadge status={project.info.status} /></div>
      <p>{project.info.district} • {project.info.use}</p>
      <div className="metric-pair">
        <span>Last Updated</span><strong>{nowLabel(project.info.updatedAt)}</strong>
        <span>ROI</span><strong>{result ? formatPercent(result.financial.roi) : 'N/A'}</strong>
        <span>Decision</span><strong>{result ? result.decision.label.en : 'Draft'}</strong>
      </div>
      <div className="card-actions">
        <button onClick={() => { store.setActiveProject(project.info.id); store.setActiveView('overview'); }}>Open</button>
        <button onClick={() => store.duplicateScenario(project.info.id, project.activeScenarioId)}>Duplicate</button>
        <button onClick={() => store.updateProject({ ...project, info: { ...project.info, status: 'Archived' } })}>Archive</button>
      </div>
    </article>
  );
}

function NoActiveRegulationView() {
  const store = useAppStore();
  return (
    <div className="content-grid">
      <section className="panel span-12">
        <EmptyState title="لم يتم اختيار نظام بناء" text="اختر نظام البناء يدويًا من Regulation Library قبل تشغيل أي حساب تنظيمي." action="Open Regulation Library" onClick={() => store.setActiveView('regulations')} />
      </section>
    </div>
  );
}

function OverviewView({ project }: { project: ProjectRecord }) {
  const { result, regulation } = useScenario(project);
  const lang = useAppStore((s) => s.settings.language);
  const sellable = result.outputs.sellableResidential + result.outputs.sellableRetail + result.outputs.sellableOffice;
  return (
    <div className="content-grid">
      <section className="panel span-12">
        <SectionHeader titleAr="الملخص التنفيذي" titleEn="Executive Overview" />
        <div className="executive-kpis">
          <Kpi titleAr="مساحة الأرض" titleEn="Plot Area" value={formatNumber(result.envelope.plotArea, ' m²')} />
          <Kpi titleAr="المسطحات المسموحة" titleEn="Permitted GFA" value={formatNumber(result.envelope.permittedGfa, ' m²')} />
          <Kpi titleAr="المساحة البيعية" titleEn="Sellable Area" value={formatNumber(sellable, ' m²')} />
          <Kpi titleAr="الربح المتوقع" titleEn="Expected Profit" value={formatCompactSar(result.financial.profit)} tone={result.financial.profit >= 0 ? 'good' : 'bad'} />
        </div>
      </section>
      <DecisionCard result={result} />
      <section className="panel span-4"><SectionHeader titleAr="حالة التطوير" titleEn="Development Status" /><ProgressMetric label="FAR Utilization" value={result.envelope.farUtilization} /><MiniStat label="Units" value={formatNumber(result.outputs.units)} /><MiniStat label="Basements" value={String(result.parking.basementCountRequired)} /><MiniStat label="Parking" value={result.parking.status} tone={result.parking.status === 'OK' ? 'good' : 'bad'} /></section>
      <section className="panel span-4"><SectionHeader titleAr="الحالة المالية" titleEn="Financial Status" /><MiniStat label="Development Cost" value={formatCompactSar(result.financial.totalCost)} /><MiniStat label="Revenue" value={formatCompactSar(result.financial.revenue)} /><MiniStat label="ROI" value={formatPercent(result.financial.roi)} tone={result.financial.roi > 0 ? 'good' : 'bad'} /></section>
      <section className="panel span-4">
        <SectionHeader titleAr="حالة النظام" titleEn="Regulation Status" />
        <h3>{L(regulation.name, lang)}</h3>
        <div className="metric-pair"><span>Authority</span><strong>{L(regulation.authority, lang)}</strong><span>Version</span><strong>{regulation.version}</strong><span>Verification</span><strong>{regulation.verificationStatus}</strong></div>
        {result.envelope.warnings.map((warning) => <p className="warning-line" key={warning}>{warning}</p>)}
      </section>
      <section className="panel span-6"><SectionHeader titleAr="تقدم الدراسة" titleEn="Study Progress" /><Checklist items={['Project info', 'Plot input', 'Regulation selected', 'Development envelope', 'Parking estimate', 'Financial feasibility', 'Reports ready']} /></section>
      <section className="panel span-6"><SectionHeader titleAr="المؤشرات" titleEn="Development Insights" />{result.insights.concat(result.envelope.warnings).map((item) => <Insight key={item} text={item} />)}</section>
    </div>
  );
}

function PlotView({ project, setDirty }: { project: ProjectRecord; setDirty: (dirty: boolean) => void }) {
  const store = useAppStore();
  const { scenario, regulation, result } = useScenario(project);
  const updateScenario = (patch: Partial<typeof scenario>) => {
    const scenarios = project.scenarios.map((s) => s.id === scenario.id ? { ...s, ...patch } : s);
    store.updateProject({ ...project, scenarios });
    setDirty(true);
  };
  const updatePlot = (patch: Partial<typeof scenario.plot>) => updateScenario({ plot: { ...scenario.plot, ...patch } });
  return (
    <div className="content-grid">
      <section className="panel span-5">
        <SectionHeader titleAr="مدخلات الأرض" titleEn="Plot Inputs" />
        <Field labelAr="المساحة الرسمية" labelEn="Official Area" unit="m²" helper="تستخدم في الحسابات التنظيمية والمالية." value={scenario.plot.officialArea} onChange={(v) => updatePlot({ officialArea: v })} />
        <Field labelAr="الطول" labelEn="Length" unit="m" value={scenario.plot.length ?? 0} onChange={(v) => updatePlot({ length: v })} />
        <Field labelAr="العرض" labelEn="Width" unit="m" value={scenario.plot.width ?? 0} onChange={(v) => updatePlot({ width: v })} />
        <label className="field"><span><Bi ar="دقة البيانات" en="Accuracy" /></span><select value={scenario.plot.accuracy} onChange={(e) => updatePlot({ accuracy: e.target.value as typeof scenario.plot.accuracy })}><option>Exact</option><option>Approximate</option><option>Area Only</option></select></label>
        {result.envelope.areaDifference ? <p className="warning-line">يوجد فرق بين المساحة الهندسية والرسمية: {formatNumber(result.envelope.areaDifference, ' m²')}</p> : null}
      </section>
      <section className="panel span-7"><SectionHeader titleAr="الغلاف البصري للأرض" titleEn="Visual Plot" /><VisualPlot result={result.envelope} regulation={regulation} /></section>
      <section className="panel span-12">
        <SectionHeader titleAr="حدود الأرض" titleEn="Boundaries" />
        <div className="boundary-grid">
          {scenario.plot.boundaries.map((boundary, index) => (
            <article className="boundary-card" key={boundary.side}>
              <div className={`edge edge-${boundary.side}`} />
              <h3>{boundary.side}</h3>
              <label><span>Boundary Type</span><select value={boundary.type} onChange={(e) => {
                const boundaries = scenario.plot.boundaries.map((row, i) => i === index ? { ...row, type: e.target.value as typeof row.type } : row);
                updatePlot({ boundaries });
              }}><option>Street</option><option>Neighbor</option><option>Corridor</option><option>Other</option></select></label>
              <label><span>Width</span><input type="number" value={boundary.width ?? ''} onChange={(e) => {
                const boundaries = scenario.plot.boundaries.map((row, i) => i === index ? { ...row, width: Number(e.target.value) } : row);
                updatePlot({ boundaries });
              }} /></label>
              {boundary.type === 'Street' && <label><span>Street Role</span><select value={boundary.streetRole ?? (boundary.side === 'front' ? 'main' : 'secondary')} onChange={(e) => {
                const boundaries = scenario.plot.boundaries.map((row, i) => i === index ? { ...row, streetRole: e.target.value as typeof row.streetRole } : row);
                updatePlot({ boundaries });
              }}><option value="main">Main</option><option value="secondary">Secondary</option><option value="commercial">Commercial</option><option value="kingFahd">King Fahd</option><option value="olaya">Olaya</option></select></label>}
              <small>Setback rule: {formatSetbackRule(regulation.setbacks.value[boundary.side])} • Actual: {result.envelope.setbacks[boundary.side]} m</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function RegulationLibraryView({ toast }: { toast: (message: string, tone?: Toast['tone']) => void }) {
  const store = useAppStore();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState<RegulationPack | null>(null);
  const activeProject = store.projects.find((p) => p.info.id === store.activeProjectId);
  const filtered = store.regulations.filter((reg) => (`${reg.name.ar} ${reg.name.en} ${reg.code} ${reg.planningZone}`.toLowerCase().includes(query.toLowerCase())) && (status === 'All' || reg.verificationStatus === status));
  const applyReg = (regulation: RegulationPack) => {
    if (!activeProject) return toast('لا توجد دراسة نشطة لتطبيق النظام عليها', 'warning');
    const scenarios = activeProject.scenarios.map((s) => s.id === activeProject.activeScenarioId ? { ...s, regulationId: regulation.id } : s);
    store.updateProject({ ...activeProject, scenarios, regulationSnapshots: [structuredClone(regulation), ...activeProject.regulationSnapshots.filter((snapshot) => snapshot.id !== regulation.id)] });
    toast('تم تطبيق نظام البناء على السيناريو الحالي');
  };
  return (
    <div className="content-grid">
      <section className="panel span-12">
        <SectionHeader titleAr="مكتبة أنظمة البناء" titleEn="Regulation Library" actions={<button className="button primary" onClick={() => { store.createCustomRegulation(); toast('تم إنشاء نسخة مخصصة | Custom copy created'); }}><Plus size={16} />Custom Copy</button>} />
        <div className="filter-bar">
          <label className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by regulation name, code or planning zone" /></label>
          <select><option>All Authorities</option><option>Riyadh Municipality</option><option>RCRC</option><option>MOMAH / Balady</option></select>
          <select value={status} onChange={(e) => setStatus(e.target.value)}><option>All</option><option>VERIFIED</option><option>USER_REFERENCE_CALCULABLE</option><option>USER_REFERENCE</option><option>LOCATION_DEPENDENT</option><option>AUTHORITY_CONFIRMATION</option><option>UNVERIFIED</option><option>DEMO_ONLY</option></select>
          <select><option>All Uses</option>{projectUses.map((use) => <option key={use}>{use}</option>)}</select>
        </div>
      </section>
      {filtered.length === 0 ? <EmptyPanel title="لا توجد أنظمة مطابقة" text="غيّر البحث أو أنشئ نسخة مخصصة." /> : filtered.map((reg) => (
        <article className="panel span-6 regulation-card" key={reg.id}>
          <div className="card-top"><h3>{reg.name.en}<small>{reg.name.ar}</small></h3><StatusBadge status={reg.verificationStatus} /></div>
          <div className="metric-pair"><span>Code</span><strong>{reg.code}</strong><span>Authority</span><strong>{reg.authority.en}</strong><span>Version</span><strong>{reg.version}</strong><span>FAR / Ground Coverage</span><strong>{reg.far.value ?? 'Not Defined'} / {formatNullablePercent(reg.coverage.value.ground)}</strong><span>Defined Rules</span><strong>{definedMissingRules(reg).defined.join(', ') || 'None'}</strong><span>Missing Rules</span><strong>{definedMissingRules(reg).missing.join(', ') || 'None'}</strong></div>
          <div className="card-actions"><button disabled={definedMissingRules(reg).defined.length === 0} title={definedMissingRules(reg).defined.length === 0 ? 'No calculation rules defined yet' : 'Use'} onClick={() => applyReg(reg)}>{definedMissingRules(reg).defined.length === 0 ? 'No Rules' : 'Use'}</button><button onClick={() => setSelected(reg)}><Eye size={14} />Details</button><button onClick={() => { store.createCustomRegulation(); toast('تم نسخ النظام كنسخة مخصصة'); }}><Copy size={14} />Duplicate</button></div>
        </article>
      ))}
      {selected && <RegulationDrawer regulation={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function RegulationDrawer({ regulation, onClose }: { regulation: RegulationPack; onClose: () => void }) {
  const store = useAppStore();
  const [draft, setDraft] = useState<RegulationPack>(() => structuredClone(regulation));
  const [tab, setTab] = useState('Overview');
  const tabs = ['Overview', 'Edit', 'Floors', 'Coverage', 'Setbacks', 'FAR', 'Parking', 'Sources', 'Notes'];
  const activeProject = store.projects.find((p) => p.info.id === store.activeProjectId);
  const activeScenario = activeProject?.scenarios.find((s) => s.id === activeProject.activeScenarioId);
  const saveDraft = () => {
    store.updateRegulation(draft);
    setTab('Overview');
  };
  const addManualOverride = (field: string) => {
    if (!activeProject || !activeScenario) return;
    const usedValue = window.prompt(`Manual value for ${field}`);
    if (!usedValue) return;
    const reason = window.prompt('Reason / Note (optional)') ?? '';
    const override = { id: crypto.randomUUID(), field, originalValue: 'null', usedValue, source: 'USER_OVERRIDE' as const, reason, createdAt: new Date().toISOString() };
    const scenarios = activeProject.scenarios.map((scenario) => scenario.id === activeScenario.id ? { ...scenario, overrides: [...scenario.overrides.filter((item) => item.field !== field), override] } : scenario);
    const changeLog = [...activeProject.changeLog, { id: crypto.randomUUID(), date: override.createdAt, field, oldValue: 'Not Defined', newValue: usedValue, changedBy: 'User', reason: reason || 'USER_OVERRIDE manual input' }];
    store.updateProject({ ...activeProject, scenarios, changeLog });
  };
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header"><h2>{draft.name.en}</h2><div className="card-actions"><button onClick={saveDraft}>Save Regulation</button><button onClick={onClose}>Close</button></div></div>
        <div className="tabs">{tabs.map((item) => <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
        <div className="drawer-body">
          {tab === 'Overview' && <><RuleRows rows={[['Code', draft.code], ['Authority', draft.authority.en], ['Planning Zone', draft.planningZone], ['Verification', draft.verificationStatus], ['Defined Rules', definedMissingRules(draft).defined.join(', ') || 'None'], ['Missing Rules', definedMissingRules(draft).missing.join(', ') || 'None']]} /><h3>Manual-input-enabled missing rules</h3><div className="card-actions">{manualRuleFields(draft).map((rule) => <button key={rule.field} onClick={() => addManualOverride(rule.field)}>Enter {rule.label}</button>)}</div>{activeScenario?.overrides.length ? <RuleRows rows={activeScenario.overrides.map((item) => [item.field, `${item.usedValue} | ${item.source} | ${item.reason}`])} /> : null}</>}
          {tab === 'Edit' && <RegulationEditForm draft={draft} setDraft={setDraft} onSave={saveDraft} />}
          {tab === 'Floors' && <RuleRows rows={[['Maximum Floors', draft.maxFloors.value === null ? 'Not Defined' : String(draft.maxFloors.value)], ['Roof Annex', formatNullablePercent(draft.roofAnnexPercent.value)], ['Status', draft.maxFloors.status]]} />}
          {tab === 'Coverage' && <RuleRows rows={Object.entries(draft.coverage.value).map(([k, v]) => [k, formatNullablePercent(v)])} />}
          {tab === 'Setbacks' && <RuleRows rows={Object.entries(draft.setbacks.value).map(([k, v]) => [k, formatSetbackRule(v)])} />}
          {tab === 'FAR' && <RuleRows rows={[['FAR', draft.far.value === null ? 'Not Defined' : String(draft.far.value)], ['Source', draft.far.source], ['Status', draft.far.status]]} />}
          {tab === 'Parking' && <RuleRows rows={draft.parking.value.length ? draft.parking.value.map((r) => [String(r.use), `${r.ratio} / ${r.basis}`]) : [['Parking', 'Not Defined']]} />}
          {tab === 'Sources' && <RuleRows rows={[['Source', draft.source], ['Reference', draft.sourceReference], ['Verification Date', draft.verificationDate]]} />}
          {tab === 'Notes' && <p>{draft.notes.en}<br />{draft.notes.ar}</p>}
        </div>
      </aside>
    </div>
  );
}

function RegulationEditForm({ draft, setDraft, onSave }: { draft: RegulationPack; setDraft: (draft: RegulationPack) => void; onSave: () => void }) {
  const setCoverage = (field: keyof RegulationPack['coverage']['value'], value: string) => setDraft({ ...draft, coverage: { ...draft.coverage, value: { ...draft.coverage.value, [field]: percentOutput(value) }, status: 'USER_REFERENCE_CALCULABLE', source: 'User edited regulation pack' } });
  const setSetback = (side: keyof RegulationPack['setbacks']['value'], value: RegulationPack['setbacks']['value']['front']) => setDraft({ ...draft, setbacks: { ...draft.setbacks, value: { ...draft.setbacks.value, [side]: value }, status: 'USER_REFERENCE_CALCULABLE', source: 'User edited regulation pack' } });
  const setProfile = (profile: NonNullable<RegulationPack['setbackProfiles']> extends infer T ? keyof T : never, value: RegulationPack['setbacks']['value']['front']) => setDraft({ ...draft, setbackProfiles: { ...(draft.setbackProfiles ?? {}), [profile]: value } });
  const updateParkingRule = (index: number, patch: Partial<RegulationPack['parking']['value'][number]>) => {
    const value = draft.parking.value.map((rule, i) => i === index ? { ...rule, ...patch, status: 'USER_REFERENCE_CALCULABLE' as const } : rule);
    setDraft({ ...draft, parking: { ...draft.parking, value, status: 'USER_REFERENCE_CALCULABLE', source: 'User edited regulation pack' } });
  };
  const addParkingRule = () => setDraft({ ...draft, parking: { ...draft.parking, value: [...draft.parking.value, { use: 'Residential Apartments', ratio: 1, basis: 'unit', status: 'USER_REFERENCE_CALCULABLE' }], status: 'USER_REFERENCE_CALCULABLE', source: 'User edited regulation pack' } });
  return (
    <div className="content-grid">
      <section className="panel span-12">
        <SectionHeader titleAr="تعديل نظام البناء" titleEn="Edit Regulation Pack" actions={<button className="button primary" onClick={onSave}>Save Regulation</button>} />
        <InputGroup>
          <TextField label="Code" value={draft.code} onChange={(code) => setDraft({ ...draft, code })} />
          <TextField label="Name EN" value={draft.name.en} onChange={(en) => setDraft({ ...draft, name: { ...draft.name, en } })} />
          <TextField label="Name AR" value={draft.name.ar} onChange={(ar) => setDraft({ ...draft, name: { ...draft.name, ar } })} />
          <TextField label="Source Reference" value={draft.sourceReference} onChange={(sourceReference) => setDraft({ ...draft, sourceReference })} />
        </InputGroup>
      </section>
      <section className="panel span-6">
        <SectionHeader titleAr="معامل البناء والأدوار" titleEn="FAR & Floors" />
        <InputGroup>
          <Field labelAr="أقصى عدد أدوار" labelEn="Maximum Floors" value={draft.maxFloors.value ?? 0} onChange={(value) => setDraft({ ...draft, maxFloors: { ...draft.maxFloors, value: value || null, status: 'USER_REFERENCE_CALCULABLE', source: 'User edited regulation pack' } })} helper="اتركه 0 للحفظ كـ Not Defined." />
          <Field labelAr="معامل البناء" labelEn="FAR" value={draft.far.value ?? 0} onChange={(value) => setDraft({ ...draft, far: { ...draft.far, value: value || null, source: value ? 'User edited regulation pack' : draft.far.source === 'NO_FAR' ? 'NO_FAR' : 'Not defined', status: value ? 'USER_REFERENCE_CALCULABLE' : 'USER_REFERENCE' } })} helper="اكتب 0 لو غير محدد. لو النظام NO_FAR سيظل كذلك حتى تدخل رقمًا هنا." />
          <Field labelAr="ملحق السطح" labelEn="Roof Annex" unit="%" value={Number(percentInput(draft.roofAnnexPercent.value) || 0)} onChange={(value) => setDraft({ ...draft, roofAnnexPercent: { ...draft.roofAnnexPercent, value: value ? value / 100 : null, status: value ? 'USER_REFERENCE_CALCULABLE' : 'USER_REFERENCE', source: value ? 'User edited regulation pack' : 'Not defined' } })} />
        </InputGroup>
      </section>
      <section className="panel span-6">
        <SectionHeader titleAr="نسب التغطية" titleEn="Coverage" />
        <InputGroup>
          {(['ground', 'first', 'typical', 'roof'] as const).map((field) => <Field key={field} labelAr={field} labelEn={`${field} coverage`} unit="%" value={Number(percentInput(draft.coverage.value[field]) || 0)} onChange={(value) => setCoverage(field, value ? String(value) : '')} />)}
        </InputGroup>
      </section>
      <section className="panel span-12">
        <SectionHeader titleAr="الارتدادات المباشرة" titleEn="Setbacks" />
        <InputGroup>
          {(['front', 'right', 'left', 'rear'] as const).map((side) => <SetbackEditor key={side} label={side} value={draft.setbacks.value[side]} onChange={(value) => setSetback(side, value)} />)}
        </InputGroup>
      </section>
      <section className="panel span-12">
        <SectionHeader titleAr="ارتدادات حسب نوع الحد" titleEn="Setback Profiles" />
        <InputGroup>
          {(['mainStreet', 'secondaryStreet', 'neighbor', 'commercialStreet', 'kingFahdRoad', 'olayaStreet'] as const).map((profile) => <SetbackEditor key={profile} label={profile} value={draft.setbackProfiles?.[profile] ?? null} onChange={(value) => setProfile(profile, value)} />)}
        </InputGroup>
      </section>
      <section className="panel span-12">
        <SectionHeader titleAr="قواعد المواقف" titleEn="Parking Rules" actions={<button className="button secondary" onClick={addParkingRule}>Add Parking Rule</button>} />
        <div className="data-table">
          <table>
            <thead><tr><th>Use</th><th>Ratio</th><th>Basis</th><th>Action</th></tr></thead>
            <tbody>{draft.parking.value.map((rule, index) => <tr key={`${rule.use}-${index}`}><td><select value={rule.use} onChange={(e) => updateParkingRule(index, { use: e.target.value as typeof rule.use })}>{['Residential Villas', 'Residential Apartments', 'Retail', 'Office'].map((use) => <option key={use}>{use}</option>)}</select></td><td><input type="number" value={rule.ratio} onChange={(e) => updateParkingRule(index, { ratio: Number(e.target.value) })} /></td><td><select value={rule.basis} onChange={(e) => updateParkingRule(index, { basis: e.target.value as typeof rule.basis })}><option value="unit">unit</option><option value="100sqm">100sqm</option></select></td><td><button onClick={() => setDraft({ ...draft, parking: { ...draft.parking, value: draft.parking.value.filter((_, i) => i !== index) } })}>Remove</button></td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SetbackEditor({ label, value, onChange }: { label: string; value: RegulationPack['setbacks']['value']['front']; onChange: (value: RegulationPack['setbacks']['value']['front']) => void }) {
  const [fixed, setFixed] = useState(fixedSetbackInput(value));
  const [divisor, setDivisor] = useState(divisorSetbackInput(value));
  const [min, setMin] = useState(typeof value === 'object' && value?.type === 'streetWidthDivisor' && value.min !== undefined ? String(value.min) : '');
  const [max, setMax] = useState(typeof value === 'object' && value?.type === 'streetWidthDivisor' && value.max !== undefined ? String(value.max) : '');
  useEffect(() => { onChange(setbackFromInputs(fixed, divisor, min, max)); }, [fixed, divisor, min, max]);
  return <label className="field"><span>{label}</span><input type="number" placeholder="Fixed m" value={fixed} onChange={(e) => { setFixed(e.target.value); if (e.target.value) setDivisor(''); }} /><input type="number" placeholder="Street width divisor" value={divisor} onChange={(e) => { setDivisor(e.target.value); if (e.target.value) setFixed(''); }} /><input type="number" placeholder="Min" value={min} onChange={(e) => setMin(e.target.value)} /><input type="number" placeholder="Max" value={max} onChange={(e) => setMax(e.target.value)} /><small>فارغ = Not Defined. مثال width/5: اكتب divisor = 5.</small></label>;
}

function DevelopmentView({ project, setDirty }: { project: ProjectRecord; setDirty: (dirty: boolean) => void }) {
  const store = useAppStore();
  const { scenario, result, regulation } = useScenario(project);
  const setOverride = (field: string, value: number) => {
    const nextScenario = upsertOverride(scenario, field, String(value), 'Manual value entered from Development page');
    const scenarios = project.scenarios.map((item) => item.id === scenario.id ? nextScenario : item);
    store.updateProject({ ...project, scenarios, changeLog: [...project.changeLog, { id: crypto.randomUUID(), date: new Date().toISOString(), field, oldValue: 'Calculated / Not Defined', newValue: String(value), changedBy: 'User', reason: 'USER_OVERRIDE' }] });
    setDirty(true);
  };
  return (
    <div className="content-grid">
      <section className="panel span-12"><SectionHeader titleAr="الغلاف البنائي" titleEn="Development Envelope" /><div className="executive-kpis five"><Kpi titleAr="أقصى بصمة هندسية" titleEn="Geometric Footprint" value={formatNumber(result.envelope.geometricFootprint, ' m²')} /><Kpi titleAr="حد التغطية" titleEn="Coverage Limit" value={formatNumber(result.envelope.coverageLimit, ' m²')} /><Kpi titleAr="البصمة النهائية" titleEn="Final Footprint" value={formatNumber(result.envelope.finalFootprint, ' m²')} /><Kpi titleAr="معامل البناء المحقق" titleEn="Achieved FAR" value={String(result.envelope.achievedFar)} /><Kpi titleAr="القيد الحاكم" titleEn="Controlling Constraint" value={result.envelope.controllingConstraint} tone="warn" /></div></section>
      <section className="panel span-12"><SectionHeader titleAr="مصدر معامل البناء" titleEn="FAR Source" /><RuleRows rows={[['FAR Type', result.envelope.farSource], ['How Calculated', result.envelope.farHowCalculated || 'Not Defined']]} />{regulation.far.value === null && <InputGroup><Field labelAr="معامل بناء يدوي" labelEn="Manual FAR Override" value={Number(overrideValue(scenario, 'far') || 0)} onChange={(value) => setOverride('far', value)} helper={regulation.far.source === 'NO_FAR' ? 'النظام الأصلي NO_FAR. هذه قيمة يدوية للسيناريو فقط وتطبق كـ USER_OVERRIDE ولا تعدل النظام.' : 'يستخدم في الحساب كـ USER_OVERRIDE ولا يعدل نظام البناء الأصلي.'} /></InputGroup>}</section>
      <section className="panel span-6"><SectionHeader titleAr="كتلة المبنى" titleEn="Building Stack" /><BuildingStack result={result} /></section>
      <section className="panel span-6"><SectionHeader titleAr="الأرض والارتدادات" titleEn="Plot & Setbacks" /><VisualPlot result={result.envelope} regulation={regulation} /></section>
      <section className="panel span-12"><SectionHeader titleAr="جدول الأدوار" titleEn="Floor-by-Floor" /><DataTable headers={['Floor', 'Coverage Limit', 'Geometry Limit', 'Zone Limit', 'FAR Limit', 'Final Allowed Area']} rows={result.envelope.floorAreas.map((r) => [r.floor, `${formatNumber(r.coverageLimit)} m²`, `${formatNumber(r.geometryLimit)} m²`, `${formatNumber(r.zoneLimit)} m²`, `${formatNumber(r.farLimit)} m²`, `${formatNumber(r.finalAllowedArea)} m²`])} /></section>
      <section className="panel span-12 insight-panel"><Gauge size={22} /><div><strong>Controlling Constraint</strong><p>{result.envelope.controllingConstraint} is limiting the final allowed area in the current scenario.</p></div></section>
    </div>
  );
}

function ParkingView({ project, setDirty }: { project: ProjectRecord; setDirty: (dirty: boolean) => void }) {
  const store = useAppStore();
  const { scenario, result } = useScenario(project);
  const setBasements = (basementCount: number) => {
    const scenarios = project.scenarios.map((s) => s.id === scenario.id ? { ...s, basementCount } : s);
    store.updateProject({ ...project, scenarios });
    setDirty(true);
  };
  const updateScenario = (patch: Partial<typeof scenario>) => {
    const scenarios = project.scenarios.map((s) => s.id === scenario.id ? { ...s, ...patch } : s);
    store.updateProject({ ...project, scenarios });
    setDirty(true);
  };
  const setOverride = (field: string, value: number) => {
    const nextScenario = upsertOverride(scenario, field, String(value), 'Manual value entered from Parking page');
    const scenarios = project.scenarios.map((item) => item.id === scenario.id ? nextScenario : item);
    store.updateProject({ ...project, scenarios, changeLog: [...project.changeLog, { id: crypto.randomUUID(), date: new Date().toISOString(), field, oldValue: 'Calculated / Not Defined', newValue: String(value), changedBy: 'User', reason: 'USER_OVERRIDE' }] });
    setDirty(true);
  };
  const totalAvailable = result.parking.providedSpaces;
  const balance = result.parking.balance;
  return (
    <div className="content-grid">
      <section className="panel span-8"><SectionHeader titleAr="طلب وعرض المواقف" titleEn="Parking Demand & Supply" /><label className="field"><span>Development Use</span><select value={scenario.developmentUse ?? ''} onChange={(e) => updateScenario({ developmentUse: e.target.value as Scenario['developmentUse'] })}><option value="">Select use for parking</option>{projectUses.filter((use) => use !== 'Manual / Custom Study').map((use) => <option key={use}>{use}</option>)}</select></label><InputGroup><Field labelAr="عدد الوحدات السكنية" labelEn="Apartment / Unit Count" value={Number(overrideValue(scenario, 'units') || result.outputs.units)} onChange={(value) => setOverride('units', value)} helper="الرقم المقترح قابل للتعديل ويستخدم في حساب المواقف." /><Field labelAr="عدد الفلل" labelEn="Villa Count" value={Number(overrideValue(scenario, 'villas') || result.outputs.villas)} onChange={(value) => setOverride('villas', value)} helper="يستخدم عند اختيار Residential Villas." /><Field labelAr="المواقف المطلوبة يدويًا" labelEn="Manual Required Parking" value={Number(overrideValue(scenario, 'parking.requiredSpaces') || result.parking.requiredSpaces)} onChange={(value) => setOverride('parking.requiredSpaces', value)} helper="استخدمه عند عدم وجود قاعدة مواقف في النظام." /></InputGroup><div className="parking-board"><Kpi titleAr="المواقف المطلوبة" titleEn="Required Parking" value={String(result.parking.requiredSpaces)} /><Kpi titleAr="المواقف السطحية" titleEn="Surface Parking" value={String(result.parking.surfaceParking)} /><Kpi titleAr="الرصيد" titleEn="Balance" value={balance >= 0 ? `+${balance}` : String(balance)} tone={balance >= 0 ? 'good' : 'bad'} /></div><RuleRows rows={[['Surface Mode', result.parking.surfaceParkingMode], ['Layout', result.parking.parkingLayout], ['Auto Surface Spaces', String(result.parking.autoSurfaceParking)], ['Rule', result.parking.parkingLayout === 'ANGLED_45' ? '45 degree, 5.5m x 2.8m for street >= 30m' : result.parking.parkingLayout === 'PERPENDICULAR' ? 'Perpendicular, 5.5m x 2.8m for street < 30m' : 'Not applicable']]} /><ParkingGauge value={totalAvailable / Math.max(1, result.parking.requiredSpaces)} />{balance < 0 && <Insight text="Parking is the controlling development constraint." tone="warning" />}</section>
      <section className="panel span-4 sticky-card"><SectionHeader titleAr="الأقبية" titleEn="Basements" /><Field labelAr="الأقبية المقدمة" labelEn="Provided Basements" value={scenario.basementCount} onChange={setBasements} /><Field labelAr="المواقف السطحية اليدوية" labelEn="Manual Surface Parking" value={scenario.surfaceParking ?? result.parking.autoSurfaceParking} onChange={(surfaceParking) => updateScenario({ surfaceParking })} helper="اترك المشروع الجديد بدون قيمة ليحسب الشارع تلقائيًا. تعديلك هنا يحولها Manual." /><Field labelAr="كفاءة المواقف" labelEn="Parking Efficiency" unit="m²/space" value={scenario.parkingEfficiencySqmPerSpace ?? 30} onChange={(parkingEfficiencySqmPerSpace) => updateScenario({ parkingEfficiencySqmPerSpace })} /><MiniStat label="Required Basements" value={String(result.parking.basementCountRequired)} /><MiniStat label="Spaces / Basement" value={String(result.parking.spacesPerBasement)} /><StatusBadge status={result.parking.status} tone={result.parking.status === 'OK' ? 'success' : 'warning'} /></section>
    </div>
  );
}

function FinancialView({ project, setDirty }: { project: ProjectRecord; setDirty: (dirty: boolean) => void }) {
  const store = useAppStore();
  const [tab, setTab] = useState('Land');
  const { scenario, result } = useScenario(project);
  const update = (field: keyof typeof scenario.financial, value: number) => {
    const scenarios = project.scenarios.map((s) => s.id === scenario.id ? { ...s, financial: { ...s.financial, [field]: value } } : s);
    store.updateProject({ ...project, scenarios });
    setDirty(true);
  };
  const updateMix = (field: keyof typeof scenario.productMix, value: number) => {
    const scenarios = project.scenarios.map((s) => s.id === scenario.id ? { ...s, productMix: { ...s.productMix, [field]: value } } : s);
    store.updateProject({ ...project, scenarios });
    setDirty(true);
  };
  const costData = [{ name: 'Land', value: result.financial.landCost }, { name: 'Construction', value: result.financial.constructionCost }, { name: 'Soft Costs', value: result.financial.softCosts }];
  return (
    <div className="content-grid">
      <section className="panel span-7">
        <SectionHeader titleAr="المدخلات المالية" titleEn="Financial Inputs" />
        <div className="tabs">{['Land', 'Construction', 'Soft Costs', 'Sales', 'Assumptions'].map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
        {tab === 'Land' && <InputGroup><Field labelAr="سعر الأرض" labelEn="Land Price" unit="SAR/m²" value={scenario.financial.landPrice} onChange={(v) => update('landPrice', v)} /><DisabledField label="Brokerage" reason="سيتم تفعيله عند إضافة تكاليف الاستحواذ التفصيلية." /><DisabledField label="Other Acquisition Cost" reason="غير مستخدم في محرك V1 الحالي." /></InputGroup>}
        {tab === 'Construction' && <InputGroup><Field labelAr="تكلفة العظم" labelEn="Structural Rate" unit="SAR/m²" value={scenario.financial.structuralRate} onChange={(v) => update('structuralRate', v)} /><Field labelAr="تكلفة التشطيب" labelEn="Finishing Rate" unit="SAR/m²" value={scenario.financial.finishingRate} onChange={(v) => update('finishingRate', v)} /><Field labelAr="الأعمال الكهروميكانيكية" labelEn="MEP Rate" unit="SAR/m²" value={scenario.financial.mepRate} onChange={(v) => update('mepRate', v)} /><Field labelAr="تكلفة القبو" labelEn="Basement Rate" unit="SAR/m²" value={scenario.financial.basementRate} onChange={(v) => update('basementRate', v)} /></InputGroup>}
        {tab === 'Soft Costs' && <InputGroup><PercentField labelAr="التسويق" labelEn="Marketing" value={scenario.financial.marketingPercent} onChange={(v) => update('marketingPercent', v)} /><PercentField labelAr="عمولة البيع" labelEn="Sales Commission" value={scenario.financial.salesCommissionPercent} onChange={(v) => update('salesCommissionPercent', v)} /><PercentField labelAr="احتياطي مخاطر" labelEn="Contingency" value={scenario.financial.contingencyPercent} onChange={(v) => update('contingencyPercent', v)} /></InputGroup>}
        {tab === 'Sales' && <InputGroup><Field labelAr="سعر بيع السكني" labelEn="Residential Selling Price" unit="SAR/m²" value={scenario.financial.sellingPriceResidential} onChange={(v) => update('sellingPriceResidential', v)} /><Field labelAr="سعر بيع التجاري" labelEn="Retail Selling Price" unit="SAR/m²" value={scenario.financial.sellingPriceRetail} onChange={(v) => update('sellingPriceRetail', v)} /><Field labelAr="سعر بيع المكتبي" labelEn="Office Selling Price" unit="SAR/m²" value={scenario.financial.sellingPriceOffice} onChange={(v) => update('sellingPriceOffice', v)} /></InputGroup>}
        {tab === 'Assumptions' && <InputGroup><PercentField labelAr="كفاءة بيع السكني" labelEn="Residential Efficiency" value={scenario.financial.sellableEfficiencyResidential} onChange={(v) => update('sellableEfficiencyResidential', v)} /><PercentField labelAr="كفاءة بيع التجاري" labelEn="Retail Efficiency" value={scenario.financial.sellableEfficiencyRetail} onChange={(v) => update('sellableEfficiencyRetail', v)} /><PercentField labelAr="كفاءة بيع المكتبي" labelEn="Office Efficiency" value={scenario.financial.sellableEfficiencyOffice} onChange={(v) => update('sellableEfficiencyOffice', v)} /><Field labelAr="متوسط مساحة الوحدة" labelEn="Average Unit Area" unit="m²" value={scenario.productMix.averageUnitArea} onChange={(v) => updateMix('averageUnitArea', v)} /><PercentField labelAr="حصة السكني" labelEn="Residential Share" value={scenario.productMix.residentialShare} onChange={(v) => updateMix('residentialShare', v)} /><PercentField labelAr="حصة التجاري" labelEn="Retail Share" value={scenario.productMix.retailShare} onChange={(v) => updateMix('retailShare', v)} /><PercentField labelAr="حصة المكتبي" labelEn="Office Share" value={scenario.productMix.officeShare} onChange={(v) => updateMix('officeShare', v)} /></InputGroup>}
      </section>
      <section className="panel span-5 sticky-card"><SectionHeader titleAr="ملخص الربحية" titleEn="Profitability Summary" /><Kpi titleAr="تكلفة التطوير" titleEn="Development Cost" value={formatCompactSar(result.financial.totalCost)} /><Kpi titleAr="الإيراد" titleEn="Revenue" value={formatCompactSar(result.financial.revenue)} /><Kpi titleAr="الربح" titleEn="Profit" value={formatCompactSar(result.financial.profit)} tone={result.financial.profit >= 0 ? 'good' : 'bad'} /><Kpi titleAr="العائد" titleEn="ROI" value={formatPercent(result.financial.roi)} tone={result.financial.roi >= 0.1 ? 'good' : 'bad'} /></section>
      <section className="panel span-6"><SectionHeader titleAr="تفصيل التكلفة" titleEn="Cost Breakdown" /><ChartBox><PieChart><Pie data={costData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92}>{costData.map((_, i) => <Cell key={i} fill={chartColors[i]} />)}</Pie><Tooltip formatter={(v) => formatSar(Number(v))} /></PieChart></ChartBox></section>
      <section className="panel span-6"><SectionHeader titleAr="الإيراد مقابل التكلفة" titleEn="Revenue vs Cost vs Profit" /><ChartBox><BarChart data={[{ name: 'Scenario', Cost: result.financial.totalCost, Revenue: result.financial.revenue, Profit: result.financial.profit }]}><CartesianGrid vertical={false} /><XAxis dataKey="name" /><YAxis tickFormatter={(v) => `${Number(v) / 1_000_000}M`} /><Tooltip formatter={(v) => formatSar(Number(v))} /><Bar dataKey="Cost" fill="#766f63" /><Bar dataKey="Revenue" fill="#1d6b5d" /><Bar dataKey="Profit" fill="#d2a84f" /></BarChart></ChartBox></section>
      <section className="panel span-12"><SectionHeader titleAr="التدفق النقدي" titleEn="Cash Flow" /><div className="cash-kpis"><MiniStat label="Peak Funding" value={formatCompactSar(result.financial.peakFunding)} /><MiniStat label="Break-Even Month" value={result.financial.breakEvenMonth ? String(result.financial.breakEvenMonth) : 'N/A'} /><MiniStat label="IRR" value={result.financial.irr ? formatPercent(result.financial.irr) : 'N/A'} /><MiniStat label="NPV" value={formatCompactSar(result.financial.npv)} /></div><ChartBox tall><LineChart data={result.financial.monthlyCashFlow}><CartesianGrid vertical={false} /><XAxis dataKey="month" /><YAxis tickFormatter={(v) => `${Number(v) / 1_000_000}M`} /><Tooltip formatter={(v) => formatSar(Number(v))} /><Line type="monotone" dataKey="net" stroke="#d2a84f" strokeWidth={2} /><Line type="monotone" dataKey="cumulative" stroke="#1d6b5d" strokeWidth={2} /></LineChart></ChartBox><DataTable headers={['Month', 'Cost', 'Revenue', 'Net', 'Cumulative']} rows={result.financial.monthlyCashFlow.map((r) => [String(r.month), formatSar(r.cost), formatSar(r.revenue), formatSar(r.net), formatSar(r.cumulative)])} /></section>
    </div>
  );
}

function ScenariosView({ project, toast }: { project: ProjectRecord; toast: (message: string, tone?: Toast['tone']) => void }) {
  const store = useAppStore();
  const rows = project.scenarios.map((scenario) => {
    const reg = project.regulationSnapshots.find((r) => r.id === scenario.regulationId);
    return reg ? { scenario, result: runScenario(scenario, reg) } : null;
  }).filter(Boolean) as { scenario: ProjectRecord['scenarios'][number]; result: ScenarioResult }[];
  const base = rows[0]?.result;
  const recommended = rows
    .filter((row) => row.result.envelope.regulatoryViolations.length === 0 && row.result.parking.status === 'OK')
    .sort((a, b) => (b.result.financial.roi - a.result.financial.roi) || (b.result.financial.profit - a.result.financial.profit))[0];
  return (
    <div className="content-grid">
      <section className="panel span-12">
        <SectionHeader titleAr="السيناريوهات" titleEn="Scenarios" actions={<button className="button primary" onClick={() => { store.duplicateScenario(project.info.id, project.activeScenarioId); toast('تم نسخ السيناريو | Scenario duplicated'); }}><Copy size={16} />Duplicate Scenario</button>} />
        {rows.length === 0 ? <EmptyState title="لا توجد سيناريوهات" text="أنشئ سيناريو جديد للمقارنة." action="Create Scenario" onClick={() => store.duplicateScenario(project.info.id, project.activeScenarioId)} /> : <div className="scenario-grid">{rows.map(({ scenario, result }) => <article className={`scenario-card ${project.activeScenarioId === scenario.id ? 'selected' : ''}`} key={scenario.id} onClick={() => store.updateProject({ ...project, activeScenarioId: scenario.id })}><h3>{scenario.name}</h3><MiniStat label="GFA" value={`${formatNumber(result.outputs.gfa)} m²`} /><MiniStat label="Profit" value={formatCompactSar(result.financial.profit)} tone={result.financial.profit > 0 ? 'good' : 'bad'} /><MiniStat label="ROI" value={formatPercent(result.financial.roi)} /><StatusBadge status={result.decision.status} /></article>)}</div>}
      </section>
      <section className="panel span-4"><SectionHeader titleAr="السيناريو المقترح" titleEn="Recommended Scenario" />{recommended ? <><h3>{recommended.scenario.name}</h3><p>{recommended.result.decision.label.en}</p><Kpi titleAr="العائد" titleEn="ROI" value={formatPercent(recommended.result.financial.roi)} /></> : <p>No scenarios yet</p>}</section>
      <section className="panel span-8"><SectionHeader titleAr="جدول المقارنة" titleEn="Comparison Table" /><DataTable headers={['Scenario', 'GFA', 'Sellable', 'Parking', 'Basements', 'Cost', 'Revenue', 'Profit', 'ROI', 'Decision', 'Δ Profit']} rows={rows.map(({ scenario, result }) => [scenario.name, `${formatNumber(result.outputs.gfa)} m²`, `${formatNumber(result.outputs.sellableResidential + result.outputs.sellableRetail + result.outputs.sellableOffice)} m²`, `${result.parking.providedSpaces}/${result.parking.requiredSpaces}`, String(scenario.basementCount), formatCompactSar(result.financial.totalCost), formatCompactSar(result.financial.revenue), formatCompactSar(result.financial.profit), formatPercent(result.financial.roi), result.decision.label.en, base ? formatCompactSar(result.financial.profit - base.financial.profit) : 'Base'])} /></section>
    </div>
  );
}

function ReportsView({ project, toast }: { project: ProjectRecord; toast: (message: string, tone?: Toast['tone']) => void }) {
  const store = useAppStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<{ type: 'excel' | 'pdf'; filePath: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const { result, regulation } = useScenario(project);
  const exportFile = async (type: 'excel' | 'pdf') => {
    setBusy(type);
    setExportResult(null);
    setExportError(null);
    try {
      const path = type === 'excel' ? await exportExcel(project, store.regulations, store.settings.reportLanguage, store.company) : await exportPdf(project, store.regulations, store.settings.reportLanguage, store.company);
      setExportResult({ type, filePath: path });
      toast(`تم تصدير ${type.toUpperCase()} | ${path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message);
      toast(`فشل التصدير: ${message}`, 'warning');
    } finally {
      setBusy(null);
    }
  };
  const openFolder = (filePath: string) => desktopAPI().openPath(filePath.replace(/[\\/][^\\/]+$/, ''));
  return (
    <div className="content-grid">
      <section className="panel span-5">
        <SectionHeader titleAr="خيارات التقرير" titleEn="Report Options" />
        <label className="field"><span>File Type</span><select><option>Excel</option><option>PDF</option></select></label>
        <label className="field"><span>Language</span><select value={store.settings.reportLanguage} onChange={(e) => store.updateSettings({ reportLanguage: e.target.value as typeof store.settings.reportLanguage })}><option value="ar">Arabic Only</option><option value="en">English Only</option><option value="bi">Bilingual</option></select></label>
        <label className="field"><span>Report Level</span><select><option>Executive</option><option>Quick</option><option>Detailed</option></select></label>
        <Toggle label="Company Branding" checked /><Toggle label="Include Cash Flow" checked /><Toggle label="Include Sources" checked /><Toggle label="Include Assumptions" checked />
        <button className="button primary full" disabled={busy !== null} onClick={() => exportFile('excel')}>{busy === 'excel' ? 'Exporting...' : 'Export Excel'}</button>
        <button className="button secondary full" disabled={busy !== null} onClick={() => exportFile('pdf')}>{busy === 'pdf' ? 'Exporting...' : 'Export PDF'}</button>
        {exportResult && <div className="export-result"><StatusBadge status={`${exportResult.type.toUpperCase()} exported`} tone="success" /><small>{exportResult.filePath}</small><div className="card-actions"><button onClick={() => desktopAPI().openPath(exportResult.filePath)}>Open File</button><button onClick={() => openFolder(exportResult.filePath)}>Open Folder</button></div></div>}
        {exportError && <p className="warning-line">Export Error: {exportError}</p>}
      </section>
      <section className="panel span-7 report-preview"><div className="report-cover">{store.company.logoDataUrl ? <img className="report-logo" src={store.company.logoDataUrl} alt="Company logo" /> : <BrandMark size="lg" />}<span>CONFIDENTIAL | سري</span><h2>Real Estate Development Feasibility</h2><h3>{project.info.name}</h3><div className="preview-kpis"><MiniStat label="Plot Area" value={`${formatNumber(result.envelope.plotArea)} m²`} /><MiniStat label="Achieved GFA" value={`${formatNumber(result.envelope.achievedGfa)} m²`} /><MiniStat label="Profit" value={formatCompactSar(result.financial.profit)} /><MiniStat label="Decision" value={result.decision.label.en} /></div><p>{regulation.sourceReference}</p></div></section>
    </div>
  );
}

function CompanyView({ setDirty, toast }: { setDirty: (dirty: boolean) => void; toast: (message: string, tone?: Toast['tone']) => void }) {
  const store = useAppStore();
  const tabs = ['Company Details', 'Branding', 'Report Identity', 'Approvals'];
  const [tab, setTab] = useState(tabs[0]);
  const update = (field: keyof typeof store.company, value: string) => { store.updateCompany({ [field]: value }); setDirty(true); };
  const selectLogo = async () => {
    const logo = await desktopAPI().selectLogo();
    if (!logo) return;
    store.updateCompany({ logoDataUrl: logo.dataUrl });
    setDirty(true);
    toast('تم حفظ شعار الشركة | Logo uploaded');
  };
  return (
    <div className="content-grid">
      <section className="panel span-12">
        <SectionHeader titleAr="ملف الشركة" titleEn="Company Profile" />
        <div className="tabs">{tabs.map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
        {tab === 'Company Details' && <InputGroup><TextField label="Company Name AR" value={store.company.companyNameAr} onChange={(v) => update('companyNameAr', v)} /><TextField label="Company Name EN" value={store.company.companyNameEn} onChange={(v) => update('companyNameEn', v)} /><TextField label="CR Number" value={store.company.crNumber ?? ''} onChange={(v) => update('crNumber', v)} /><TextField label="VAT Number" value={store.company.vatNumber ?? ''} onChange={(v) => update('vatNumber', v)} /><TextField label="Email" value={store.company.email ?? ''} onChange={(v) => update('email', v)} /></InputGroup>}
        {tab === 'Branding' && <><div className="logo-upload"><div className="logo-preview">{store.company.logoDataUrl ? <img src={store.company.logoDataUrl} alt="Company logo preview" /> : <ImageIcon size={28} />}</div><div><strong>Company Logo</strong><p>PNG وJPG وSVG آمن يتم نسخها إلى مجلد بيانات التطبيق.</p><button className="button secondary" onClick={selectLogo}><Upload size={16} />Upload Logo</button></div></div><InputGroup><TextField label="Primary Color" value={store.company.primaryColor} onChange={(v) => update('primaryColor', v)} /><TextField label="Secondary Color" value={store.company.secondaryColor} onChange={(v) => update('secondaryColor', v)} /></InputGroup></>}
        {tab === 'Report Identity' && <InputGroup><TextField label="Address AR" value={store.company.addressAr ?? ''} onChange={(v) => update('addressAr', v)} /><TextField label="Address EN" value={store.company.addressEn ?? ''} onChange={(v) => update('addressEn', v)} /><TextField label="Website" value={store.company.website ?? ''} onChange={(v) => update('website', v)} /></InputGroup>}
        {tab === 'Approvals' && <InputGroup><TextField label="Prepared By" value={store.company.preparedBy} onChange={(v) => update('preparedBy', v)} /><TextField label="Reviewed By" value={store.company.reviewedBy} onChange={(v) => update('reviewedBy', v)} /><TextField label="Approved By" value={store.company.approvedBy} onChange={(v) => update('approvedBy', v)} /></InputGroup>}
      </section>
    </div>
  );
}

function BackupView({ toast }: { toast: (message: string, tone?: Toast['tone']) => void }) {
  const store = useAppStore();
  return (
    <div className="content-grid">
      <section className="panel span-6"><SectionHeader titleAr="النسخ الاحتياطي" titleEn="Backup" /><button className="button primary full" onClick={async () => toast(`تم إنشاء النسخة | ${await store.exportBackup()}`)}><Download size={16} />Export Project Backup</button><button className="button secondary full" onClick={async () => { await store.importBackup(); toast('تم استيراد النسخة | Backup imported'); }}><Upload size={16} />Import Project Backup</button><button className="button ghost full" onClick={() => desktopAPI().diagnostics().then((d) => desktopAPI().openPath(d.userDataPath))}><FolderOpen size={16} />Open Data Folder</button></section>
      <section className="panel span-6"><SectionHeader titleAr="الحالة" titleEn="Storage Status" /><Checklist items={['Local SQLite database', 'Offline storage', 'Manual backup export', 'Manual backup import']} /></section>
    </div>
  );
}

function SettingsView({ diagnostics, setDiagnostics, toast }: { diagnostics: Record<string, string> | null; setDiagnostics: (d: Record<string, string>) => void; toast: (message: string, tone?: Toast['tone']) => void }) {
  const store = useAppStore();
  const tabs = ['General', 'Language', 'Appearance', 'Security', 'Backup', 'Diagnostics'];
  const [tab, setTab] = useState(tabs[0]);
  return (
    <div className="content-grid">
      <section className="panel span-12 settings-panel">
        <SectionHeader titleAr="الإعدادات" titleEn="Settings" />
        <div className="tabs settings-tabs">{tabs.map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
        {tab === 'General' && <InputGroup><label className="field"><span>Start Page</span><select value="home" disabled><option>Home</option></select><small>ثابت حاليًا لضمان أول تشغيل نظيف بدون Demo تلقائي.</small></label><label className="field"><span>Recent Project Behavior</span><select value="manual" disabled><option>Manual open</option></select><small>يفتح المستخدم المشروع بنفسه من Project Picker.</small></label><Toggle label="Auto Save" checked onChange={() => toast('الحفظ التلقائي مفعّل دائمًا في قاعدة البيانات المحلية', 'info')} /></InputGroup>}
        {tab === 'Language' && <InputGroup><label className="field"><span>Interface Language</span><select value={store.settings.language} onChange={(e) => store.updateSettings({ language: e.target.value as typeof store.settings.language })}><option value="ar">العربية</option><option value="en">English</option><option value="bi">عربي + English</option></select></label><label className="field"><span>Report Language</span><select value={store.settings.reportLanguage} onChange={(e) => store.updateSettings({ reportLanguage: e.target.value as typeof store.settings.reportLanguage })}><option value="ar">Arabic</option><option value="en">English</option><option value="bi">Bilingual</option></select></label></InputGroup>}
        {tab === 'Appearance' && <><InputGroup><label className="field"><span>Theme</span><select value={store.settings.theme} onChange={(e) => store.updateSettings({ theme: e.target.value as typeof store.settings.theme })}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></label></InputGroup><div className="theme-preview"><div /><div /><div /></div></>}
        {tab === 'Security' && <EmptyState title="قفل التطبيق غير متاح في هذه النسخة" text="تم إخفاء عناصر PIN / Password لأنها لم تكن موصولة بقفل فعلي." />}
        {tab === 'Backup' && <InputGroup><Toggle label="Auto Backup" checked={store.settings.autoBackup} onChange={(v) => store.updateSettings({ autoBackup: v })} icon={<RotateCcw size={16} />} /><label className="field"><span>Backup Location</span><input disabled value="Manual export dialog" /><small>تحديد الموقع يتم عند إنشاء النسخة.</small></label><label className="field"><span>Retention</span><select disabled><option>Manual cleanup</option></select></label></InputGroup>}
        {tab === 'Diagnostics' && <Diagnostics diagnostics={diagnostics} setDiagnostics={setDiagnostics} />}
      </section>
    </div>
  );
}

function AboutView() {
  return (
    <div className="content-grid">
      <section className="panel span-7 about-panel"><BrandMark size="xl" /><Caption ar="إصدار الرياض" en="Riyadh Edition" /><h2>Saudi DevelopIQ</h2><p>From Plot to Decision<br />من الأرض إلى قرار التطوير</p><div className="about-credit"><span>Developed & Conceptualized by</span><strong>Mahmoud Elgamsy | محمود الجمصي</strong><a href="mailto:mobd3on@gmail.com">mobd3on@gmail.com</a><a href="https://www.linkedin.com/in/melgamsy/">linkedin.com/in/melgamsy</a></div></section>
      <section className="panel span-5"><SectionHeader titleAr="نسخ النظام" titleEn="Versions" /><MiniStat label="Version" value="1.0 - Riyadh Edition" /><MiniStat label="Database Version" value="1.0" /><MiniStat label="Regulation Pack Version" value="1.0-demo" /></section>
    </div>
  );
}

function NewStudyWizard({ onClose, toast }: { onClose: () => void; toast: (message: string, tone?: Toast['tone']) => void }) {
  const store = useAppStore();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState({ name: '', district: '', owner: '', use: 'Residential Apartments' as ProjectUse, regulationId: '' });
  const steps = ['Project', 'Plot', 'Development Type', 'Regulation', 'Review'];
  const create = () => {
    if (!draft.name.trim() || !draft.district.trim() || !draft.regulationId) return toast('أدخل اسم المشروع والحي واختر نظام البناء يدويًا قبل الإنشاء', 'warning');
    store.createProject(draft);
    toast('تم إنشاء الدراسة الجديدة');
    onClose();
  };
  return (
    <div className="modal-backdrop">
      <section className="wizard">
        <div className="wizard-header"><div><Caption ar="دراسة جديدة" en="New Study" /><h2>Create Riyadh Study</h2></div><button onClick={onClose}>Close</button></div>
        <div className="stepper">{steps.map((item, i) => <button className={i === step ? 'active' : i < step ? 'done' : ''} key={item} onClick={() => setStep(i)}>{i < step ? <Check size={14} /> : i + 1}<span>{item}</span></button>)}</div>
        <div className="wizard-body">
          {step === 0 && <InputGroup><TextField label="Project Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} /><TextField label="District" value={draft.district} onChange={(v) => setDraft({ ...draft, district: v })} /><TextField label="Owner" value={draft.owner} onChange={(v) => setDraft({ ...draft, owner: v })} /></InputGroup>}
          {step === 1 && <EmptyState title="Plot inputs after creation" text="سيتم فتح صفحة الأرض مباشرة بعد إنشاء الدراسة لإدخال المساحة والأبعاد والحدود." action="Continue" onClick={() => setStep(2)} />}
          {step === 2 && <label className="field"><span>Development Type</span><select value={draft.use} onChange={(e) => setDraft({ ...draft, use: e.target.value as ProjectUse })}>{projectUses.map((use) => <option key={use}>{use}</option>)}</select></label>}
          {step === 3 && <label className="field"><span>Regulation</span><select value={draft.regulationId} onChange={(e) => setDraft({ ...draft, regulationId: e.target.value })}><option value="">Select manually</option>{store.regulations.map((reg) => <option key={reg.id} value={reg.id} disabled={reg.calculationReady === false}>{reg.code} - {reg.name.en}{reg.calculationReady === false ? ' (Reference only)' : ''}</option>)}</select></label>}
          {step === 4 && <RuleRows rows={[['Project', draft.name || 'Not set'], ['District', draft.district || 'Not set'], ['Use', draft.use], ['Regulation', store.regulations.find((r) => r.id === draft.regulationId)?.code ?? 'Not set']]} />}
        </div>
        <div className="wizard-footer"><button className="button ghost" disabled={step === 0} onClick={() => setStep(Math.max(0, step - 1))}>Back</button>{step < steps.length - 1 ? <button className="button primary" onClick={() => setStep(step + 1)}>Next <ChevronRight size={16} /></button> : <button className="button primary" onClick={create}>Create Study</button>}</div>
      </section>
    </div>
  );
}

function useScenario(project: ProjectRecord) {
  const regs = useAppStore((s) => s.regulations);
  return useMemo(() => {
    const scenario = project.scenarios.find((s) => s.id === project.activeScenarioId) ?? project.scenarios[0];
    const regulation = project.regulationSnapshots.find((r) => r.id === scenario.regulationId);
    if (!regulation) throw new Error('No active regulation snapshot selected.');
    return { scenario, regulation, result: runScenario(scenario, regulation) };
  }, [project, regs]);
}

function DecisionCard({ result }: { result: ScenarioResult }) {
  return <section className={`panel decision-card span-4 ${result.decision.status}`}><Caption ar="قرار التطوير" en="Development Decision" /><h2>{result.decision.label.en}</h2><h3>{result.decision.label.ar}</h3>{result.decision.reasons.map((reason) => <p key={reason.en}>{reason.en}<br />{reason.ar}</p>)}</section>;
}

function VisualPlot({ result }: { result: ScenarioResult['envelope']; regulation: RegulationPack }) {
  const length = Math.max(1, result.plotLength);
  const width = Math.max(1, result.plotWidth);
  const aspect = `${Math.max(.45, Math.min(2.2, length / width))} / 1`;
  return <div className="visual-plot" style={{ aspectRatio: aspect }}><div className="north">N</div><div className="street-edge">Front street</div><div className="dimension length">{formatNumber(length, ' m')}</div><div className="dimension width">{formatNumber(width, ' m')}</div><div className="setback-band" /><div className="buildable-envelope"><strong>{formatNumber(result.finalFootprint, ' m²')}</strong><span>Final Allowed Footprint</span><small>Geometry {formatNumber(result.geometricFootprint, ' m²')} • Coverage {formatNumber(result.coverageLimit, ' m²')}</small></div><div className="legend"><span />Plot Boundary <span />Setback <span />Envelope</div><small>Front {result.setbacks.front}m • Rear {result.setbacks.rear}m • Left {result.setbacks.left}m • Right {result.setbacks.right}m</small></div>;
}

function BuildingStack({ result }: { result: ScenarioResult }) {
  const floors = result.envelope.floorAreas.slice().reverse();
  const max = Math.max(...floors.map((f) => f.finalAllowedArea), 1);
  return <div className="building-stack">{floors.map((floor) => <button key={floor.floor} style={{ width: `${48 + (floor.finalAllowedArea / max) * 44}%` }} title="How calculated?"><span>{floor.floor}</span><strong>{formatNumber(floor.finalAllowedArea, ' m²')}</strong></button>)}<div className="plot-base">Plot</div></div>;
}

function ParkingGauge({ value }: { value: number }) {
  const clamped = Math.min(1.4, value);
  return <div className="parking-gauge"><div className="gauge-track"><span style={{ width: `${Math.min(100, clamped * 100)}%` }} /></div><div className="gauge-labels"><span>Shortfall</span><strong>{formatPercent(value)}</strong><span>Surplus</span></div></div>;
}

function SectionHeader({ titleAr, titleEn, actions }: { titleAr: string; titleEn: string; actions?: React.ReactNode }) {
  return <div className="section-header"><div><Caption ar={titleAr} en={titleEn} /><h2>{titleEn}</h2></div>{actions}</div>;
}

function Bi({ ar, en }: { ar: string; en: string }) {
  const lang = useAppStore((s) => s.settings.language);
  if (lang === 'ar') return <>{ar}</>;
  if (lang === 'en') return <>{en}</>;
  return <span className="bi-label"><strong>{ar}</strong><small>{en}</small></span>;
}

function Caption({ ar, en }: { ar: string; en: string }) {
  return <span className="caption"><Bi ar={ar} en={en} /></span>;
}

function Kpi({ titleAr, titleEn, value, tone }: { titleAr: string; titleEn: string; value: string; tone?: 'good' | 'bad' | 'warn' }) {
  return <div className={`kpi-card ${tone ?? ''}`}><Caption ar={titleAr} en={titleEn} /><strong>{value}</strong></div>;
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return <div className={`mini-stat ${tone ?? ''}`}><span>{label}</span><strong>{value}</strong></div>;
}

function Field({ labelAr, labelEn, value, onChange, unit, helper }: { labelAr: string; labelEn: string; value: number; onChange: (value: number) => void; unit?: string; helper?: string }) {
  return <label className="field"><span><Bi ar={labelAr} en={labelEn} /></span><div className="input-unit"><input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} /><em>{unit}</em></div>{helper && <small>{helper}</small>}</label>;
}

function PercentField({ labelAr, labelEn, value, onChange }: { labelAr: string; labelEn: string; value: number; onChange: (value: number) => void }) {
  return <Field labelAr={labelAr} labelEn={labelEn} value={Number((value * 100).toFixed(2))} onChange={(next) => onChange(next / 100)} unit="%" />;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function DisabledField({ label, reason }: { label: string; reason: string }) {
  return <label className="field disabled"><span>{label}</span><input disabled value="Disabled in V1" /><small>{reason}</small></label>;
}

function InputGroup({ children }: { children: React.ReactNode }) {
  return <div className="input-grid">{children}</div>;
}

function Toggle({ label, checked, onChange, disabled, reason, icon }: { label: string; checked: boolean; onChange?: (value: boolean) => void; disabled?: boolean; reason?: string; icon?: React.ReactNode }) {
  return <label className={`toggle ${disabled ? 'disabled' : ''}`}>{icon}<span>{label}{reason && <small>{reason}</small>}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} /></label>;
}

function StatusBadge({ status, tone }: { status: string | VerificationStatus; tone?: 'success' | 'warning' | 'neutral' }) {
  const resolved = tone ?? (String(status).includes('UNVERIFIED') || String(status).includes('DEMO') || String(status).includes('Unsaved') || String(status).includes('SHORTAGE') ? 'warning' : 'success');
  return <span className={`status-badge ${resolved}`}>{String(status).replaceAll('_', ' ')}</span>;
}

function ProgressMetric({ label, value }: { label: string; value: number }) {
  return <div className="progress-metric"><div><span>{label}</span><strong>{formatPercent(value)}</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, value * 100)}%` }} /></div></div>;
}

function Checklist({ items }: { items: string[] }) {
  return <div className="checklist">{items.map((item) => <div key={item}><Check size={15} /><span>{item}</span></div>)}</div>;
}

function Insight({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warning' }) {
  return <p className={`insight ${tone}`}><Sparkles size={16} />{text}</p>;
}

function RuleRows({ rows }: { rows: string[][] }) {
  return <dl className="rule-rows">{rows.map(([k, v]) => <div key={`${k}-${v}`}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}<CircleHelp size={13} /></th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={`${i}-${j}`}>{cell}</td>)}</tr>)}</tbody></table></div>;
}

function ChartBox({ children, tall = false }: { children: React.ReactElement; tall?: boolean }) {
  return <div className={`chart-box ${tall ? 'tall' : ''}`}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}

function EmptyPanel({ title, text }: { title: string; text: string }) {
  return <section className="panel span-12"><EmptyState title={title} text={text} /></section>;
}

function EmptyState({ title, text, action, onClick }: { title: string; text: string; action?: string; onClick?: () => void }) {
  return <div className="empty-state"><PackageOpen size={34} /><h3>{title}</h3><p>{text}</p>{action && <button className="button primary" onClick={onClick}>{action}</button>}</div>;
}

function Breadcrumb({ items }: { items: string[] }) {
  return <div className="breadcrumb">{items.map((item, i) => <span key={`${item}-${i}`}>{item}</span>)}</div>;
}

function Diagnostics({ diagnostics, setDiagnostics }: { diagnostics: Record<string, string> | null; setDiagnostics: (d: Record<string, string>) => void }) {
  const load = async () => setDiagnostics(await desktopAPI().diagnostics() as unknown as Record<string, string>);
  return <section className="diagnostics-box"><SectionHeader titleAr="التشخيص" titleEn="Diagnostics" actions={<button className="button ghost" onClick={load}>Load Diagnostics</button>} />{diagnostics ? <><RuleRows rows={Object.entries(diagnostics)} /><div className="diagnostics-actions"><button className="button secondary" onClick={() => desktopAPI().openPath(diagnostics.userDataPath)}>Open Data Folder</button><button className="button secondary" onClick={() => desktopAPI().openPath(diagnostics.logPath)}>Open Logs Folder</button><button className="button ghost" onClick={() => navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2))}>Copy Diagnostic Info</button></div></> : <p className="muted">اضغط Load Diagnostics لعرض المسارات ومعلومات الإصدار.</p>}</section>;
}

function ToastStack({ items }: { items: Toast[] }) {
  return <div className="toast-stack">{items.map((item) => <div className={`toast ${item.tone}`} key={item.id}>{item.message}</div>)}</div>;
}
