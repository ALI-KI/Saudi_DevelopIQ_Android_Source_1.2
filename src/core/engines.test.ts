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

const round2 = (n: number) => Number(n.toFixed(2));

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
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M111')!;
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
    expect(result.envelope.farSource).toBe('USER_OVERRIDE');
    expect(reg.far.value).toBe(1.2);
    expect(testScenario.overrides[0].field).toBe('far');
    expect(testScenario.overrides[0].source).toBe('USER_OVERRIDE');
  });

  it('keeps duplicated scenario financial and parking changes independent', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M111')!;
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

  it('lays out street parking by street width: perpendicular up to 25 m, 45 degrees from 30 m', () => {
    const plotWith = (length: number, width: number, street: number) => ({ ...scenario.plot, officialArea: 3000, length, width, boundaries: [
      { side: 'front' as const, type: 'Street' as const, width: street }, { side: 'right' as const, type: 'Neighbor' as const },
      { side: 'left' as const, type: 'Neighbor' as const }, { side: 'rear' as const, type: 'Neighbor' as const }] });
    const wide = runScenario({ ...scenario, plot: plotWith(100, 30, 30) }, parkingReg).parking;
    expect(wide.parkingLayout).toBe('ANGLED_45');
    expect(wide.autoSurfaceParking).toBe(7); // 30 m / (2.8 / sin 45) = 7.57
    const narrow = runScenario({ ...scenario, plot: plotWith(100, 30, 20) }, parkingReg).parking;
    expect(narrow.parkingLayout).toBe('PERPENDICULAR');
    expect(narrow.autoSurfaceParking).toBe(10); // 30 m / 2.8
    expect(runScenario({ ...scenario, plot: plotWith(100, 30, 15) }, parkingReg).parking.autoSurfaceParking).toBe(10);
    expect(runScenario({ ...scenario, plot: plotWith(100, 30, 12) }, parkingReg).parking.autoSurfaceParking).toBe(0);
    // Street spaces are counted in the supply before any basement.
    expect(narrow.surfaceParking).toBe(10);
  });

  it('counts every street side of a corner plot', () => {
    const corner = runScenario({ ...scenario, plot: { ...scenario.plot, officialArea: 900, length: 30, width: 30, boundaries: [
      { side: 'front', type: 'Street', width: 20 }, { side: 'right', type: 'Street', width: 15 }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] } }, parkingReg).parking;
    expect(corner.streetSides).toHaveLength(2);
    expect(corner.autoSurfaceParking).toBe(20);
    expect(runScenario({ ...scenario, streetParkingLostSpaces: 3, plot: { ...scenario.plot, boundaries: [{ side: 'front', type: 'Street', width: 20 }, { side: 'right', type: 'Street', width: 15 }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] } }, parkingReg).parking.autoSurfaceParking).toBe(17);
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

  it('lets a confirmed street count replace the estimate', () => {
    const a = runScenario({ ...scenario, surfaceParking: undefined }, parkingReg).parking;
    const b = runScenario({ ...scenario, surfaceParking: 6 }, parkingReg).parking;
    expect(a.surfaceParking).toBe(a.autoSurfaceParking);
    expect(b.surfaceParking).toBe(6);
  });

  it('requires one space per apartment up to 180 m2 and two above', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M112')!;
    const small = runScenario({ ...scenario, regulationId: reg.id, productMix: { ...defaultProductMix, residentialShare: 1, retailShare: 0, officeShare: 0, averageUnitArea: 150 } }, reg);
    expect(small.parking.requiredSpaces).toBe(small.outputs.units);
    const large = runScenario({ ...scenario, regulationId: reg.id, productMix: { ...defaultProductMix, residentialShare: 1, retailShare: 0, officeShare: 0, averageUnitArea: 200 } }, reg);
    expect(large.parking.requiredSpaces).toBe(large.outputs.units * 2);
    const mixed = runScenario({ ...scenario, regulationId: reg.id, productMix: { ...defaultProductMix, residentialShare: 1, retailShare: 0, officeShare: 0, averageUnitArea: 150, largeUnitShare: 0.5 } }, reg);
    expect(mixed.parking.requiredSpaces).toBe(Math.ceil(mixed.outputs.units * 1.5));
  });

  it('adds a basement only when street parking falls short', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M112')!;
    const mix = { ...defaultProductMix, residentialShare: 1, retailShare: 0, officeShare: 0, averageUnitArea: 150 };
    const enough = runScenario({ ...scenario, regulationId: reg.id, basementMode: 'AUTO', basementCount: 0, productMix: mix }, reg);
    expect(enough.parking.requiredSpaces).toBeLessThanOrEqual(enough.parking.surfaceParking);
    expect(enough.parking.providedBasements).toBe(0);
    expect(enough.outputs.basementArea).toBe(0);
    const short = runScenario({ ...scenario, regulationId: reg.id, basementMode: 'AUTO', basementCount: 0, productMix: { ...mix, averageUnitArea: 60 } }, reg);
    expect(short.parking.requiredSpaces).toBeGreaterThan(short.parking.surfaceParking);
    expect(short.parking.providedBasements).toBeGreaterThan(0);
    expect(short.parking.status).toBe('OK');
    expect(short.outputs.basementArea).toBeGreaterThan(0);
    expect(short.financial.constructionCost).toBeGreaterThan(enough.financial.constructionCost);
  });

  it('falls back to a square plot when dimensions are zero or missing', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M112')!;
    const zero = calculateEnvelope({ ...scenario, plot: { ...scenario.plot, officialArea: 900, length: 0, width: 0, accuracy: 'Area Only' } }, reg);
    const full = calculateEnvelope({ ...scenario, plot: { ...scenario.plot, officialArea: 900, length: 30, width: 30 } }, reg);
    expect(zero.achievedGfa).toBe(full.achievedGfa);
    expect(zero.achievedGfa).toBeGreaterThan(0);
  });

  it('treats a cleared manual FAR as no override', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M111')!;
    const cleared = calculateEnvelope({ ...scenario, overrides: [{ id: 'o', field: 'far', originalValue: '', usedValue: '0', source: 'USER_OVERRIDE', reason: '', createdAt: '' }] }, reg);
    expect(cleared.farSource).toBe('EXPLICIT_REGULATION');
    expect(cleared.achievedGfa).toBeGreaterThan(0);
  });

  it('limits the third floor to the front 30 m in the developed regulation', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-DEVELOPED-CASE-3')!;
    const deep = calculateEnvelope({ ...scenario, plot: { officialArea: 1800, length: 60, width: 30, accuracy: 'Exact', boundaries: [
      { side: 'front', type: 'Street', width: 36 }, { side: 'right', type: 'Neighbor' }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] } }, reg);
    const [ground, first, third] = deep.floorAreas;
    expect(ground.finalAllowedArea).toBe(1080); // 60% of the whole plot
    expect(first.finalAllowedArea).toBe(1350); // 75% of the whole plot
    expect(third.finalAllowedArea).toBe(624); // front band only: (30 - 6) x (30 - 2 - 2)
    expect(deep.farSource).toBe('NO_FAR');
    const shallow = calculateEnvelope({ ...scenario, plot: { officialArea: 900, length: 30, width: 30, accuracy: 'Exact', boundaries: [
      { side: 'front', type: 'Street', width: 36 }, { side: 'right', type: 'Neighbor' }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] } }, reg);
    expect(shallow.floorAreas.filter((f) => f.floor !== 'roof annex')).toHaveLength(3);
  });

  it('derives the floor count from FAR when the height is open', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-CENTRAL-SPINE-COMMERCIAL-DEPTH-70')!;
    const env = calculateEnvelope({ ...scenario, developmentUse: 'Office', plot: { officialArea: 3500, length: 70, width: 50, accuracy: 'Exact', boundaries: [
      { side: 'front', type: 'Street', width: 80, streetRole: 'kingFahd' }, { side: 'right', type: 'Neighbor' }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] } }, reg);
    expect(env.permittedGfa).toBe(10500); // FAR 3
    expect(env.floorAreas.length).toBe(9); // ceil(3 / 0.35)
    expect(env.achievedGfa).toBe(10500);
    expect(env.setbacks).toEqual({ front: 4, right: 3, left: 3, rear: 6 });
  });

  it('applies the corrected villa zone: FAR 1.2, 70% ground, annex outside FAR', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-S111')!;
    const env = calculateEnvelope({ ...scenario, developmentUse: 'Residential Villas', plot: { officialArea: 500, length: 25, width: 20, accuracy: 'Exact', boundaries: [
      { side: 'front', type: 'Street', width: 15 }, { side: 'right', type: 'Neighbor' }, { side: 'left', type: 'Neighbor' }, { side: 'rear', type: 'Neighbor' }] } }, reg);
    expect(env.permittedGfa).toBe(600);
    expect(env.floorAreas[0].finalAllowedArea).toBe(350); // 70% including annexes in setbacks
    expect(env.floorAreas[1].finalAllowedArea).toBe(250); // remainder of FAR 1.2
    expect(env.floorAreas[2].floor).toBe('roof annex');
    expect(env.floorAreas[2].finalAllowedArea).toBe(125);
    expect(env.achievedFar).toBe(1.2);
  });

  it('evaluates a rental scenario by yield on cost', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M112')!;
    const mix = { ...defaultProductMix, residentialShare: 1, retailShare: 0, officeShare: 0 };
    const rent = runScenario({ ...scenario, regulationId: reg.id, productMix: mix, financial: { ...defaultFinancial, mode: 'RENT', rentResidential: 500, occupancyPercent: 0.9, opexPercent: 0.2, capRate: 0.08 } }, reg);
    const gross = round2(rent.outputs.sellableResidential * 500 * 0.9);
    expect(rent.financial.mode).toBe('RENT');
    expect(rent.financial.annualGrossRent).toBeCloseTo(gross, 0);
    expect(rent.financial.annualNoi).toBeCloseTo(gross * 0.8, 0);
    expect(rent.financial.yieldOnCost).toBeCloseTo(rent.financial.annualNoi! / rent.financial.totalCost, 3);
    expect(rent.financial.exitValue).toBeCloseTo(rent.financial.annualNoi! / 0.08, 0);
    expect(rent.financial.paybackYears).toBeGreaterThan(0);
  });

  it('gives a real investment decision instead of a blanket provisional one', () => {
    const reg = userReferenceRegulationPacks.find((r) => r.id === 'RIYADH-M112')!;
    const mix = { ...defaultProductMix, residentialShare: 1, retailShare: 0, officeShare: 0 };
    const good = runScenario({ ...scenario, regulationId: reg.id, basementMode: 'AUTO', basementCount: 0, productMix: mix, financial: { ...defaultFinancial, landPrice: 1500, sellingPriceResidential: 9000 } }, reg);
    expect(good.decision.status).toBe('PROCEED');
    const bad = runScenario({ ...scenario, regulationId: reg.id, basementMode: 'AUTO', basementCount: 0, productMix: mix, financial: { ...defaultFinancial, landPrice: 9000, sellingPriceResidential: 4000 } }, reg);
    expect(bad.decision.status).toBe('NOT_RECOMMENDED');
    expect(good.regulationConfidence?.level).toBe('USER_SELECTED');
  });

  it('includes transaction tax and construction VAT when entered', () => {
    const base = runScenario(scenario, demoRegulationPack).financial;
    const taxed = runScenario({ ...scenario, financial: { ...defaultFinancial, rettPercent: 0.05, constructionVatPercent: 0.15 } }, demoRegulationPack).financial;
    expect(taxed.totalCost - base.totalCost).toBeCloseTo(base.landCost * 0.05 + base.constructionCost * 0.15, 0);
  });

});
