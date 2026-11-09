import { describe, expect, it } from 'vitest';
import { demoRegulationPack, userReferenceRegulationPacks } from '../data/demoRegulations';
import { defaultFinancial, defaultPlot, defaultProductMix } from '../shared/defaults';
import { calculateEnvelope, calculateFinancial, calculateOutputs, calculateParking, runScenario } from './engines';
import { Scenario } from '../shared/types';

const scenario: Scenario = {
  id: 'test',
  name: 'Test',
  regulationId: demoRegulationPack.id,
  plot: defaultPlot,
  financial: defaultFinancial,
  productMix: defaultProductMix,
  developmentUse: 'Residential Apartments',
  basementCount: 2,
  overrides: []
};

const parkingReg = {
  ...demoRegulationPack,
  parking: {
    ...demoRegulationPack.parking,
    value: [
      { use: 'Residential Apartments' as const, ratio: 1, basis: 'unit' as const, status: 'VERIFIED' as const },
      { use: 'Retail' as const, ratio: 4, basis: '100sqm' as const, status: 'VERIFIED' as const },
      { use: 'Office' as const, ratio: 2, basis: '100sqm' as const, status: 'VERIFIED' as const }
    ]
  }
};

describe('Saudi DevelopIQ calculation engines', () => {
  it('calculates plot area difference and allowed envelope', () => {
    const envelope = calculateEnvelope(scenario, demoRegulationPack);
    expect(envelope.calculatedArea).toBe(900);
    expect(envelope.finalFootprint).toBeGreaterThan(0);
    expect(envelope.permittedGfa).toBe(2340);
    expect(envelope.achievedGfa).toBeLessThanOrEqual(envelope.permittedGfa);
  });

  it('calculates sellable output and units', () => {
    const envelope = calculateEnvelope(scenario, demoRegulationPack);
    const outputs = calculateOutputs(scenario, envelope);
    expect(outputs.sellableResidential).toBeGreaterThan(0);
    expect(outputs.units).toBeGreaterThan(0);
  });

  it('calculates parking and basement requirement', () => {
    const envelope = calculateEnvelope(scenario, demoRegulationPack);
    const outputs = calculateOutputs(scenario, envelope);
    const parking = calculateParking(scenario, demoRegulationPack, outputs);
    expect(parking.requiredSpaces).toBeGreaterThan(0);
    expect(parking.basementCountRequired).toBeGreaterThan(0);
  });

  it('calculates financial feasibility and ROI', () => {
    const result = runScenario(scenario, demoRegulationPack);
    const financial = calculateFinancial(scenario, result.outputs);
    expect(financial.totalCost).toBeGreaterThan(0);
    expect(financial.revenue).toBeGreaterThan(0);
    expect(financial.monthlyCashFlow).toHaveLength(18);
    expect(Number.isFinite(financial.roi)).toBe(true);
  });

  it('returns a decision for the scenario', () => {
    const result = runScenario(scenario, demoRegulationPack);
    expect(['PROCEED', 'PROCEED_WITH_CONDITIONS', 'RECONSIDER', 'NOT_RECOMMENDED']).toContain(result.decision.status);
  });

  it('uses active regulation snapshot setbacks dynamically from street width and caps FAR floor by floor', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.code === 'M111')!;
    const testScenario: Scenario = {
      ...scenario,
      regulationId: reg.id,
      plot: {
        ...scenario.plot,
        officialArea: 3000,
        length: 30,
        width: 100,
        boundaries: [
          { side: 'front', type: 'Street', width: 30 },
          { side: 'right', type: 'Neighbor' },
          { side: 'left', type: 'Neighbor' },
          { side: 'rear', type: 'Neighbor' }
        ]
      }
    };
    const result = runScenario(testScenario, reg);
    expect(result.envelope.setbacks.front).toBe(6);
    expect(result.envelope.coverageLimit).toBe(1800);
    expect(result.envelope.permittedGfa).toBe(3600);
    expect(result.envelope.achievedFar).toBeLessThanOrEqual(1.2);
  });

  it('uses the stricter of setback geometry and coverage for final footprint', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-DEVELOPED-CASE-3')!;
    const testScenario: Scenario = {
      ...scenario,
      regulationId: reg.id,
      plot: {
        ...scenario.plot,
        officialArea: 3000,
        length: 100,
        width: 30,
        boundaries: [
          { side: 'front', type: 'Street', width: 30, streetRole: 'main' },
          { side: 'right', type: 'Neighbor' },
          { side: 'left', type: 'Neighbor' },
          { side: 'rear', type: 'Neighbor' }
        ]
      }
    };
    const result = calculateEnvelope(testScenario, reg);
    expect(result.geometricFootprint).toBeGreaterThan(result.coverageLimit);
    expect(result.coverageLimit).toBe(1800);
    expect(result.finalFootprint).toBe(1800);
  });

  it('validates supplied user-reference setback and coverage rules', () => {
    const s111 = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-S111')!;
    const m111 = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M111')!;
    const m112 = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M112')!;
    const developedCase3 = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-DEVELOPED-CASE-3')!;
    const s231 = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-S231')!;
    const testScenario: Scenario = {
      ...scenario,
      plot: {
        ...scenario.plot,
        officialArea: 3000,
        length: 30,
        width: 100,
        boundaries: [
          { side: 'front', type: 'Street', width: 30 },
          { side: 'right', type: 'Street', width: 10, streetRole: 'secondary' },
          { side: 'left', type: 'Neighbor' },
          { side: 'rear', type: 'Neighbor' }
        ]
      }
    };
    expect(runScenario({ ...testScenario, regulationId: s111.id }, s111).envelope.setbacks.front).toBe(6);
    expect(runScenario({ ...testScenario, plot: { ...testScenario.plot, boundaries: [{ side: 'front', type: 'Street', width: 20 }, { side: 'right', type: 'Neighbor' }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] }, regulationId: m111.id }, m111).envelope.setbacks.front).toBe(4);
    const m111Thirty = runScenario({ ...testScenario, regulationId: m111.id }, m111);
    expect(m111Thirty.envelope.setbacks.front).toBe(6);
    expect(m111Thirty.envelope.permittedGfa).toBe(3600);
    expect(m111Thirty.envelope.floorAreas.find((row) => row.floor === 'roof annex')?.finalAllowedArea).toBeGreaterThan(0);
    expect(m111Thirty.envelope.achievedFar).toBeLessThanOrEqual(1.2);
    const m112Result = runScenario({ ...testScenario, plot: { ...testScenario.plot, boundaries: [{ side: 'front', type: 'Street', width: 20, streetRole: 'main' }, { side: 'right', type: 'Street', width: 10, streetRole: 'secondary' }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] }, regulationId: m112.id }, m112);
    expect(m112Result.envelope.setbacks.front).toBe(4);
    expect(m112Result.envelope.setbacks.right).toBe(2);
    const developed = runScenario({ ...testScenario, plot: { ...testScenario.plot, boundaries: [{ side: 'front', type: 'Street', width: 30, streetRole: 'main' }, { side: 'right', type: 'Street', width: 40, streetRole: 'secondary' }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] }, regulationId: developedCase3.id }, developedCase3);
    expect(developed.envelope.setbacks.right).toBe(6);
    const s231Result = runScenario({ ...testScenario, regulationId: s231.id }, s231);
    expect(s231Result.envelope.coverageLimit).toBe(3000);
    expect(s231Result.envelope.setbacks).toEqual({ front: 0, right: 0, left: 0, rear: 0 });
  });

  it('uses manual overrides without mutating the regulation pack', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-S111')!;
    const testScenario: Scenario = {
      ...scenario,
      regulationId: reg.id,
      plot: { ...scenario.plot, officialArea: 3000, length: 30, width: 100, boundaries: [{ side: 'front', type: 'Street', width: 30 }, { side: 'right', type: 'Neighbor' }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] },
      overrides: [{ id: 'manual-far', field: 'far', originalValue: 'null', usedValue: '2.4', source: 'USER_OVERRIDE', reason: 'حسب إفادة المشروع', createdAt: new Date().toISOString() }]
    };
    const result = runScenario(testScenario, reg);
    expect(result.envelope.permittedGfa).toBe(7200);
    expect(result.envelope.achievedFar).toBeLessThanOrEqual(2.4);
    expect(reg.far.value).toBeNull();
    expect(testScenario.overrides[0].field).toBe('far');
    expect(testScenario.overrides[0].source).toBe('USER_OVERRIDE');
  });

  it('keeps duplicated scenario financial and parking changes independent', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.code === 'M111')!;
    const base = {
      ...scenario,
      regulationId: reg.id,
      basementCount: 2,
      financial: { ...scenario.financial, sellingPriceResidential: 8000 }
    };
    const s02 = {
      ...structuredClone(base),
      id: 's02',
      basementCount: 3,
      financial: { ...base.financial, sellingPriceResidential: 8500 }
    };
    expect(base.basementCount).toBe(2);
    expect(base.financial.sellingPriceResidential).toBe(8000);
    expect(s02.basementCount).toBe(3);
    expect(s02.financial.sellingPriceResidential).toBe(8500);
    expect(runScenario(s02, reg).financial.revenue).toBeGreaterThan(runScenario(base, reg).financial.revenue);
  });

  it('derives FAR from floor coverage rules when explicit FAR is missing', () => {
    const reg = {
      ...demoRegulationPack,
      maxFloors: { ...demoRegulationPack.maxFloors, value: 3 },
      coverage: { ...demoRegulationPack.coverage, value: { ground: 0.6, first: 0.75, typical: 0.75, roof: null } },
      far: { ...demoRegulationPack.far, value: null, source: 'Not defined' },
      roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: null },
      floorAreaTypes: [{ floor: 'ground', countsTowardFAR: true }, { floor: 'first', countsTowardFAR: true }, { floor: 'typical', countsTowardFAR: true }, { floor: 'roof annex', countsTowardFAR: true }]
    };
    const result = calculateEnvelope(scenario, reg);
    expect(result.farSource).toBe('DERIVED_FROM_FLOOR_RULES');
    expect(result.permittedGfa).toBe(1890);
    expect(result.farHowCalculated).toContain('ground');
  });

  it('adds roof annex to derived FAR only when it counts toward FAR', () => {
    const baseReg = {
      ...demoRegulationPack,
      maxFloors: { ...demoRegulationPack.maxFloors, value: 3 },
      coverage: { ...demoRegulationPack.coverage, value: { ground: 0.6, first: 0.75, typical: 0.75, roof: null } },
      far: { ...demoRegulationPack.far, value: null, source: 'Not defined' },
      roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5 }
    };
    const roofCounts = calculateEnvelope(scenario, { ...baseReg, floorAreaTypes: [{ floor: 'ground', countsTowardFAR: true }, { floor: 'first', countsTowardFAR: true }, { floor: 'typical', countsTowardFAR: true }, { floor: 'roof annex', countsTowardFAR: true }] });
    const roofExcluded = calculateEnvelope(scenario, { ...baseReg, floorAreaTypes: [{ floor: 'ground', countsTowardFAR: true }, { floor: 'first', countsTowardFAR: true }, { floor: 'typical', countsTowardFAR: true }, { floor: 'roof annex', countsTowardFAR: false }] });
    expect(roofCounts.permittedGfa).toBe(2227.5);
    expect(roofExcluded.permittedGfa).toBe(1890);
  });

  it('prioritizes explicit FAR and respects NO_FAR', () => {
    const noExplicit = {
      ...demoRegulationPack,
      maxFloors: { ...demoRegulationPack.maxFloors, value: 3 },
      coverage: { ...demoRegulationPack.coverage, value: { ground: 0.6, first: 0.75, typical: 0.75, roof: null } },
      roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5 }
    };
    const explicit = calculateEnvelope(scenario, { ...noExplicit, far: { ...demoRegulationPack.far, value: 1.8, source: 'Explicit test' } });
    const noFar = calculateEnvelope(scenario, { ...noExplicit, far: { ...demoRegulationPack.far, value: null, source: 'NO_FAR' } });
    expect(explicit.farSource).toBe('EXPLICIT_REGULATION');
    expect(explicit.permittedGfa).toBe(1620);
    expect(noFar.farSource).toBe('NO_FAR');
    expect(noFar.permittedGfa).toBe(0);
    expect(noFar.farUtilization).toBe(0);
  });

  it('allows manual FAR override for NO_FAR scenario without mutating the pack', () => {
    const reg = { ...demoRegulationPack, far: { ...demoRegulationPack.far, value: null, source: 'NO_FAR' } };
    const edited = {
      ...scenario,
      overrides: [{ id: 'manual-no-far', field: 'far', originalValue: 'null', usedValue: '1.8', source: 'USER_OVERRIDE' as const, reason: 'Scenario cap', createdAt: new Date().toISOString() }]
    };
    const result = calculateEnvelope(edited, reg);
    expect(result.farSource).toBe('USER_OVERRIDE');
    expect(result.permittedGfa).toBe(1620);
    expect(reg.far.value).toBeNull();
    expect(reg.far.source).toBe('NO_FAR');
  });

  it('changes parking by development use without changing FAR', () => {
    const apartment = runScenario({ ...scenario, developmentUse: 'Residential Apartments' }, parkingReg);
    const retail = runScenario({ ...scenario, developmentUse: 'Retail', productMix: { ...scenario.productMix, residentialShare: 0, retailShare: 1, officeShare: 0 } }, parkingReg);
    expect(apartment.envelope.permittedGfa).toBe(retail.envelope.permittedGfa);
    expect(apartment.parking.requiredSpaces).not.toBe(retail.parking.requiredSpaces);
  });

  it('sums mixed-use parking demand per use', () => {
    const mixed = runScenario({ ...scenario, developmentUse: 'Residential + Retail', productMix: { ...scenario.productMix, residentialShare: 0.5, retailShare: 0.5, officeShare: 0 } }, parkingReg);
    const residentialOnly = runScenario({ ...scenario, developmentUse: 'Residential Apartments', productMix: { ...scenario.productMix, residentialShare: 0.5, retailShare: 0, officeShare: 0 } }, parkingReg);
    const retailOnly = runScenario({ ...scenario, developmentUse: 'Retail', productMix: { ...scenario.productMix, residentialShare: 0, retailShare: 0.5, officeShare: 0 } }, parkingReg);
    expect(mixed.parking.requiredSpaces).toBe(residentialOnly.parking.requiredSpaces + retailOnly.parking.requiredSpaces);
  });

  it('uses edited unit counts in parking demand', () => {
    const suggested = runScenario({ ...scenario, developmentUse: 'Residential Apartments' }, parkingReg);
    const edited = runScenario({
      ...scenario,
      developmentUse: 'Residential Apartments',
      overrides: [{ id: 'units', field: 'units', originalValue: String(suggested.outputs.units), usedValue: '10', source: 'USER_OVERRIDE', reason: 'Manual unit count', createdAt: new Date().toISOString() }]
    }, parkingReg);
    expect(edited.outputs.units).toBe(10);
    expect(edited.parking.requiredSpaces).toBe(10);
  });

  it('estimates street spaces but only counts explicitly confirmed parking', () => {
    const reg = parkingReg;
    const wideStreet = runScenario({
      ...scenario,
      plot: {
        ...scenario.plot,
        officialArea: 3000,
        length: 100,
        width: 30,
        boundaries: [
          { side: 'front', type: 'Street', width: 30 },
          { side: 'right', type: 'Neighbor' },
          { side: 'left', type: 'Neighbor' },
          { side: 'rear', type: 'Neighbor' }
        ]
      },
      overrides: [{ id: 'parking-demand', field: 'parking.requiredSpaces', originalValue: 'null', usedValue: '40', source: 'USER_OVERRIDE', reason: 'QA', createdAt: new Date().toISOString() }]
    }, reg);
    expect(wideStreet.parking.parkingLayout).toBe('ANGLED_45');
    expect(wideStreet.parking.autoSurfaceParking).toBe(10);
    expect(wideStreet.parking.surfaceParking).toBe(0);
    expect(wideStreet.parking.requiredSpaces).toBe(40);
    expect(wideStreet.parking.basementCountRequired).toBe(1);

    const narrowStreet = runScenario({
      ...scenario,
      plot: {
        ...scenario.plot,
        officialArea: 3000,
        length: 100,
        width: 30,
        boundaries: [
          { side: 'front', type: 'Street', width: 20 },
          { side: 'right', type: 'Neighbor' },
          { side: 'left', type: 'Neighbor' },
          { side: 'rear', type: 'Neighbor' }
        ]
      }
    }, reg);
    expect(narrowStreet.parking.parkingLayout).toBe('PERPENDICULAR');
    expect(narrowStreet.parking.autoSurfaceParking).toBe(10);

    const rotatedPlot = runScenario({
      ...scenario,
      plot: {
        ...scenario.plot,
        officialArea: 3000,
        length: 30,
        width: 100,
        boundaries: [
          { side: 'front', type: 'Street', width: 30 },
          { side: 'right', type: 'Neighbor' },
          { side: 'left', type: 'Neighbor' },
          { side: 'rear', type: 'Neighbor' }
        ]
      }
    }, reg);
    expect(rotatedPlot.parking.autoSurfaceParking).toBe(35);
  });
  it('does not introduce a second floor when the regulation allows only one', () => {
    const oneFloor = { ...demoRegulationPack, maxFloors: { ...demoRegulationPack.maxFloors, value: 1 } };
    const result = calculateEnvelope(scenario, oneFloor);
    expect(result.floorAreas.filter((f) => f.floor !== 'roof annex')).toHaveLength(1);
    expect(result.floorAreas[0].floor).toBe('ground');
  });

  it('enforces zero FAR without giving a free infinite building area', () => {
    const zero = { ...demoRegulationPack, far: { ...demoRegulationPack.far, value: 0 } };
    const result = calculateEnvelope(scenario, zero);
    expect(result.permittedGfa).toBe(0);
    expect(result.floorAreas.filter((f) => f.floor !== 'roof annex').every((f) => f.finalAllowedArea === 0)).toBe(true);
  });

  it('includes fixed soft costs and applies sale commissions to revenue', () => {
    const edited = { ...scenario, financial: { ...defaultFinancial, designCost: 45000, permitsCost: 15000 } };
    const a = runScenario(scenario, demoRegulationPack);
    const b = runScenario(edited, demoRegulationPack);
    expect(b.financial.totalCost - a.financial.totalCost).toBeCloseTo(60000, 1);
  });

  it('excludes unconfirmed surface spaces and counts confirmed ones', () => {
    const a = runScenario({ ...scenario, surfaceParking: undefined }, parkingReg).parking;
    const b = runScenario({ ...scenario, surfaceParking: 6 }, parkingReg).parking;
    expect(a.surfaceParking).toBe(0);
    expect(b.providedSpaces - a.providedSpaces).toBe(6);
    expect(a.autoSurfaceParking).toBeGreaterThan(0);
  });

});
