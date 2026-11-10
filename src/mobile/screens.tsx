import { useState } from 'react';
import { AlertCircle, ArrowLeft, BookOpen, Check, Copy, FileCheck2, Layers, Sparkles, X } from 'lucide-react';
import { LARGE_UNIT_AREA, STALL_LENGTH, STALL_WIDTH, runScenario } from '../core/engines';
import { SPECIAL_STREET_WIDTH, assessRegulation, makeEvidence, validateSelection, widestStreet } from '../core/regulationSelection';
import type { FinancialInputs, PlotData, ProjectRecord, ProjectUse, RegulationPack, RegulationSelectionEvidence, Scenario, ScenarioResult } from '../shared/types';
import { useAppStore } from '../renderer/store';
import {
  Alert, Btn, Input, Metric, NoRegulation, Num, Section, Segmented, Select, Stat, cash, changeProject, changeScenario, clearOverride,
  compact, floorLabel, id, overrideValue, pct, setOverride, sideLabels, unit, useLabels, uses, type Screen, type Toast
} from './ui';

type Nav = (s: Screen) => void;
const missingLabels: Record<string, string> = { FAR: 'معامل البناء', 'Development Depth': 'عمق التطوير', 'Commercial Development Depth': 'العمق التجاري', 'Rear setback': 'الارتداد الخلفي', 'Main setback': 'ارتداد الشارع الرئيسي', Setbacks: 'الارتدادات', Roof: 'الملحق العلوي' };

/* ───────────────────────── New study ───────────────────────── */
export function NewProjectModal({ close, navigate, toast }: { close: () => void; navigate: Nav; toast: Toast }) {
  const store = useAppStore();
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('');
  const [owner, setOwner] = useState('');
  const [use, setUse] = useState<ProjectUse>('Residential Villas');
  const ready = name.trim().length > 1 && district.trim().length > 1;
  const create = () => {
    if (!ready) return;
    store.createProject({ name: name.trim(), district: district.trim(), owner: owner.trim(), use });
    close(); navigate('plot');
    toast(use === 'Residential Villas' ? 'أدخل مساحة الأرض وشوارعها، ونظام الفلل يتطبق تلقائيًا.' : 'أدخل بيانات الأرض ثم اختر نظام البناء.');
  };
  return <div className="modal-overlay"><div className="modal-panel">
    <div className="modal-title"><div><small>دراسة جديدة</small><h2>دراسة تطوير جديدة</h2></div><button className="icon-btn" aria-label="إغلاق" onClick={close}><X /></button></div>
    <div className="modal-scroller">
      <Input label={{ ar: 'اسم الدراسة', en: 'Project Name' }} value={name} onChange={setName} placeholder="مثال: أرض الياسمين 1607" />
      <Input label={{ ar: 'الحي', en: 'District' }} value={district} onChange={setDistrict} placeholder="مثال: الياسمين" />
      <Select label={{ ar: 'نوع التطوير', en: 'Development Use' }} value={use} onChange={(v) => setUse(v as ProjectUse)} items={uses.map((v) => ({ value: v, text: useLabels[v] }))} />
      <Input label={{ ar: 'المالك (اختياري)', en: 'Owner (Optional)' }} value={owner} onChange={setOwner} />
    </div>
    <div className="modal-footer"><Btn secondary onClick={close}>إلغاء</Btn><Btn disabled={!ready} onClick={create}>إنشاء وإدخال الأرض <ArrowLeft size={17} /></Btn></div>
  </div></div>;
}

/* ───────────────────────── Overview ───────────────────────── */
function ConfidenceChip({ result }: { result: ScenarioResult }) {
  const c = result.regulationConfidence;
  if (!c) return null;
  return <span className={`confidence ${c.level.toLowerCase()} ${c.expired ? 'expired' : ''}`}>{c.level === 'DOCUMENTED' && !c.expired ? <FileCheck2 size={14} /> : c.level === 'AUTO' ? <Sparkles size={14} /> : <AlertCircle size={14} />}{c.label.ar}</span>;
}

export function OverviewScreen({ result, regulation, navigate }: { result: ScenarioResult | null; regulation: RegulationPack | null; navigate: Nav }) {
  if (!result || !regulation) return <NoRegulation navigate={navigate} />;
  const r = result; const rent = r.financial.mode === 'RENT';
  const tone = r.decision.status === 'PROCEED' ? 'positive' : r.decision.status === 'PROCEED_WITH_CONDITIONS' ? 'fair' : r.decision.status === 'NOT_RECOMMENDED' ? 'negative' : 'weak';
  return <div className="stack">
    <section className={`decision-card ${tone}`}>
      <small>قرار التطوير</small><h2>{r.decision.label.ar}</h2><p>{r.decision.reasons.map((a) => a.ar).join(' · ')}</p>
      <div className="decision-foot">
        <span>{rent ? 'العائد الإيجاري' : 'العائد على التكلفة'} <b dir="ltr">{pct(rent ? r.financial.yieldOnCost ?? 0 : r.financial.roi)}</b></span>
        <span>{rent ? 'صافي الدخل السنوي' : 'الربح'} <b dir="ltr">{compact(rent ? r.financial.annualNoi ?? 0 : r.financial.profit)}</b></span>
      </div>
    </section>
    <div className="stats-grid">
      <Stat label={{ ar: 'مساحة الأرض', en: 'Plot Area' }} value={`${unit(r.envelope.plotArea)} م²`} />
      <Stat label={{ ar: 'إجمالي المسطحات', en: 'Built-Up Area' }} value={`${unit(r.envelope.achievedGfa)} م²`} />
      <Stat label={{ ar: 'المساحة الصافية', en: 'Net Area' }} value={`${unit(r.outputs.sellableResidential + r.outputs.sellableRetail + r.outputs.sellableOffice)} م²`} />
      <Stat label={{ ar: 'إجمالي التكلفة', en: 'Total Cost' }} value={compact(r.financial.totalCost)} />
    </div>
    <Section title={{ ar: 'نظام البناء', en: 'Building Regulation' }} action={<button className="text-link" onClick={() => navigate('regulations')}>تغيير</button>}>
      <div className="source-line"><BookOpen size={20} /><div><strong>{regulation.name.ar}</strong><small>{regulation.sourceReference}</small></div></div>
      <ConfidenceChip result={r} />
      <div className="metric-list">
        <Metric label="معامل البناء المحقق" value={r.envelope.farSource === 'NO_FAR' ? 'لا يوجد معامل' : unit(r.envelope.achievedFar, 2)} />
        <Metric label="عدد الأدوار" value={unit(r.envelope.floorAreas.filter((v) => v.floor !== 'roof annex').length)} />
        <Metric label="عدد الوحدات" value={unit(regulation.applicableUses.length === 1 && regulation.applicableUses[0] === 'Residential Villas' ? r.outputs.villas : r.outputs.units)} />
      </div>
    </Section>
    <Section title={{ ar: 'المواقف', en: 'Parking' }} action={<button className="text-link" onClick={() => navigate('parking')}>التفاصيل</button>}>
      <div className="metric-list">
        <Metric label="المطلوب" value={unit(r.parking.requiredSpaces)} />
        <Metric label="على الشوارع وداخل القطعة" value={unit(r.parking.surfaceParking)} />
        <Metric label="الأقبية" value={r.parking.providedBasements === 0 ? 'لا يحتاج قبو' : `${unit(r.parking.providedBasements)} قبو`} />
      </div>
    </Section>
  </div>;
}

