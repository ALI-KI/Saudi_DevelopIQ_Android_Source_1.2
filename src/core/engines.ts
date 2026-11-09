import {
  DecisionResult,
  DevelopmentEnvelope,
  DevelopmentOutputs,
  FarSourceType,
  FinancialInputs,
  FinancialResult,
  ParkingResult,
  ProjectUse,
  RegulationPack,
  Scenario,
  ScenarioResult
} from '../shared/types';
import { evidenceValid, isOfficiallyConfirmedForParcel } from './regulationSelection';

const round = (value: number, decimals = 2) => Number.isFinite(value) ? Number(value.toFixed(decimals)) : 0;
const sideWidth = (scenario: Scenario, side: 'front' | 'right' | 'left' | 'rear') => scenario.plot.boundaries.find((b) => b.side === side)?.width ?? 0;
const overrideNumber = (scenario: Scenario, field: string) => {
  const override = scenario.overrides.find((item) => item.field === field);
  if (!override) return null;
  const value = Number(override.usedValue);
  return Number.isFinite(value) ? value : null;
};
const profileRule = (scenario: Scenario, regulation: RegulationPack, side: 'front' | 'right' | 'left' | 'rear') => {
  const boundary = scenario.plot.boundaries.find((item) => item.side === side);
  const profiles = regulation.setbackProfiles;
  if (!boundary || !profiles) return undefined;
  if (boundary.type === 'Neighbor') return profiles.neighbor;
  if (boundary.type !== 'Street') return undefined;
  if (boundary.streetRole === 'kingFahd') return profiles.kingFahdRoad ?? profiles.mainStreet;
  if (boundary.streetRole === 'olaya') return profiles.olayaStreet ?? profiles.mainStreet;
  if (boundary.streetRole === 'commercial') return profiles.commercialStreet ?? profiles.mainStreet;
  if (boundary.streetRole === 'secondary' || side !== 'front') return profiles.secondaryStreet ?? profiles.mainStreet;
  return profiles.mainStreet;
};
const setbackValue = (scenario: Scenario, regulation: RegulationPack, side: 'front' | 'right' | 'left' | 'rear') => {
  const rule = profileRule(scenario, regulation, side) ?? regulation.setbacks.value[side];
  if (rule === null) return overrideNumber(scenario, `setback.${side}`);
  const value = typeof rule === 'number' ? rule : rule.type === 'fixed' ? rule.value : sideWidth(scenario, side) / rule.divisor;
  if (typeof rule !== 'number' && rule.type === 'streetWidthDivisor') return round(Math.min(rule.max ?? Number.POSITIVE_INFINITY, Math.max(rule.min ?? 0, value)));
  return round(value);
};
const countsTowardFar = (regulation: RegulationPack, floor: string) => {
  const normalized = floor.startsWith('typical') ? 'typical' : floor;
  return regulation.floorAreaTypes?.find((row) => row.floor === normalized || row.floor === floor)?.countsTowardFAR ?? true;
};
const floorCoverageForIndex = (coverage: { ground: number | null; first: number | null; typical: number | null }, index: number) => index === 0 ? coverage.ground : index === 1 ? coverage.first : coverage.typical;
const hasOpenRearZone = (regulation: RegulationPack) => Boolean(regulation.developmentZones?.some((zone) => zone.depth === null));
const deriveFarFromFloorRules = (regulation: RegulationPack, scenario: Scenario, maxFloorsValue: number | null, coverage: { ground: number | null; first: number | null; typical: number | null; roof: number | null }) => {
  if (maxFloorsValue === null) return null;
  const maxFloors = Math.max(1, maxFloorsValue);
  const parts: string[] = [];
  let value = 0;
  for (let index = 0; index < maxFloors; index += 1) {
    const floor = index === 0 ? 'ground' : index === 1 ? 'first' : `typical ${index - 1}`;
    const cov = floorCoverageForIndex(coverage, index);
    if (cov === null) return null;
    if (countsTowardFar(regulation, floor)) {
      value += cov;
      parts.push(`${floor}: ${round(cov, 3)}`);
    }
  }
  const roofAnnexPercent = regulation.roofAnnexPercent.value ?? overrideNumber(scenario, 'roofAnnexPercent');
  if (roofAnnexPercent !== null && countsTowardFar(regulation, 'roof annex')) {
    const baseCoverage = floorCoverageForIndex(coverage, maxFloors - 1);
    if (baseCoverage === null) return null;
    const roofContribution = baseCoverage * roofAnnexPercent;
    value += roofContribution;
    parts.push(`roof annex: ${round(baseCoverage, 3)} x ${round(roofAnnexPercent, 3)} = ${round(roofContribution, 3)}`);
  }
  return { value: round(value, 3), howCalculated: parts.join(' + ') };
};

