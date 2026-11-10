import { describe, expect, it } from 'vitest';
import { regulationLibrarySeed } from '../data/demoRegulations';
import { defaultFinancial, defaultProductMix } from '../shared/defaults';
import type { ProjectInfo, Scenario } from '../shared/types';
import { assessRegulation, documentExpired, evidenceValid, makeEvidence, regulationConfidence, suggestRegulation, validateSelection } from './regulationSelection';

const info: ProjectInfo = { id: 'p', name: 'Test', city: 'Riyadh', district: 'الياسمين', planNumber: '1637', plotNumber: '1607', use: 'Residential Villas', status: 'Draft', updatedAt: '' };
const scenario = (patch: Partial<Scenario> = {}, street = 20): Scenario => ({
  id: 's', name: 's', regulationId: '', financial: defaultFinancial, productMix: defaultProductMix, developmentUse: 'Residential Villas', basementCount: 0, overrides: [],
  plot: { officialArea: 600, length: 30, width: 20, accuracy: 'Exact', boundaries: [{ side: 'front', type: 'Street', width: street }, { side: 'right', type: 'Neighbor' }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] },
  ...patch
});
const pack = (id: string) => regulationLibrarySeed.find((r) => r.id === id)!;

describe('Regulation selection', () => {
  it('applies the villa zone automatically on streets narrower than 30 m', () => {
    expect(suggestRegulation(scenario(), regulationLibrarySeed)?.id).toBe('RIYADH-S111');
    expect(suggestRegulation(scenario({}, 25), regulationLibrarySeed)?.id).toBe('RIYADH-S111');
  });

  it('asks for the system on wide streets, apartment buildings and commercial uses', () => {
    expect(suggestRegulation(scenario({}, 30), regulationLibrarySeed)).toBeNull();
    expect(suggestRegulation(scenario({}, 36), regulationLibrarySeed)).toBeNull();
    expect(suggestRegulation(scenario({ developmentUse: 'Residential Apartments' }), regulationLibrarySeed)).toBeNull();
    expect(suggestRegulation(scenario({ developmentUse: 'Commercial' }), regulationLibrarySeed)).toBeNull();
  });

  it('does not suggest anything before the plot area is entered', () => {
    const s = scenario(); s.plot = { ...s.plot, officialArea: 0 };
    expect(suggestRegulation(s, regulationLibrarySeed)).toBeNull();
  });

  it('offers at least one system for every development use', () => {
    for (const use of ['Residential Villas', 'Residential Apartments', 'Residential + Retail', 'Retail', 'Office', 'Retail + Office', 'Commercial', 'Manual / Custom Study'] as const) {
      const count = regulationLibrarySeed.filter((reg) => assessRegulation(reg, info, use).status !== 'EXCLUDED').length;
      expect(count, use).toBeGreaterThan(0);
    }
  });

  it('blocks a system whose uses do not cover the study', () => {
    expect(validateSelection(pack('RIYADH-S111'), info, scenario({ developmentUse: 'Office' })).length).toBeGreaterThan(0);
    expect(validateSelection(pack('RIYADH-M111'), info, scenario({ developmentUse: 'Office' }))).toHaveLength(0);
  });

  it('keeps a selected system when the plot is edited', () => {
    const reg = pack('RIYADH-M111');
    const s = scenario({ developmentUse: 'Residential Apartments', regulationId: reg.id });
    s.regulationEvidence = makeEvidence(reg, info, s, 'USER_SELECTED');
    expect(evidenceValid(s, reg)).toBe(true);
    const edited = { ...s, plot: { ...s.plot, officialArea: 750 } };
    expect(evidenceValid(edited, reg)).toBe(true);
    expect(evidenceValid({ ...s, developmentUse: 'Residential Villas' }, reg)).toBe(false);
    expect(evidenceValid({ ...s, regulationId: 'RIYADH-M112' }, reg)).toBe(false);
  });

  it('reports how the system was established', () => {
    const villa = pack('RIYADH-S111');
    const auto = scenario({ regulationId: villa.id }); auto.regulationEvidence = makeEvidence(villa, info, auto, 'AUTO');
    expect(regulationConfidence(auto, villa).level).toBe('AUTO');
    const picked = scenario({ regulationId: villa.id }); picked.regulationEvidence = makeEvidence(villa, info, picked, 'USER_SELECTED');
    expect(regulationConfidence(picked, villa).level).toBe('USER_SELECTED');
    const documented = scenario({ regulationId: villa.id });
    documented.regulationEvidence = makeEvidence(villa, info, documented, 'DOCUMENTED', { documentReference: '1447/313660', issueDate: '2026-10-10', documentKind: 'APPROVED' });
    expect(regulationConfidence(documented, villa).level).toBe('DOCUMENTED');
    expect(regulationConfidence(scenario(), villa).level).toBe('NONE');
  });

  it('flags an Amanah document older than one year', () => {
    const villa = pack('RIYADH-S111');
    const s = scenario({ regulationId: villa.id });
    s.regulationEvidence = makeEvidence(villa, info, s, 'DOCUMENTED', { documentReference: '1447/313660', issueDate: '2025-10-10' });
    expect(documentExpired(s.regulationEvidence, new Date('2026-11-10'))).toBe(true);
    expect(documentExpired(s.regulationEvidence, new Date('2026-09-01'))).toBe(false);
  });
});