/* ───────────────────────── Plot ───────────────────────── */
function PlotSketch({ plot, result }: { plot: PlotData; result: ScenarioResult | null }) {
  const street = (side: 'front' | 'rear' | 'left' | 'right') => { const b = plot.boundaries.find((v) => v.side === side); return b?.type === 'Street' && b.width ? `شارع ${unit(b.width)}م` : b?.type === 'Neighbor' ? 'جار' : '—'; };
  const sb = result?.envelope.setbacks;
  return <div className="plot-sketch">
    <div className="sketch-side top">{street('rear')}</div>
    <div className="sketch-mid">
      <div className="sketch-side v">{street('right')}</div>
      <div className="plot-boundary"><div className="plot-buildable"><span>بصمة البناء</span><strong dir="ltr">{unit(result?.envelope.finalFootprint ?? 0)} م²</strong></div></div>
      <div className="sketch-side v">{street('left')}</div>
    </div>
    <div className="sketch-side bottom street">{street('front')} · الواجهة {unit(plot.width ?? 0)}م</div>
    <div className="plot-legend">{sb ? `الارتدادات: أمامي ${sb.front ?? '؟'}م · خلفي ${sb.rear ?? '؟'}م · جانبي ${sb.right ?? '؟'}م / ${sb.left ?? '؟'}م` : 'الرسم توضيحي'}</div>
  </div>;
}