export const calculateEnvelope = (scenario: Scenario, regulation: RegulationPack): DevelopmentEnvelope => {
  const plot = scenario.plot;
  const plotArea = plot.officialArea || 0;
  const calculatedArea = plot.length && plot.width ? plot.length * plot.width : undefined;
  const areaDifference = calculatedArea ? calculatedArea - plotArea : undefined;
  const setbacks = {
    front: setbackValue(scenario, regulation, 'front'),
    right: setbackValue(scenario, regulation, 'right'),
    left: setbackValue(scenario, regulation, 'left'),
    rear: setbackValue(scenario, regulation, 'rear')
  };
  const plotLength = plot.length ?? Math.sqrt(plotArea);
  const plotWidth = plot.width ?? Math.sqrt(plotArea);
  const missingRules: string[] = [];
  (['front', 'right', 'left', 'rear'] as const).forEach((side) => { if (setbacks[side] === null) missingRules.push(`${side} setback not defined`); });
  const buildableLength = Math.max(0, plotLength - (setbacks.front ?? 0) - (setbacks.rear ?? 0));
  const buildableWidth = Math.max(0, plotWidth - (setbacks.left ?? 0) - (setbacks.right ?? 0));
  const coverage = {
    ground: regulation.coverage.value.ground ?? overrideNumber(scenario, 'coverage.ground'),
    first: regulation.coverage.value.first ?? overrideNumber(scenario, 'coverage.first'),
    typical: regulation.coverage.value.typical ?? overrideNumber(scenario, 'coverage.typical'),
    roof: regulation.coverage.value.roof ?? overrideNumber(scenario, 'coverage.roof')
  };
  const depth = regulation.developmentDepth?.value ?? overrideNumber(scenario, 'developmentDepth');
  const appliesSingleDepthCap = Boolean(depth && !hasOpenRearZone(regulation));
  const effectiveBuildableLength = appliesSingleDepthCap ? Math.min(buildableLength, depth ?? buildableLength) : buildableLength;
  const effectiveGeometricFootprint = round(effectiveBuildableLength * buildableWidth);
  const coverageLimit = coverage.ground === null ? effectiveGeometricFootprint : round(plotArea * coverage.ground);
  const rawNoFar = regulation.far.source === 'NO_FAR';
  const maxFloorsValue = regulation.maxFloors.value ?? overrideNumber(scenario, 'maxFloors');
  if (maxFloorsValue === null) missingRules.push('Maximum floors not defined');
  const maxFloors = Math.max(1, maxFloorsValue ?? 1);
  const manualFar = overrideNumber(scenario, 'far');
  const noFar = rawNoFar && manualFar === null;
  const derivedFar = rawNoFar || regulation.far.value !== null || manualFar !== null ? null : deriveFarFromFloorRules(regulation, scenario, maxFloorsValue, coverage);
  const farValue = noFar ? null : regulation.far.value ?? manualFar ?? derivedFar?.value ?? null;
  const farSource: FarSourceType = noFar ? 'NO_FAR' : regulation.far.value !== null ? 'EXPLICIT_REGULATION' : manualFar !== null ? 'USER_OVERRIDE' : derivedFar ? 'DERIVED_FROM_FLOOR_RULES' : 'NOT_DEFINED';
  if (farValue === null && !noFar) missingRules.push('FAR not defined');
  const permittedGfa = farValue ? round(plotArea * farValue) : 0;
  const farHowCalculated = farSource === 'DERIVED_FROM_FLOOR_RULES' ? derivedFar?.howCalculated ?? '' : farSource === 'EXPLICIT_REGULATION' ? `Explicit FAR from regulation pack: ${farValue}` : farSource === 'USER_OVERRIDE' ? `Manual FAR override: ${farValue}` : farSource === 'NO_FAR' ? 'لا يوجد معامل بناء / NO_FAR' : 'Not Defined';
  const floorKeys = Array.from({ length: maxFloors }, (_, i) => i === 0 ? 'ground' : i === 1 ? 'first' : `typical ${i - 1}`);
  let farRemaining = farValue === null ? Number.POSITIVE_INFINITY : permittedGfa;
  const regulatoryViolations: string[] = [];
  const floorAreas = floorKeys.map((floor, index) => {
    const cov = index === 0 ? coverage.ground : index === 1 ? coverage.first : coverage.typical;
    if (cov === null) missingRules.push(`${floor} coverage not defined`);
    const covLimit = cov === null ? effectiveGeometricFootprint : round(plotArea * cov);
    const farBudget = !noFar && countsTowardFar(regulation, floor) ? farRemaining : Number.POSITIVE_INFINITY;
    const finalAllowedArea = round(Math.min(effectiveGeometricFootprint, covLimit, farBudget));
    if (countsTowardFar(regulation, floor)) farRemaining = Math.max(0, farRemaining - finalAllowedArea);
    return {
      floor,
      coverageLimit: covLimit,
      geometryLimit: effectiveGeometricFootprint,
      zoneLimit: effectiveGeometricFootprint,
      farLimit: Number.isFinite(farBudget) ? round(farBudget) : finalAllowedArea,
      finalAllowedArea
    };
  });
  const roofCountsTowardFar = countsTowardFar(regulation, 'roof annex');
  const roofAnnexPercent = regulation.roofAnnexPercent.value ?? overrideNumber(scenario, 'roofAnnexPercent');
  if (roofAnnexPercent === null) missingRules.push('Roof annex percent not defined');
  const roofCoverageLimit = coverage.roof === null ? Number.POSITIVE_INFINITY : plotArea * coverage.roof;
  const roofAnnexArea = roofAnnexPercent === null ? 0 : round(Math.min(roofCoverageLimit, (floorAreas.at(-1)?.finalAllowedArea ?? 0) * roofAnnexPercent, !noFar && roofCountsTowardFar ? farRemaining : Number.POSITIVE_INFINITY));
  if (roofAnnexArea > 0) {
    floorAreas.push({
      floor: 'roof annex',
      coverageLimit: Number.isFinite(roofCoverageLimit) ? round(roofCoverageLimit) : roofAnnexArea,
      geometryLimit: effectiveGeometricFootprint,
      zoneLimit: effectiveGeometricFootprint,
      farLimit: !noFar && roofCountsTowardFar ? round(farRemaining) : roofAnnexArea,
      finalAllowedArea: roofAnnexArea
    });
    if (!noFar && roofCountsTowardFar) farRemaining = Math.max(0, farRemaining - roofAnnexArea);
  }
  const achievedGfa = round(floorAreas.reduce((sum, row) => sum + row.finalAllowedArea, 0));
  const farCountedArea = round(floorAreas.reduce((sum, row) => sum + (countsTowardFar(regulation, row.floor) ? row.finalAllowedArea : 0), 0));
  if (!noFar && permittedGfa && farCountedArea > permittedGfa) regulatoryViolations.push('Regulatory Violation: FAR exceeded');
  const finalFootprint = floorAreas[0]?.finalAllowedArea ?? 0;
  const constraints = [
    { key: 'Geometry', value: effectiveGeometricFootprint },
    { key: 'Coverage', value: coverageLimit },
    { key: 'FAR', value: noFar || !permittedGfa ? Number.POSITIVE_INFINITY : permittedGfa / Math.max(1, maxFloors) }
  ].sort((a, b) => a.value - b.value);
  const warnings = [];
  if (regulation.verificationStatus === 'DEMO_ONLY') warnings.push('Demo data - not regulatory / بيانات تجريبية - ليست اشتراطات رسمية');
  if (regulation.verificationStatus === 'USER_REFERENCE') warnings.push('USER_REFERENCE regulation - verify source before reliance');
  if (plot.accuracy === 'Area Only') warnings.push('Setbacks and buildable envelope cannot be accurately verified without plot dimensions');
  if (areaDifference && Math.abs(areaDifference) > 1) warnings.push('Difference between calculated and official plot area');
  warnings.push(...Array.from(new Set(missingRules)));
  return {
    calculatedArea,
    areaDifference: areaDifference ? round(areaDifference) : undefined,
    plotArea,
    plotLength,
    plotWidth,
    geometricFootprint: effectiveGeometricFootprint,
    coverageLimit,
    finalFootprint,
    permittedGfa,
    achievedGfa,
    unusedGfa: permittedGfa ? round(Math.max(0, permittedGfa - farCountedArea)) : 0,
    achievedFar: noFar ? 0 : round(farCountedArea / Math.max(1, plotArea)),
    farUtilization: permittedGfa ? round(farCountedArea / permittedGfa) : 0,
    farSource,
    farHowCalculated,
    floorAreas,
    controllingConstraint: constraints[0]?.key ?? 'Regulation',
    warnings
    ,setbacks,
    regulatoryViolations
  };
};

