import type { PlotData, ProjectInfo, ProjectUse, RegulationPack, RegulationSelectionEvidence, Scenario } from '../shared/types';

export type CandidateStatus = 'EXCLUDED' | 'POSSIBLE' | 'LOCATION_UNCONFIRMED';
export interface RegulationCandidate {
  status: CandidateStatus;
  kind: 'GENERAL' | 'SPECIAL' | 'LOCAL' | 'REFERENCE' | 'DEMO' | 'UNCLASSIFIED';
  reasons: string[];
  locationMatched: boolean;
  useMatched: boolean;
}
const normal = (s?: string) => (s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
export const plotSignature = (plot: PlotData) => JSON.stringify({
  area: plot.officialArea, length: plot.length, width: plot.width, accuracy: plot.accuracy,
  boundaries: plot.boundaries.map(({side,type,width,streetRole})=>({side,type,width,streetRole})).sort((a,b)=>a.side.localeCompare(b.side))
});
export const parcelKey = (p: ProjectInfo) => [p.city,p.district,p.planNumber,p.plotNumber,p.deedNumber,p.location,p.use].map(normal).join('|');
export const parcelIdentified = (p: ProjectInfo) => Boolean(normal(p.district) && ((normal(p.planNumber) && normal(p.plotNumber)) || normal(p.deedNumber)));

export function assessRegulation(reg: RegulationPack, info: ProjectInfo, use: ProjectUse): RegulationCandidate {
  const reasons: string[] = [];
  const kind = reg.applicabilityScope?.kind ?? (reg.verificationStatus === 'DEMO_ONLY' ? 'DEMO' : 'UNCLASSIFIED');
  const useMatched = reg.applicableUses.includes(use) || use === 'Manual / Custom Study' && reg.applicableUses.includes('Manual / Custom Study');
  const cityMatched = reg.city === info.city;
  if (!useMatched) reasons.push('الاستخدام المختار غير مدرج ضمن الاستخدامات التي تغطيها الحزمة.');
  if (!cityMatched) reasons.push('مدينة النظام تختلف عن مدينة الأرض.');
  if (reg.verificationStatus === 'DEMO_ONLY') reasons.push('هذه حزمة تجريبية ولا يجوز ربطها كاشتراط قائم.');
  const scope = reg.applicabilityScope;
  const checks: Array<[string[] | undefined,string,string]> = [
    [scope?.districts,info.district,'الحي'],
    [scope?.planNumbers,info.planNumber ?? '', 'رقم المخطط'],
    [scope?.plotNumbers,info.plotNumber ?? '', 'رقم القطعة']
  ];
  let locationMatched = Boolean(scope?.districts?.length || scope?.planNumbers?.length || scope?.plotNumbers?.length);
  for (const [allowed,value,label] of checks) {
    if (!allowed?.length) continue;
    if (!normal(value)) { locationMatched = false; reasons.push(`بيان ${label} غير متوفر للتحقق من نطاق الحزمة.`); }
    else if (!allowed.some((item)=>normal(item)===normal(value))) {
      reasons.push(`${label} لا يطابق النطاق الجغرافي المحدد في الحزمة.`);
      return {status:'EXCLUDED',kind,reasons,locationMatched:false,useMatched};
    }
  }
  if (!cityMatched || !useMatched || reg.verificationStatus === 'DEMO_ONLY') return {status:'EXCLUDED',kind,reasons,locationMatched:false,useMatched};
  if (!locationMatched) reasons.push('لا يوجد نطاق مكاني موثق كافٍ في بيانات الحزمة لإثبات انطباقها على القطعة.');
  if (reg.verificationStatus !== 'VERIFIED') reasons.push('الاشتراطات نفسها مرجعية/مدخلة من المستخدم وليست موثقة رسميًا داخل التطبيق.');
  return {status:locationMatched?'POSSIBLE':'LOCATION_UNCONFIRMED',kind,reasons,locationMatched,useMatched};
}

export function validateEvidence(reg: RegulationPack, info: ProjectInfo, scenario: Scenario, evidence: Pick<RegulationSelectionEvidence,'documentReference'|'applicabilityReason'|'precedenceReason'|'reviewer'>, needPrecedenceReason: boolean, otherPacks: RegulationPack[] = []): string[] {
  const errs: string[] = [];
  if (!parcelIdentified(info)) errs.push('أدخل الحي ورقم المخطط والقطعة، أو رقم الصك، لتحديد الأرض قبل ربط النظام.');
  if (!(scenario.plot.officialArea > 0)) errs.push('أدخل المساحة الرسمية للأرض أولًا قبل ربط النظام بحسابات الدراسة.');
  const assessed=assessRegulation(reg,info,scenario.developmentUse ?? info.use);
  if (assessed.status==='EXCLUDED') errs.push(...assessed.reasons);
  if (reg.verificationStatus==='DEMO_ONLY') errs.push('لا يمكن استخدام الأنظمة التجريبية في دراسة فعلية.');
  for (const other of otherPacks) {
    if (other.id === reg.id || other.verificationStatus !== 'VERIFIED' || other.applicabilityScope?.kind !== 'SPECIAL' || !other.applicabilityScope.supersedesPackIds?.includes(reg.id)) continue;
    const otherStatus = assessRegulation(other,info,scenario.developmentUse ?? info.use);
    if (otherStatus.locationMatched && otherStatus.status !== 'EXCLUDED') {
      errs.push(`الحزمة الخاصة ${other.code} تسجل إحلالًا موثقًا محل ${reg.code} في نطاق هذه القطعة؛ لا يجوز اختيار النظام الذي حلت محله.`);
    }
  }
  if (!evidence.documentReference.trim() || evidence.documentReference.trim().length<7) errs.push('سجل رقم المستند أو رابط المصدر الرسمي المرتبط بقطعة الأرض (7 أحرف على الأقل).');
  if (evidence.applicabilityReason.trim().length<15) errs.push('اشرح لماذا ينطبق هذا النظام على الأرض مع ذكر نطاقه (15 حرفًا على الأقل).');
  if (needPrecedenceReason && evidence.precedenceReason.trim().length<15) errs.push('عند وجود عدة أنظمة محتملة يجب توثيق أولوية النظام أو حسم التعارض بمستند (15 حرفًا على الأقل).');
  if (!evidence.reviewer.trim()) errs.push('سجل اسم من راجع مستندات الانطباق.');
  return errs;
}

export function evidenceValid(scenario: Scenario, reg: RegulationPack): boolean {
  const e=scenario.regulationEvidence;
  return Boolean(e && e.status==='USER_DOCUMENTED' && e.regulationId===reg.id && e.regulationVersion===reg.version && e.plotSignature===plotSignature(scenario.plot) && e.developmentUse===(scenario.developmentUse??'Residential Apartments') && e.documentReference.trim().length >= 7 && e.applicabilityReason.trim().length >= 15 && e.reviewer.trim());
}

export function isOfficiallyConfirmedForParcel(_scenario:Scenario,_reg:RegulationPack): boolean {
  // An offline user-entered reference cannot prove authority-side parcel applicability.
  // Reserved for a future authenticated authority verification integration.
  return false;
}