export function PlotScreen({ project, scenario, result, regulation, navigate }: { project: ProjectRecord; scenario: Scenario; result: ScenarioResult | null; regulation: RegulationPack | null; navigate: Nav }) {
  const plot = scenario.plot;
  const updatePlot = (patch: Partial<PlotData>) => changeScenario((s) => {
    const next = { ...s.plot, ...patch };
    return { ...s, plot: { ...next, accuracy: next.length && next.width ? 'Exact' as const : 'Area Only' as const } };
  });
  const setBoundary = (side: string, patch: Partial<PlotData['boundaries'][number]>) => updatePlot({ boundaries: plot.boundaries.map((old) => old.side === side ? { ...old, ...patch } : old) });
  const info = (key: 'planNumber' | 'plotNumber' | 'blockNumber' | 'deedNumber' | 'location', v: string) => changeProject((p) => ({ ...p, info: { ...p.info, [key]: v } }));
  const hasStreet = plot.boundaries.some((b) => b.type === 'Street' && (b.width ?? 0) > 0);
  const mismatch = plot.length && plot.width && plot.officialArea && Math.abs(plot.length * plot.width - plot.officialArea) > 1;
  const use = scenario.developmentUse ?? project.info.use;
  return <div className="stack">
    <Section title={{ ar: 'المساحة والأبعاد', en: 'Area & Dimensions' }} detail="كما في الصك أو الرفع المساحي">
      <div className="form-grid">
        <Num label={{ ar: 'مساحة الأرض', en: 'Plot Area' }} value={plot.officialArea || undefined} suffix="م²" onChange={(officialArea) => updatePlot({ officialArea })} />
        <Num label={{ ar: 'عرض الواجهة', en: 'Frontage' }} value={plot.width || undefined} suffix="م" onChange={(width) => updatePlot({ width })} />
        <Num label={{ ar: 'عمق الأرض', en: 'Depth' }} value={plot.length || undefined} suffix="م" onChange={(length) => updatePlot({ length })} />
      </div>
      {mismatch ? <Alert>المساحة المدخلة {unit(plot.officialArea)} م² والمحسوبة من الأبعاد {unit((plot.length ?? 0) * (plot.width ?? 0))} م². الحساب يعتمد مساحة الصك.</Alert> : null}
      {plot.officialArea > 0 && !(plot.length && plot.width) ? <Alert>بدون الأبعاد يفترض التطبيق أرضًا مربعة. أدخل الواجهة والعمق لحساب أدق للارتدادات والمواقف.</Alert> : null}
    </Section>
    <Section title={{ ar: 'الحدود والشوارع', en: 'Boundaries & Streets' }} detail="عرض الشارع يحدد الارتداد وطريقة المواقف">
      <div className="boundaries">{plot.boundaries.map((b) => {
        const side = result?.parking.streetSides?.find((v) => v.side === b.side);
        return <div key={b.side} className="boundary-item">
          <strong>{sideLabels[b.side]}</strong>
          <Select label={{ ar: 'نوع الحد', en: 'Type' }} value={b.type} items={[{ value: 'Street', text: 'شارع' }, { value: 'Neighbor', text: 'جار' }, { value: 'Corridor', text: 'ممر مشاة' }, { value: 'Other', text: 'أخرى' }]} onChange={(type) => setBoundary(b.side, { type: type as typeof b.type, width: type === 'Street' ? b.width : undefined })} />
          {b.type === 'Street' && <Num label={{ ar: 'عرض الشارع', en: 'Street Width' }} suffix="م" value={b.width || undefined} onChange={(width) => setBoundary(b.side, { width })} />}
          {result && <span className="minor">الارتداد {result.envelope.setbacks[b.side] ?? '—'}م{side && side.spaces > 0 ? ` · ${side.spaces} موقف` : ''}</span>}
        </div>;
      })}</div>
      {!hasStreet && <Alert>حدد ضلعًا واحدًا على الأقل كشارع مع عرضه.</Alert>}
    </Section>
    <Section title={{ ar: 'نظام البناء', en: 'Building Regulation' }}>
      {regulation && result ? <>
        <div className="source-line"><BookOpen size={20} /><div><strong>{regulation.name.ar}</strong><small>{result.regulationConfidence?.label.ar}</small></div></div>
        <Btn secondary className="full" onClick={() => navigate('regulations')}>عرض الأنظمة البديلة</Btn>
      </> : use === 'Residential Villas' && widestStreet(plot) < SPECIAL_STREET_WIDTH ? <Alert>أدخل مساحة الأرض ليتم تطبيق نظام الفلل س 111 تلقائيًا.</Alert> : <>
        <Alert>{use === 'Residential Villas' ? 'الأرض على شارع 30م أو أكثر، فقد ينطبق عليها نظام خاص.' : 'العمائر والاستخدامات التجارية يختلف نظامها حسب الموقع.'} اختر النظام من وثيقة «نظام البناء» للقطعة.</Alert>
        <Btn className="full" onClick={() => navigate('regulations')}>اختيار نظام البناء <ArrowLeft size={17} /></Btn>
      </>}
    </Section>
    <Section title={{ ar: 'الرسم التوضيحي', en: 'Sketch' }}><PlotSketch plot={plot} result={result} /></Section>
    <Section title={{ ar: 'بيانات القطعة', en: 'Parcel Details' }} detail="اختيارية، وتظهر في التقرير">
      <div className="form-grid">
        <Input label={{ ar: 'رقم المخطط', en: 'Plan No.' }} value={project.info.planNumber ?? ''} onChange={(v) => info('planNumber', v)} />
        <Input label={{ ar: 'رقم القطعة', en: 'Plot No.' }} value={project.info.plotNumber ?? ''} onChange={(v) => info('plotNumber', v)} />
        <Input label={{ ar: 'رقم البلوك', en: 'Block No.' }} value={project.info.blockNumber ?? ''} onChange={(v) => info('blockNumber', v)} />
        <Input label={{ ar: 'رقم الصك', en: 'Deed No.' }} value={project.info.deedNumber ?? ''} onChange={(v) => info('deedNumber', v)} />
      </div>
      <Input label={{ ar: 'رابط الموقع', en: 'Location URL' }} value={project.info.location ?? ''} onChange={(v) => info('location', v)} />
    </Section>
  </div>;
}