export const calculateOutputs = (scenario: Scenario, envelope: DevelopmentEnvelope): DevelopmentOutputs => {
  const mix = scenario.productMix;
  const gfa = envelope.achievedGfa;
  const mixTotal = Math.max(0, mix.residentialShare) + Math.max(0, mix.retailShare) + Math.max(0, mix.officeShare);
  const mixFactor = mixTotal > 1 ? 1 / mixTotal : 1;
  const residentialGfa = gfa * Math.max(0, mix.residentialShare) * mixFactor;
  const retailGfa = gfa * Math.max(0, mix.retailShare) * mixFactor;
  const officeGfa = gfa * Math.max(0, mix.officeShare) * mixFactor;
  const sellableResidential = round(residentialGfa * scenario.financial.sellableEfficiencyResidential);
  const sellableRetail = round(retailGfa * scenario.financial.sellableEfficiencyRetail);
  const sellableOffice = round(officeGfa * scenario.financial.sellableEfficiencyOffice);
  const suggestedUnits = scenario.plot.officialArea && scenario.regulationId && mix.averageUnitArea > 0
    ? Math.floor(sellableResidential / mix.averageUnitArea)
    : 0;
  const suggestedVillas = Math.floor(scenario.plot.officialArea / Math.max(1, mix.averageVillaPlotArea));
  const units = Math.max(0, Math.floor(overrideNumber(scenario, 'units') ?? suggestedUnits));
  const villas = Math.max(0, Math.floor(overrideNumber(scenario, 'villas') ?? suggestedVillas));
  return {
    footprint: envelope.finalFootprint,
    groundFloorArea: envelope.floorAreas[0]?.finalAllowedArea ?? 0,
    firstFloorArea: envelope.floorAreas[1]?.finalAllowedArea ?? 0,
    typicalFloorArea: round(envelope.floorAreas.filter((f) => f.floor.startsWith('typical')).reduce((s, f) => s + f.finalAllowedArea, 0)),
    roofAnnexArea: envelope.floorAreas.find((f) => f.floor === 'roof annex')?.finalAllowedArea ?? 0,
    aboveGroundBuiltUpArea: gfa,
    gfa,
    basementArea: round(envelope.finalFootprint * scenario.basementCount),
    sellableResidential,
    sellableRetail,
    sellableOffice,
    units,
    villas
  };
};

