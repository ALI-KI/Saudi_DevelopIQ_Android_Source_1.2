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
import type { AppStateFile, LanguageMode, ProjectRecord, RegulationPack, ScenarioResult } from '../shared/types';
import { useAppStore } from '../renderer/store';
import { exportExcel, exportPdf } from '../renderer/utils/exporters';
import { Alert, Btn, Input, Metric, NoStudy, Num, Section, Select, Text, cash, changeProject, compact, pct, t, unit, useLabels, type LocalText, type Screen } from './ui';
import { DevelopmentScreen, FinancialScreen, NewProjectModal, OverviewScreen, ParkingScreen, PlotScreen, RegulationsScreen } from './screens';
import type { Scenario } from '../shared/types';
const iconUrl = new URL('../../assets/brand/developiq-app-icon.png', import.meta.url).href;
type Notice = { message: string; error?: boolean } | null;
const names: Record<Screen, LocalText> = {
  home: { ar: 'الرئيسية', en: 'Home' }, overview: { ar: 'ملخص الدراسة', en: 'Overview' }, plot: { ar: 'بيانات الأرض', en: 'Plot' },
  regulations: { ar: 'أنظمة البناء', en: 'Regulations' }, development: { ar: 'التطوير', en: 'Development' },
  parking: { ar: 'المواقف', en: 'Parking' }, financial: { ar: 'الجدوى المالية', en: 'Financial' },
  scenarios: { ar: 'السيناريوهات', en: 'Scenarios' }, reports: { ar: 'التقارير', en: 'Reports' },
  company: { ar: 'الشركة', en: 'Company' }, backup: { ar: 'النسخ الاحتياطي', en: 'Backup' },
  settings: { ar: 'الإعدادات', en: 'Settings' }, about: { ar: 'عن التطبيق', en: 'About' }
};
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
       project && scenario && screen === 'plot' ? <PlotScreen project={project} scenario={scenario} result={result} regulation={regulation} navigate={navigate} /> :
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
    <section className="hero"><div className="hero-watermark">IQ</div><span className="hero-eyebrow">دراسات التطوير العقاري · الرياض</span><h2>من الأرض<br /><span>إلى قرار التطوير</span></h2><p>أدخل الأرض وشوارعها، واحصل على المسطحات والمواقف والجدوى في دقائق.</p><Btn onClick={openNew}><Plus size={19}/> إنشاء دراسة جديدة</Btn></section>
    {project && <Section title={{ ar: 'الدراسة الحالية', en: 'Current Study' }} action={<button className="text-link" onClick={() => navigate('overview')}>عرض التفاصيل <ChevronLeft size={16}/></button>}><div className="current-study"><div className="study-icon"><Building2/></div><div><strong>{project.info.name}</strong><small>{project.info.district} · {useLabels[project.info.use] ?? project.info.use}</small></div></div><div className="chip">{project.scenarios.length} سيناريو</div></Section>}
    <Section title={{ ar: 'الدراسات المحفوظة', en: 'Saved Studies' }}><div className="study-list">{store.projects.length === 0 ? <div className="empty-inline">لا توجد دراسات حتى الآن. استخدم زر «إنشاء دراسة جديدة» للبدء.</div> : store.projects.map((p) => <button className="study-row" key={p.info.id} onClick={() => { store.setActiveProject(p.info.id); navigate('overview'); }}><div className="study-icon"><Building2 size={19} /></div><div><strong>{p.info.name}</strong><small>{p.info.district} · {new Date(p.info.updatedAt).toLocaleDateString('ar-SA')}</small></div><ChevronLeft size={19}/></button>)}</div></Section>
    <div className="two-actions"><button onClick={() => navigate('regulations')}><BookOpen/><strong>أنظمة البناء</strong><span>اختيار ومقارنة البدائل</span></button><button onClick={() => navigate('backup')}><ShieldAlert/><strong>النسخ الاحتياطي</strong><span>تصدير واستعادة</span></button></div>
    <Alert>أرقام الأنظمة مأخوذة من وثائق «نظام البناء» لأمانة الرياض. أكّد نظام قطعتك بوثيقتها قبل الشراء.</Alert>
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
function AboutScreen() { return <div className="stack"><section className="about-hero"><img src={iconUrl} alt="DevelopIQ"/><h2>Saudi Develop<span>IQ</span></h2><small>RIYADH EDITION · ANDROID 1.3.0</small><p>From Plot to Decision<br/>من الأرض إلى قرار التطوير</p></section><Section title={{ar:'تصميم وتطوير',en:'Designed & Developed By'}}><div className="about-maker"><strong>م. محمود الجمصي</strong><span>Mahmoud Elgamsy</span><a href="mailto:mobd3on@gmail.com">mobd3on@gmail.com</a><a href="https://www.linkedin.com/in/melgamsy/">LinkedIn · melgamsy</a><a href="tel:+966562284194">+966 56 228 4194</a></div></Section><Alert>Saudi DevelopIQ أداة تقديرية للدراسات المبدئية، ولا تغني عن المخططات المعتمدة ودراسة التربة والاشتراطات الرسمية.</Alert></div>; }