/* ───────────────────────── Regulations ───────────────────────── */
export function RegulationsScreen({ project, onEdit, toast }: { project: ProjectRecord | null; onEdit: (id: string) => void; toast: Toast }) {
  const store = useAppStore();
  const [showAll, setShowAll] = useState(false);
  const scenario = project?.scenarios.find((s) => s.id === project.activeScenarioId) ?? null;
  const evidence = scenario?.regulationEvidence;
  const [docRef, setDocRef] = useState(evidence?.documentReference ?? '');
  const [docDate, setDocDate] = useState(evidence?.issueDate ?? '');
  const [docKind, setDocKind] = useState<NonNullable<RegulationSelectionEvidence['documentKind']>>(evidence?.documentKind ?? 'PRELIMINARY');
  if (!project || !scenario) return <Alert>أنشئ دراسة وأدخل بيانات الأرض أولًا، ثم اختر نظام البناء.</Alert>;
  const use = (scenario.developmentUse ?? project.info.use) as ProjectUse;
  const active = project.regulationSnapshots.find((r) => r.id === scenario.regulationId) ?? store.regulations.find((r) => r.id === scenario.regulationId) ?? null;
  const activeResult = active ? runScenario(scenario, active) : null;
  const rows = store.regulations.map((reg) => ({ reg, assessment: assessRegulation(reg, project.info, use) }));
  const visible = rows.filter((row) => showAll || row.assessment.status !== 'EXCLUDED');
  const preview = (reg: RegulationPack) => {
    if (!(scenario.plot.officialArea > 0)) return null;
    const run = runScenario({ ...scenario, regulationId: reg.id, regulationEvidence: undefined }, reg);
    return run.envelope.warnings.some((w) => w.startsWith('Maximum floors not defined')) ? null : run;
  };
  const missingText = (reg: RegulationPack) => (reg.missingRules ?? []).filter((v) => !/parking/i.test(v)).map((v) => missingLabels[v] ?? v);
  const guard = (reg: RegulationPack) => { const errors = validateSelection(reg, project.info, scenario); if (errors.length) { toast(errors[0], true); return false; } return true; };
  const select = (reg: RegulationPack) => {
    if (!guard(reg)) return;
    changeProject((p) => ({ ...p, scenarios: p.scenarios.map((s) => s.id === p.activeScenarioId ? { ...s, regulationId: reg.id, regulationEvidence: makeEvidence(reg, p.info, s, 'USER_SELECTED') } : s), regulationSnapshots: [...p.regulationSnapshots.filter((r) => r.id !== reg.id), structuredClone(reg)] }));
    setDocRef(''); setDocDate('');
    toast(`تم اختيار ${reg.name.ar}.`);
  };
  const compare = (reg: RegulationPack) => {
    if (!guard(reg)) return;
    changeProject((p) => {
      const base = p.scenarios.find((s) => s.id === p.activeScenarioId) ?? p.scenarios[0];
      const copy: Scenario = { ...structuredClone(base), id: id('scenario'), name: `بديل: ${reg.code}`, regulationId: reg.id };
      copy.regulationEvidence = makeEvidence(reg, p.info, copy, 'USER_SELECTED');
      return { ...p, scenarios: [...p.scenarios, copy], regulationSnapshots: [...p.regulationSnapshots.filter((r) => r.id !== reg.id), structuredClone(reg)] };
    });
    toast(`أضيف ${reg.code} كسيناريو بديل. قارن بينهما من صفحة السيناريوهات.`);
  };
  const saveDocument = () => {
    if (!active) return;
    if (docRef.trim().length < 3) return toast('أدخل رقم طلب الخدمة المكتوب أسفل وثيقة نظام البناء.', true);
    changeProject((p) => ({ ...p, scenarios: p.scenarios.map((s) => s.id === p.activeScenarioId ? { ...s, regulationEvidence: makeEvidence(active, p.info, s, 'DOCUMENTED', { documentReference: docRef, issueDate: docDate, documentKind: docKind }) } : s) }));
    toast('تم ربط النظام بوثيقة الأمانة.');
  };
  const copyPack = (reg: RegulationPack) => {
    const copy = { ...structuredClone(reg), id: id('reg'), code: `${reg.code}-CUSTOM`, name: { ar: `نسخة معدلة من ${reg.name.ar}`, en: `Copy of ${reg.name.en}` }, verificationStatus: 'USER_REFERENCE_CALCULABLE' as const, version: 'user-1', source: 'User edited custom reference', sourceReference: 'نظام معدل من المستخدم', calculationReady: true, applicabilityScope: { kind: 'REFERENCE' as const } };
    useAppStore.setState({ regulations: [copy, ...useAppStore.getState().regulations] });
    void useAppStore.getState().persist();
    onEdit(copy.id);
  };
  return <div className="stack">
    <Section title={{ ar: 'النظام المطبق', en: 'Applied Regulation' }}>
      {active && activeResult ? <>
        <div className="source-line"><BookOpen size={20} /><div><strong>{active.name.ar}</strong><small>{active.sourceReference}</small></div></div>
        <span className={`confidence ${activeResult.regulationConfidence?.level.toLowerCase()} ${activeResult.regulationConfidence?.expired ? 'expired' : ''}`}>{activeResult.regulationConfidence?.label.ar}</span>
        {active.notes.ar && active.id !== 'DEMO_ONLY_RIYADH_MIXED_01' && !active.notes.ar.startsWith('هذه حزمة') ? <p className="reg-note">{active.notes.ar}</p> : null}
      </> : <Alert>{use === 'Residential Villas' ? 'أدخل مساحة الأرض وعروض الشوارع. الفلل على شوارع أقل من 30م تأخذ س 111 تلقائيًا.' : 'اختر النظام المكتوب في وثيقة «نظام البناء» للقطعة من القائمة بالأسفل.'}</Alert>}
    </Section>
    {active && <Section title={{ ar: 'وثيقة نظام البناء من الأمانة', en: 'Amanah Document' }} detail="اختياري: يرفع درجة الثقة في الدراسة. الوثيقة صالحة سنة من تاريخ الاعتماد">
      <div className="form-grid">
        <Input label={{ ar: 'رقم طلب الخدمة', en: 'Request No.' }} value={docRef} onChange={setDocRef} placeholder="1447/313660" />
        <label className="m-field"><span className="field-label">تاريخ الاعتماد</span><input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} /></label>
      </div>
      <Segmented value={docKind} onChange={setDocKind} options={[{ value: 'PRELIMINARY', label: 'نظام أولي' }, { value: 'APPROVED', label: 'نظام معتمد' }]} />
      <Btn secondary className="full" onClick={saveDocument}><FileCheck2 size={17} /> حفظ بيانات الوثيقة</Btn>
    </Section>}
    <div className="list-heading"><h2>الأنظمة المتاحة لـ{useLabels[use]}</h2><p>لو الوثيقة فيها أكثر من نظام للقطعة، أضف كل واحد كسيناريو وقارن الجدوى.</p></div>
    {visible.map(({ reg, assessment }) => {
      const excluded = assessment.status === 'EXCLUDED';
      const isActive = reg.id === scenario.regulationId;
      const est = excluded ? null : preview(reg);
      return <section key={reg.id} className={`m-card reg-card ${isActive ? 'active' : ''} ${excluded ? 'excluded' : ''}`}>
        <header><div><h3>{reg.name.ar}</h3><small>{reg.applicableUses.map((u) => useLabels[u] ?? u).join(' · ')}</small></div>{isActive && <span className="active-chip"><Check size={13} /> مطبق</span>}</header>
        <div className="reg-figures">
          <div><span>الأدوار</span><b>{reg.maxFloors.value === null ? 'مفتوح' : reg.maxFloors.value}</b></div>
          <div><span>التغطية</span><b>{reg.coverage.value.ground === null ? '—' : pct(reg.coverage.value.ground)}</b></div>
          <div><span>معامل البناء</span><b>{reg.far.source === 'NO_FAR' ? 'لا يوجد' : reg.far.value === null ? '—' : unit(reg.far.value, 2)}</b></div>
          <div><span>المسطحات</span><b dir="ltr">{est ? `${unit(est.envelope.achievedGfa)} م²` : '—'}</b></div>
        </div>
        {excluded && assessment.reasons.map((v, i) => <div className="reg-note" key={i}>{v}</div>)}
        {!excluded && missingText(reg).length ? <div className="reg-note">غير محدد في المرجع: {missingText(reg).join('، ')}</div> : null}
        <div className="actions-row">
          {!excluded && !isActive && <Btn onClick={() => select(reg)}>اختيار</Btn>}
          {!excluded && !isActive && <Btn secondary onClick={() => compare(reg)}><Layers size={15} /> سيناريو بديل</Btn>}
          <Btn secondary onClick={() => copyPack(reg)}><Copy size={15} /> نسخة للتعديل</Btn>
          {reg.code.endsWith('-CUSTOM') && <Btn secondary onClick={() => onEdit(reg.id)}>تعديل</Btn>}
        </div>
      </section>;
    })}
    <button className="text-link center" onClick={() => setShowAll((v) => !v)}>{showAll ? 'إخفاء الأنظمة غير المناسبة لنوع التطوير' : 'عرض كل الأنظمة'}</button>
  </div>;
}