export const calculateParking = (scenario: Scenario, regulation: RegulationPack, outputs: DevelopmentOutputs): ParkingResult => {
  const rules = regulation.parking.value;
  const efficiency = scenario.parkingEfficiencySqmPerSpace ?? 30;
  const spacesPerBasement = Math.max(1, Math.floor(outputs.footprint / Math.max(1, efficiency)));
  const frontBoundary = scenario.plot.boundaries.find((boundary) => boundary.side === 'front' && boundary.type === 'Street');
  // Plot width denotes the street-facing frontage in the rectangular-plot input model.
  const frontage = scenario.plot.width ?? 0;
  const parkingLayout = !frontBoundary?.width ? 'NOT_APPLICABLE' : frontBoundary.width >= 30 ? 'ANGLED_45' : 'PERPENDICULAR';
  const autoSurfaceParking = parkingLayout === 'NOT_APPLICABLE' ? 0 : Math.max(0, Math.floor(frontage / 2.8));
  const developmentUse = scenario.developmentUse;
  const residentialApartmentsRule = rules.find((r) => r.use === 'Residential Apartments');
  const residentialVillasRule = rules.find((r) => r.use === 'Residential Villas');
  const retailRule = rules.find((r) => r.use === 'Retail');
  const officeRule = rules.find((r) => r.use === 'Office');
  const manualRequiredSpaces = overrideNumber(scenario, 'parking.requiredSpaces');
  const demandForUse = (use: ProjectUse | 'Retail') => {
    if (use === 'Residential Villas') return residentialVillasRule ? outputs.villas * residentialVillasRule.ratio : null;
    if (use === 'Residential Apartments') return residentialApartmentsRule ? outputs.units * residentialApartmentsRule.ratio : null;
    if (use === 'Retail' || use === 'Commercial') return retailRule ? (outputs.sellableRetail / 100) * retailRule.ratio : null;
    if (use === 'Office') return officeRule ? (outputs.sellableOffice / 100) * officeRule.ratio : null;
    if (use === 'Residential + Retail') {
      const residential = residentialApartmentsRule ? outputs.units * residentialApartmentsRule.ratio : null;
      const retail = retailRule ? (outputs.sellableRetail / 100) * retailRule.ratio : null;
      return residential === null || retail === null ? null : residential + retail;
    }
    if (use === 'Retail + Office') {
      const retail = retailRule ? (outputs.sellableRetail / 100) * retailRule.ratio : null;
      const office = officeRule ? (outputs.sellableOffice / 100) * officeRule.ratio : null;
      return retail === null || office === null ? null : retail + office;
    }
    return null;
  };
  const calculatedDemand = developmentUse ? demandForUse(developmentUse) : null;
  const requiredSpaces = manualRequiredSpaces ?? (calculatedDemand === null ? 0 : Math.ceil(calculatedDemand));
  const hasParkingRule = rules.length > 0 || manualRequiredSpaces !== null;
  const canCalculateParking = manualRequiredSpaces !== null || Boolean(developmentUse && calculatedDemand !== null);
  // Street parking estimate is NOT an entitlement. Count it only after explicit user confirmation.
  const surfaceParking = Math.max(0, scenario.surfaceParking ?? 0);
  const basementCountRequired = Math.ceil(Math.max(0, requiredSpaces - surfaceParking) / spacesPerBasement);
  const providedSpaces = surfaceParking + scenario.basementCount * spacesPerBasement;
  const balance = providedSpaces - requiredSpaces;
  const warnings = regulation.verificationStatus === 'VERIFIED' ? [] : ['Parking estimate based on assumption / المواقف تعتمد على قيمة استرشادية'];
  if (scenario.surfaceParking === undefined && autoSurfaceParking > 0) warnings.push('Street parking is an unverified estimate and is excluded from supply until confirmed / المواقف السطحية التقديرية غير محتسبة إلا بعد التأكيد');
  return {
    requiredSpaces: hasParkingRule && canCalculateParking ? requiredSpaces : 0,
    autoSurfaceParking,
    surfaceParkingMode: scenario.surfaceParking === undefined ? 'AUTO' : 'MANUAL',
    parkingLayout,
    spacesPerBasement,
    basementCountRequired,
    providedBasements: scenario.basementCount,
    surfaceParking,
    providedSpaces,
    balance: hasParkingRule && canCalculateParking ? balance : 0,
    effectiveCapacityRatio: hasParkingRule && requiredSpaces ? round(Math.min(1, providedSpaces / requiredSpaces)) : 1,
    status: hasParkingRule && canCalculateParking ? providedSpaces >= requiredSpaces ? 'OK' : 'SHORTAGE' : 'ASSUMPTION',
    warnings: manualRequiredSpaces !== null ? [...warnings, 'Parking required spaces entered manually'] : !developmentUse ? [...warnings, 'Development use not defined for parking demand'] : hasParkingRule && calculatedDemand !== null ? warnings : [...warnings, 'Parking rule not defined for selected development use']
  };
};

