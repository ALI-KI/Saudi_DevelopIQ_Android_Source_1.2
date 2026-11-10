import type { PlotData, ProjectInfo, ProjectUse, RegulationConfidence, RegulationPack, RegulationSelectionEvidence, Scenario } from '../shared/types';

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
  boundaries: plot.boundaries.map(({ side, type, width, streetRole }) => ({ side, type, width, streetRole })).sort((a, b) => a.side.localeCompare(b.side))
});
/** Identity of the parcel itself. The optional map link and the use are not part of it. */
export const parcelKey = (p: ProjectInfo) => [p.city, p.district, p.planNumber, p.plotNumber, p.blockNumber, p.deedNumber].map(normal).join('|');
export const parcelIdentified = (p: ProjectInfo) => Boolean(normal(p.district) && ((normal(p.planNumber) && normal(p.plotNumber)) || normal(p.deedNumber)));

/** The default villa zone, applied automatically to ordinary villa plots. */
export const DEFAULT_VILLA_REGULATION_ID = 'RIYADH-S111';
/** Streets of 30 m and wider carry special regulations, so the system must be asked for. */
export const SPECIAL_STREET_WIDTH = 30;

export const widestStreet = (plot: PlotData) => Math.max(0, ...plot.boundaries.filter((b) => b.type === 'Street').map((b) => b.width ?? 0));

export function assessRegulation(reg: RegulationPack, info: ProjectInfo, use: ProjectUse): RegulationCandidate {
  const reasons: string[] = [];
  const kind = reg.applicabilityScope?.kind ?? (reg.verificationStatus === 'DEMO_ONLY' ? 'DEMO' : 'UNCLASSIFIED');
  const useMatched = reg.applicableUses.includes(use) || reg.applicableUses.includes('Manual / Custom Study') || use === 'Manual / Custom Study';
  const cityMatched = reg.city === info.city;
  if (!useMatched) reasons.push('الاستخدام المختار غير مدرج ضمن استخدامات هذا النظام.');
  if (!cityMatched) reasons.push('مدينة النظام تختلف عن مدينة الأرض.');
  if (reg.verificationStatus === 'DEMO_ONLY') reasons.push('نظام تجريبي لا يستخدم في دراسة فعلية.');
  const scope = reg.applicabilityScope;
  const checks: Array<[string[] | undefined, string, string]> = [
    [scope?.districts, info.district, 'الحي'],
    [scope?.planNumbers, info.planNumber ?? '', 'رقم المخطط'],
    [scope?.plotNumbers, info.plotNumber ?? '', 'رقم القطعة']
  ];
  let locationMatched = Boolean(scope?.districts?.length || scope?.planNumbers?.length || scope?.plotNumbers?.length);
  for (const [allowed, value, label] of checks) {
    if (!allowed?.length) continue;
    if (!normal(value)) locationMatched = false;
    else if (!allowed.some((item) => normal(item) === normal(value))) {
      reasons.push(`${label} خارج النطاق المسجل لهذا النظام.`);
      return { status: 'EXCLUDED', kind, reasons, locationMatched: false, useMatched };
    }
  }
  if (!cityMatched || !useMatched || reg.verificationStatus === 'DEMO_ONLY') return { status: 'EXCLUDED', kind, reasons, locationMatched: false, useMatched };
  return { status: locationMatched ? 'POSSIBLE' : 'LOCATION_UNCONFIRMED', kind, reasons, locationMatched, useMatched };
}

/**
 * Automatic choice: an ordinary villa plot (every street narrower than 30 m) takes the default villa zone.
 * Apartment buildings, commercial uses and wide streets return null: the user picks the system.
 */
export function suggestRegulation(scenario: Scenario, regulations: RegulationPack[]): RegulationPack | null {
  if (scenario.developmentUse !== 'Residential Villas') return null;
  if (!(scenario.plot.officialArea > 0)) return null;
  if (widestStreet(scenario.plot) >= SPECIAL_STREET_WIDTH) return null;
  return regulations.find((reg) => reg.id === DEFAULT_VILLA_REGULATION_ID) ?? null;
}