/* ───────────────────────── Development ───────────────────────── */
export function DevelopmentScreen({ scenario, result, regulation, navigate }: { scenario: Scenario; result: ScenarioResult | null; regulation: RegulationPack | null; navigate: Nav }) {
  if (!result || !regulation) return <NoRegulation navigate={navigate} />;
  const e = result.envelope; const villas = scenario.developmentUse === 'Residential Villas';
  const manualFar = overrideValue(scenario, 'far');
  return <div className="stack">
    <div className="stats-grid">
      <Stat label={{ ar: 'بصمة البناء', en: 'Footprint' }} value={`${unit(e.finalFootprint)} م²`} />
      <Stat label={{ ar: 'إجمالي المسطحات', en: 'GFA' }} value={`${unit(e.achievedGfa)} م²`} />
      <Stat label={{ ar: 'المسموح بالمعامل', en: 'Permitted by FAR' }} value={e.farSource === 'NO_FAR' ? 'بدون معامل' : `${unit(e.permittedGfa)} م²`} />
      <Stat label={{ ar: villas ? 'عدد الفلل' : 'عدد الوحدات', en: villas ? 'Villas' : 'Units' }} value={unit(villas ? result.outputs.villas : result.outputs.units)} />
    </div>
    <Section title={{ ar: 'مسطحات الأدوار', en: 'Floor Areas' }} detail={`القيد المتحكم: ${({ Geometry: 'الارتدادات', Coverage: 'نسبة التغطية', FAR: 'معامل البناء' } as Record<string, string>)[e.controllingConstraint] ?? e.controllingConstraint}`}>
      <div className="floor-list">{e.floorAreas.map((floor, i) => <div key={i} className="floor-row"><span className="floor-indicator" /><div><strong>{floorLabel(floor.floor)}</strong><small>حد التغطية {unit(floor.coverageLimit)} م² · حد الارتدادات {unit(floor.zoneLimit)} م²</small></div><strong dir="ltr">{unit(floor.finalAllowedArea)} م²</strong></div>)}</div>
    </Section>
    <Section title={{ ar: 'الوحدات والتعديلات', en: 'Units & Overrides' }}>
      <div className="form-grid">
        {villas ? <Num label={{ ar: 'مساحة أرض الفيلا', en: 'Villa Plot Area' }} suffix="م²" value={scenario.productMix.averageVillaPlotArea} min={1} onChange={(averageVillaPlotArea) => changeScenario((s) => ({ ...s, productMix: { ...s.productMix, averageVillaPlotArea } }))} />
          : <Num label={{ ar: 'متوسط مساحة الشقة', en: 'Average Unit Area' }} suffix="م²" value={scenario.productMix.averageUnitArea} min={1} onChange={(averageUnitArea) => changeScenario((s) => ({ ...s, productMix: { ...s.productMix, averageUnitArea } }))} />}
        <Num label={{ ar: 'معامل بناء يدوي', en: 'Manual FAR' }} value={manualFar || undefined} max={100} onChange={(value) => value > 0 ? setOverride('far', value) : clearOverride('far')} hint="اتركه فارغًا لاستخدام معامل النظام" />
      </div>
    </Section>
    <Section title={{ ar: 'المساحات الصافية', en: 'Net Areas' }}><div className="metric-list">
      <Metric label="سكني" value={`${unit(result.outputs.sellableResidential)} م²`} />
      <Metric label="تجاري" value={`${unit(result.outputs.sellableRetail)} م²`} />
      <Metric label="مكاتب" value={`${unit(result.outputs.sellableOffice)} م²`} />
    </div></Section>
    {e.warnings.length > 0 && <Section title={{ ar: 'ملاحظات الحساب', en: 'Notes' }}>{e.warnings.map((w, i) => <div className="warning-row" key={i}><AlertCircle size={15} />{w.includes(' / ') ? w.split(' / ')[1] : w.includes(' — ') ? w.split(' — ')[1] : w}</div>)}</Section>}
  </div>;
}