const calculateIrr = (cashFlows: number[]) => {
  let rate = 0.1;
  for (let i = 0; i < 40; i += 1) {
    const npv = cashFlows.reduce((sum, cf, index) => sum + cf / Math.pow(1 + rate, index), 0);
    const derivative = cashFlows.reduce((sum, cf, index) => index === 0 ? sum : sum - (index * cf) / Math.pow(1 + rate, index + 1), 0);
    if (Math.abs(derivative) < 1e-8) return null;
    rate -= npv / derivative;
    if (!Number.isFinite(rate) || rate <= -0.99) return null;
  }
  return rate;
};

export const calculateFinancial = (scenario: Scenario, outputs: DevelopmentOutputs): FinancialResult => {
  const f: FinancialInputs = scenario.financial;
  const landCost = round(scenario.plot.officialArea * f.landPrice);
  const constructionRate = f.structuralRate + f.finishingRate + f.mepRate;
  const constructionCost = round(outputs.gfa * constructionRate + outputs.basementArea * f.basementRate);
  const directCost = landCost + constructionCost;
  const revenue = round(
    outputs.sellableResidential * f.sellingPriceResidential +
    outputs.sellableRetail * f.sellingPriceRetail +
    outputs.sellableOffice * f.sellingPriceOffice
  );
  const acquisitionCost = round(landCost * (f.brokeragePercent ?? 0) + (f.otherAcquisitionCost ?? 0));
  const fixedSoftCosts = (f.designCost ?? 0) + (f.consultancyCost ?? 0) + (f.supervisionCost ?? 0) +
    (f.permitsCost ?? 0) + (f.adminCost ?? 0) + (f.externalWorksCost ?? 0);
  const softCosts = round(acquisitionCost + fixedSoftCosts + constructionCost * f.contingencyPercent +
    revenue * (f.marketingPercent + f.salesCommissionPercent));
  const totalCost = round(directCost + softCosts);
  const profit = round(revenue - totalCost);
  const months = 18;
  let cumulative = 0;
  const monthlyCashFlow = Array.from({ length: months }, (_, index) => {
    const month = index + 1;
    const cost = round(index === 0 ? landCost : (constructionCost + softCosts) / (months - 1));
    const revenueMonth = round(index < 6 ? 0 : revenue / (months - 6));
    const net = round(revenueMonth - cost);
    cumulative = round(cumulative + net);
    return { month, cost, revenue: revenueMonth, net, cumulative };
  });
  const cashFlows = monthlyCashFlow.map((r) => r.net);
  return {
    landCost,
    constructionCost,
    softCosts,
    totalCost,
    revenue,
    profit,
    profitMargin: revenue ? round(profit / revenue) : 0,
    roi: totalCost ? round(profit / totalCost) : 0,
    monthlyCashFlow,
    peakFunding: round(Math.abs(Math.min(...monthlyCashFlow.map((r) => r.cumulative), 0))),
    breakEvenMonth: monthlyCashFlow.find((r) => r.cumulative >= 0)?.month ?? null,
    irr: (() => { const monthly = calculateIrr(cashFlows); return monthly === null ? null : Math.pow(1 + monthly, 12) - 1; })(),
    npv: round(cashFlows.reduce((sum, cf, index) => sum + cf / Math.pow(1.1, index / 12), 0))
  };
};