export function makeEvidence(reg: RegulationPack, info: ProjectInfo, scenario: Scenario, mode: NonNullable<RegulationSelectionEvidence['mode']>, doc: Partial<Pick<RegulationSelectionEvidence, 'documentReference' | 'issueDate' | 'documentKind' | 'reviewer'>> = {}): RegulationSelectionEvidence {
  const documentReference = (doc.documentReference ?? '').trim();
  return {
    regulationId: reg.id, regulationVersion: reg.version, parcelKey: parcelKey(info), plotSignature: plotSignature(scenario.plot),
    developmentUse: (scenario.developmentUse ?? info.use) as ProjectUse,
    documentReference, applicabilityReason: mode === 'AUTO' ? 'اختيار تلقائي: فلل سكنية على شوارع أقل من 30م' : '', precedenceReason: '',
    reviewer: (doc.reviewer ?? '').trim(), recordedAt: new Date().toISOString(), status: 'USER_DOCUMENTED',
    mode: documentReference ? 'DOCUMENTED' : mode, issueDate: doc.issueDate || undefined, documentKind: doc.documentKind
  };
}

/** Whether a system can be linked to this study. Only hard blockers are returned. */
export function validateSelection(reg: RegulationPack, info: ProjectInfo, scenario: Scenario): string[] {
  const errs: string[] = [];
  if (!(scenario.plot.officialArea > 0)) errs.push('أدخل مساحة الأرض أولًا.');
  const assessed = assessRegulation(reg, info, (scenario.developmentUse ?? info.use) as ProjectUse);
  if (assessed.status === 'EXCLUDED') errs.push(...assessed.reasons);
  return errs;
}

/** The selection still belongs to this scenario's system and use. */
export function evidenceValid(scenario: Scenario, reg: RegulationPack): boolean {
  if (reg.verificationStatus === 'DEMO_ONLY') return false;
  if (!scenario.regulationId || scenario.regulationId !== reg.id) return false;
  const use = (scenario.developmentUse ?? 'Residential Apartments') as ProjectUse;
  return reg.applicableUses.includes(use) || reg.applicableUses.includes('Manual / Custom Study') || use === 'Manual / Custom Study';
}

/** The Amanah document is valid for one year from its approval date. */
export function documentExpired(evidence?: RegulationSelectionEvidence, now = new Date()): boolean {
  if (!evidence?.issueDate) return false;
  const issued = new Date(evidence.issueDate);
  if (Number.isNaN(issued.getTime())) return false;
  const expiry = new Date(issued); expiry.setFullYear(expiry.getFullYear() + 1);
  return now > expiry;
}

export function regulationConfidence(scenario: Scenario, reg: RegulationPack): RegulationConfidence {
  const evidence = scenario.regulationEvidence;
  if (!evidenceValid(scenario, reg)) return { level: 'NONE', label: { ar: 'النظام غير محدد', en: 'No regulation' }, expired: false };
  const expired = documentExpired(evidence);
  if (evidence?.documentReference?.trim()) {
    const kind = evidence.documentKind === 'APPROVED' ? 'معتمدة' : evidence.documentKind === 'PRELIMINARY' ? 'أولية' : '';
    return { level: 'DOCUMENTED', label: { ar: expired ? 'وثيقة الأمانة منتهية الصلاحية' : `موثق بوثيقة الأمانة${kind ? ` (${kind})` : ''}`, en: expired ? 'Amanah document expired' : 'Backed by Amanah document' }, expired };
  }
  if (evidence?.mode === 'AUTO') return { level: 'AUTO', label: { ar: 'نظام تلقائي للفلل السكنية', en: 'Automatic villa regulation' }, expired: false };
  return { level: 'USER_SELECTED', label: { ar: 'نظام مختار — أكّده بوثيقة الأمانة', en: 'User selected — confirm with Amanah document' }, expired: false };
}