/* ───────────────────────── Parking ───────────────────────── */
export function ParkingScreen({ scenario, result, navigate }: { scenario: Scenario; result: ScenarioResult | null; navigate: Nav }) {
  if (!result) return <NoRegulation navigate={navigate} />;
  const p = result.parking; const mode = scenario.basementMode ?? 'MANUAL';
  const layoutText = { PERPENDICULAR: 'عمودي', ANGLED_45: 'مائل 45°', NOT_ALLOWED: 'غير محتسب' } as const;
  const apartments = scenario.developmentUse === 'Residential Apartments' || scenario.developmentUse === 'Residential + Retail';
  const largeShare = scenario.productMix.largeUnitShare ?? (scenario.productMix.averageUnitArea > LARGE_UNIT_AREA ? 1 : 0);
  return <div className="stack">
    <div className="stats-grid">
      <Stat label={{ ar: 'المطلوب', en: 'Required' }} value={unit(p.requiredSpaces)} />
      <Stat label={{ ar: 'على الشوارع', en: 'On Streets' }} value={unit(p.surfaceParking)} />
      <Stat label={{ ar: 'الأقبية', en: 'Basements' }} value={p.providedBasements === 0 ? 'لا يحتاج' : unit(p.providedBasements)} tone={p.providedBasements > 0 ? 'gold' : 'success'} />
      <Stat label={{ ar: 'الرصيد', en: 'Balance' }} value={`${p.balance > 0 ? '+' : ''}${unit(p.balance)}`} tone={p.balance < 0 ? 'danger' : 'success'} />
    </div>
    <div className={`parking-verdict ${p.status === 'SHORTAGE' ? 'bad' : ''}`}>
      {p.status === 'SHORTAGE' ? `عجز ${unit(Math.abs(p.balance))} موقف. زد الأقبية أو قلل عدد الوحدات.` : p.providedBasements === 0 ? 'مواقف الشوارع تكفي، ولا حاجة لقبو.' : `مواقف الشوارع لا تكفي: المطلوب ${unit(p.providedBasements)} قبو لتغطية ${unit(Math.max(0, p.requiredSpaces - p.surfaceParking))} موقف.`}
    </div>
    <Section title={{ ar: 'المطلوب', en: 'Demand' }} detail={apartments ? `موقف للشقة حتى ${LARGE_UNIT_AREA}م²، وموقفان للأكبر` : undefined}>
      <div className="metric-list">{p.demandBreakdown?.map((row, i) => <Metric key={i} label={row.label.ar} value={`${unit(row.spaces)} موقف`} />)}</div>
      <div className="form-grid">
        {apartments && <Num label={{ ar: `شقق أكبر من ${LARGE_UNIT_AREA}م²`, en: 'Large Units' }} suffix="%" max={100} value={Math.round(largeShare * 100)} onChange={(n) => changeScenario((s) => ({ ...s, productMix: { ...s.productMix, largeUnitShare: n / 100 } }))} hint="نسبتها من إجمالي الشقق" />}
        <Num label={{ ar: 'عدد مطلوب يدوي', en: 'Manual Required' }} value={overrideValue(scenario, 'parking.requiredSpaces')} min={0} max={100000} onChange={(n) => n > 0 ? setOverride('parking.requiredSpaces', n) : clearOverride('parking.requiredSpaces')} hint="اتركه فارغًا للحساب التلقائي" />
      </div>
    </Section>
    <Section title={{ ar: 'مواقف الشوارع', en: 'Street Parking' }} detail={`الموقف ${STALL_WIDTH} × ${STALL_LENGTH}م · عمودي لشوارع 15 إلى 25م · مائل 45° لشوارع 30م فأكثر`}>
      {p.streetSides?.length ? <div className="street-list">{p.streetSides.map((s) => <div key={s.side} className="street-row">
        <div><strong>{sideLabels[s.side]} · شارع {unit(s.streetWidth)}م</strong><small>{layoutText[s.layout]}{s.layout !== 'NOT_ALLOWED' ? ` · ${unit(s.frontage, 1)}م ÷ ${s.stallAlongCurb}م` : ' · أقل من 15م'}</small></div>
        <b>{unit(s.spaces)}</b>
      </div>)}</div> : <Alert>لا توجد شوارع مدخلة. أدخل عروض الشوارع في صفحة الأرض.</Alert>}
      <div className="form-grid">
        <Num label={{ ar: 'مواقف مخصومة', en: 'Lost Spaces' }} value={scenario.streetParkingLostSpaces || undefined} min={0} max={1000} onChange={(streetParkingLostSpaces) => changeScenario((s) => ({ ...s, streetParkingLostSpaces }))} hint="للمداخل والزوايا" />
        <Num label={{ ar: 'عدد مؤكد من المخطط', en: 'Confirmed Count' }} value={scenario.surfaceParking} min={0} max={10000} onChange={(n) => changeScenario((s) => ({ ...s, surfaceParking: n > 0 ? n : undefined }))} hint="يستبدل الحساب التلقائي" />
      </div>
    </Section>
    <Section title={{ ar: 'القبو', en: 'Basement' }} detail="يُحسب فقط إذا لم تكفِ مواقف الشوارع">
      <Segmented value={mode} onChange={(basementMode) => changeScenario((s) => ({ ...s, basementMode, basementCount: basementMode === 'MANUAL' ? Math.max(s.basementCount, p.basementCountRequired) : s.basementCount }))} options={[{ value: 'AUTO', label: 'تلقائي حسب العجز' }, { value: 'MANUAL', label: 'عدد يدوي' }]} />
      <div className="form-grid">
        {mode === 'MANUAL' && <Num label={{ ar: 'عدد الأقبية', en: 'Basements' }} value={scenario.basementCount} min={0} max={10} onChange={(basementCount) => changeScenario((s) => ({ ...s, basementCount }))} />}
        <Num label={{ ar: 'مسطح القبو من الأرض', en: 'Basement Plate' }} suffix="%" max={100} value={scenario.basementCoverage ? Math.round(scenario.basementCoverage * 100) : undefined} onChange={(n) => changeScenario((s) => ({ ...s, basementCoverage: n > 0 ? n / 100 : undefined }))} hint="فارغ = بصمة الدور الأرضي" />
        <Num label={{ ar: 'مساحة الموقف بالحركة', en: 'Area per Space' }} suffix="م²" value={scenario.parkingEfficiencySqmPerSpace ?? 30} min={12} max={200} onChange={(parkingEfficiencySqmPerSpace) => changeScenario((s) => ({ ...s, parkingEfficiencySqmPerSpace }))} />
      </div>
      <div className="metric-list"><Metric label="سعة القبو الواحد" value={`${unit(p.spacesPerBasement)} موقف`} /><Metric label="الأقبية المطلوبة" value={unit(p.basementCountRequired)} /></div>
    </Section>
  </div>;
}