export const decide = (financial: FinancialResult, parking: ParkingResult, envelope: DevelopmentEnvelope): DecisionResult => {
  if (envelope.regulatoryViolations.length) {
    return { status: 'NOT_RECOMMENDED', label: { ar: 'مخالفة تنظيمية', en: 'REGULATORY VIOLATION' }, reasons: envelope.regulatoryViolations.map((reason) => ({ ar: reason, en: reason })) };
  }
  if (parking.status === 'SHORTAGE') {
    return { status: 'RECONSIDER', label: { ar: 'إعادة الدراسة', en: 'RECONSIDER' }, reasons: [{ ar: 'عجز المواقف يؤثر على قابلية التطوير العملية.', en: 'Parking shortfall reduces practical development capacity.' }] };
  }
  if (financial.roi >= 0.18 && parking.status === 'OK' && envelope.warnings.length === 0) {
    return { status: 'PROCEED', label: { ar: 'المضي بالمشروع', en: 'PROCEED' }, reasons: [{ ar: 'العائد والمواقف ضمن نطاق مقبول.', en: 'Return and parking are within acceptable range.' }] };
  }
  if (financial.roi >= 0.1 && parking.status === 'OK') {
    return { status: 'PROCEED_WITH_CONDITIONS', label: { ar: 'المضي بشروط', en: 'PROCEED WITH CONDITIONS' }, reasons: [{ ar: 'النتيجة إيجابية لكنها تتطلب تأكيد الافتراضات.', en: 'Positive result but assumptions need confirmation.' }] };
  }
  if (financial.roi >= 0) {
    return { status: 'RECONSIDER', label: { ar: 'إعادة الدراسة', en: 'RECONSIDER' }, reasons: [{ ar: 'العائد محدود أو توجد قيود تطويرية.', en: 'Return is limited or development constraints exist.' }] };
  }
  return { status: 'NOT_RECOMMENDED', label: { ar: 'غير موصى به', en: 'NOT RECOMMENDED' }, reasons: [{ ar: 'النتيجة المالية سالبة في السيناريو الحالي.', en: 'The current scenario is financially negative.' }] };
};