/* ───────────────────────── Financial ───────────────────────── */
function Chart({ rows }: { rows: { month: number; cumulative: number }[] }) {
  if (!rows.length) return null;
  const values = rows.map((r) => r.cumulative);
  const low = Math.min(0, ...values), high = Math.max(1, ...values), span = high - low;
  const points = rows.map((r, i) => `${(i / Math.max(1, rows.length - 1) * 320).toFixed(1)},${(100 - ((r.cumulative - low) / span) * 90 - 5).toFixed(1)}`).join(' ');
  const zero = 100 - (0 - low) / span * 90 - 5;
  return <div className="flow-chart"><svg role="img" aria-label="التدفق النقدي التراكمي" viewBox="0 0 320 116" preserveAspectRatio="none"><line x1="0" x2="320" y1={zero} y2={zero} className="chart-zero" /><polyline points={points} className="chart-line" /></svg><div className="chart-axis"><span>الشهر 1</span><span>الشهر {rows.length}</span></div></div>;
}
function Fin({ f, set, field, ar, en, suffix = 'ر.س', percent = false }: { f: FinancialInputs; set: (key: keyof FinancialInputs, value: number) => void; field: keyof FinancialInputs; ar: string; en: string; suffix?: string; percent?: boolean }) {
  const raw = Number(f[field] ?? 0);
  return <Num label={{ ar, en }} value={percent ? Math.round(raw * 10000) / 100 : raw} suffix={percent ? '%' : suffix} max={percent ? 100 : undefined} onChange={(n) => set(field, percent ? n / 100 : n)} />;
}
type FinanceTab = 'land' | 'build' | 'soft' | 'income' | 'mix';

export function FinancialScreen({ scenario, result, navigate }: { scenario: Scenario; result: ScenarioResult | null; navigate: Nav }) {
  const [tab, setTab] = useState<FinanceTab>('land');
  if (!result) return <NoRegulation navigate={navigate} />;
  const f = scenario.financial; const r = result.financial; const rent = f.mode === 'RENT';
  const set = (key: keyof FinancialInputs, value: number) => changeScenario((s) => ({ ...s, financial: { ...s.financial, [key]: value } }));
  const setMix = (key: 'residentialShare' | 'retailShare' | 'officeShare', value: number) => changeScenario((s) => ({ ...s, productMix: { ...s.productMix, [key]: value } }));
  const mixTotal = scenario.productMix.residentialShare + scenario.productMix.retailShare + scenario.productMix.officeShare;
  const tabs: { id: FinanceTab; title: string }[] = [{ id: 'land', title: 'الأرض' }, { id: 'build', title: 'الإنشاء' }, { id: 'soft', title: 'مصاريف أخرى' }, { id: 'income', title: rent ? 'الإيجار' : 'البيع' }, { id: 'mix', title: 'الاستخدامات' }];
  return <div className="stack">
    <Segmented value={rent ? 'RENT' : 'SALE'} onChange={(mode) => changeScenario((s) => ({ ...s, financial: { ...s.financial, mode } }))} options={[{ value: 'SALE', label: 'تطوير وبيع' }, { value: 'RENT', label: 'تطوير وتأجير' }]} />
    <section className="finance-hero">
      <span>{rent ? 'صافي الدخل السنوي' : 'صافي الربح المقدر'}</span>
      <strong dir="ltr">{cash(rent ? r.annualNoi ?? 0 : r.profit)}</strong>
      <div>{rent ? <><span>العائد على التكلفة <b dir="ltr">{pct(r.yieldOnCost ?? 0)}</b></span><span>الاسترداد <b>{r.paybackYears ? `${unit(r.paybackYears, 1)} سنة` : '—'}</b></span></>
        : <><span>العائد على التكلفة <b dir="ltr">{pct(r.roi)}</b></span><span>هامش الربح <b dir="ltr">{pct(r.profitMargin)}</b></span></>}</div>
    </section>
    <div className="stats-grid">
      <Stat label={{ ar: 'إجمالي التكلفة', en: 'Total Cost' }} value={compact(r.totalCost)} />
      <Stat label={rent ? { ar: 'قيمة العقار بعد التأجير', en: 'Stabilized Value' } : { ar: 'إجمالي الإيرادات', en: 'Revenue' }} value={compact(r.revenue)} tone="success" />
    </div>
    <Section title={{ ar: 'المدخلات', en: 'Inputs' }} detail="القيم الافتراضية للبدء فقط، عدّلها حسب السوق">
      <div className="tab-strip">{tabs.map((v) => <button key={v.id} className={tab === v.id ? 'on' : ''} onClick={() => setTab(v.id)}>{v.title}</button>)}</div>
      <div className="form-grid">
        {tab === 'land' && <><Fin f={f} set={set} field="landPrice" ar="سعر متر الأرض" en="Land / m²" suffix="ر.س/م²" /><Fin f={f} set={set} field="brokeragePercent" ar="السعي" en="Brokerage" percent /><Fin f={f} set={set} field="rettPercent" ar="ضريبة التصرفات العقارية" en="RETT" percent /><Fin f={f} set={set} field="otherAcquisitionCost" ar="تكاليف شراء أخرى" en="Other Acquisition" /></>}
        {tab === 'build' && <><Fin f={f} set={set} field="structuralRate" ar="العظم" en="Structure" suffix="ر.س/م²" /><Fin f={f} set={set} field="finishingRate" ar="التشطيبات" en="Finishing" suffix="ر.س/م²" /><Fin f={f} set={set} field="mepRate" ar="الكهروميكانيكا" en="MEP" suffix="ر.س/م²" /><Fin f={f} set={set} field="basementRate" ar="القبو" en="Basement" suffix="ر.س/م²" /><Fin f={f} set={set} field="constructionVatPercent" ar="ضريبة القيمة المضافة" en="VAT on construction" percent /><Fin f={f} set={set} field="contingencyPercent" ar="احتياطي الطوارئ" en="Contingency" percent /></>}
        {tab === 'soft' && <><Fin f={f} set={set} field="designCost" ar="التصميم" en="Design" /><Fin f={f} set={set} field="supervisionCost" ar="الإشراف" en="Supervision" /><Fin f={f} set={set} field="permitsCost" ar="رسوم الرخص" en="Permits" /><Fin f={f} set={set} field="adminCost" ar="الإدارة" en="Administration" /><Fin f={f} set={set} field="externalWorksCost" ar="الأعمال الخارجية" en="External Works" /><Fin f={f} set={set} field="consultancyCost" ar="استشارات أخرى" en="Consultancy" /></>}
        {tab === 'income' && !rent && <><Fin f={f} set={set} field="sellingPriceResidential" ar="بيع السكني" en="Residential" suffix="ر.س/م²" /><Fin f={f} set={set} field="sellingPriceRetail" ar="بيع التجاري" en="Retail" suffix="ر.س/م²" /><Fin f={f} set={set} field="sellingPriceOffice" ar="بيع المكاتب" en="Office" suffix="ر.س/م²" /><Fin f={f} set={set} field="marketingPercent" ar="التسويق" en="Marketing" percent /><Fin f={f} set={set} field="salesCommissionPercent" ar="عمولة البيع" en="Commission" percent /></>}
        {tab === 'income' && rent && <><Fin f={f} set={set} field="rentResidential" ar="إيجار السكني السنوي" en="Residential rent" suffix="ر.س/م²" /><Fin f={f} set={set} field="rentRetail" ar="إيجار التجاري السنوي" en="Retail rent" suffix="ر.س/م²" /><Fin f={f} set={set} field="rentOffice" ar="إيجار المكاتب السنوي" en="Office rent" suffix="ر.س/م²" /><Fin f={f} set={set} field="occupancyPercent" ar="نسبة الإشغال" en="Occupancy" percent /><Fin f={f} set={set} field="opexPercent" ar="مصاريف التشغيل" en="Operating costs" percent /><Fin f={f} set={set} field="capRate" ar="معدل الرسملة" en="Cap rate" percent /></>}
        {tab === 'mix' && <><Num label={{ ar: 'سكني', en: 'Residential' }} suffix="%" max={100} value={Math.round(scenario.productMix.residentialShare * 100)} onChange={(n) => setMix('residentialShare', n / 100)} /><Num label={{ ar: 'تجاري', en: 'Retail' }} suffix="%" max={100} value={Math.round(scenario.productMix.retailShare * 100)} onChange={(n) => setMix('retailShare', n / 100)} /><Num label={{ ar: 'مكاتب', en: 'Office' }} suffix="%" max={100} value={Math.round(scenario.productMix.officeShare * 100)} onChange={(n) => setMix('officeShare', n / 100)} /><Fin f={f} set={set} field="sellableEfficiencyResidential" ar="كفاءة السكني" en="Res. efficiency" percent /><Fin f={f} set={set} field="sellableEfficiencyRetail" ar="كفاءة التجاري" en="Retail efficiency" percent /><Fin f={f} set={set} field="sellableEfficiencyOffice" ar="كفاءة المكاتب" en="Office efficiency" percent /></>}
      </div>
      {tab === 'mix' && Math.abs(mixTotal - 1) > 0.001 && <Alert danger>مجموع نسب الاستخدامات {pct(mixTotal)}، ويجب أن يساوي 100%.</Alert>}
    </Section>
    <Section title={{ ar: 'تفصيل النتائج', en: 'Breakdown' }}><div className="metric-list">
      <Metric label="الأرض" value={cash(r.landCost)} /><Metric label="الإنشاء" value={cash(r.constructionCost)} /><Metric label="مصاريف أخرى وضرائب" value={cash(r.softCosts)} />
      {rent ? <><Metric label="إجمالي الإيجار السنوي" value={cash(r.annualGrossRent ?? 0)} /><Metric label="صافي الدخل السنوي" value={cash(r.annualNoi ?? 0)} /><Metric label="قيمة العقار بمعدل الرسملة" value={cash(r.exitValue ?? 0)} /><Metric label="IRR على 10 سنوات" value={r.irr === null ? '—' : pct(r.irr)} /></>
        : <><Metric label="الإيرادات" value={cash(r.revenue)} /><Metric label="صافي الربح" value={cash(r.profit)} /><Metric label="أقصى تمويل مطلوب" value={cash(r.peakFunding)} /><Metric label="IRR سنوي" value={r.irr === null ? '—' : pct(r.irr)} /></>}
    </div></Section>
    {!rent && <Section title={{ ar: 'التدفق النقدي التراكمي', en: 'Cash Flow' }} detail="توزيع افتراضي على 18 شهرًا، والبيع يبدأ من الشهر السابع"><Chart rows={r.monthlyCashFlow} /></Section>}
  </div>;
}