export const runScenario = (scenario: Scenario, regulation: RegulationPack): ScenarioResult => {
  const envelope = calculateEnvelope(scenario, regulation);
  const outputs = calculateOutputs(scenario, envelope);
  const parking = calculateParking(scenario, regulation, outputs);
  const financial = calculateFinancial(scenario, outputs);
  const mix = scenario.productMix;
  const mixTotal = mix.residentialShare + mix.retailShare + mix.officeShare;
  const mixInvalid = Math.abs(mixTotal - 1) > 0.001 || [mix.residentialShare, mix.retailShare, mix.officeShare].some((v) => v < 0 || v > 1);
  if (mixInvalid) envelope.warnings.push('Product mix shares must total 100% / مجموع نسب الاستخدامات يجب أن يساوي 100%');
  let decision: DecisionResult = mixInvalid ? { status: 'RECONSIDER' as const, label: { ar: 'راجع نسب الاستخدامات', en: 'CHECK PRODUCT MIX' }, reasons: [{ ar: 'يجب ضبط مجموع نسب الاستخدامات إلى 100% قبل اتخاذ قرار الاستثمار.', en: 'Product mix must total 100% before relying on the investment decision.' }] } : decide(financial, parking, envelope);
  if (!evidenceValid(scenario,regulation)) {
    decision = { status:'RECONSIDER',label:{ar:'انطباق نظام البناء غير موثق',en:'REGULATION NOT ESTABLISHED'},reasons:[{ar:'يلزم تحديد الأرض وربط النظام بدليل انطباق على القطعة قبل اتخاذ قرار الاستثمار.',en:'Parcel-specific regulation applicability evidence is required before an investment decision.'}] };
    envelope.warnings.push('Regulation applicability unverified for this parcel / لم يثبت انطباق نظام البناء على القطعة');
  } else if (!isOfficiallyConfirmedForParcel(scenario,regulation)) {
    decision = { status:'RECONSIDER',label:{ar:'دراسة مبدئية — يلزم تحقق رسمي',en:'PROVISIONAL - AUTHORITY CONFIRMATION REQUIRED'},reasons:[{ar:'تم توثيق سبب اختيار النظام من المستخدم فقط. لم يتحقق التطبيق من جهة رسمية من انطباقه على الأرض.',en:'The user documented the choice; official parcel applicability was not independently verified.'}] };
    envelope.warnings.push('Documented by user only; official applicability not confirmed / توثيق مستخدم وليس تحققًا رسميًا');
  }
  const insights = [
    parking.status === 'SHORTAGE' ? 'Parking is the controlling development constraint' : `${envelope.unusedGfa} m2 of permitted GFA remains unused`,
    financial.profit < 0 ? 'Revenue does not cover development cost in this scenario' : `Estimated profit is ${financial.profit.toLocaleString()} SAR`
  ];
  return { envelope, outputs, parking, financial, decision, insights };
};

export const createScenarioComparison = (scenarios: Scenario[], regulations: RegulationPack[]) => scenarios.map((scenario) => {
  const regulation = regulations.find((r) => r.id === scenario.regulationId);
  return { scenario, result: regulation ? runScenario(scenario, regulation) : null };
});
