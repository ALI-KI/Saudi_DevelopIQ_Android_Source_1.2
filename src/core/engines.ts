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
  ScenarioResult,
  StreetParkingSide
} from '../shared/types';
import { regulationConfidence } from './regulationSelection';

const round = (value: number, decimals = 2) => Number.isFinite(value) ? Number(value.toFixed(decimals)) : 0;
const sideWidth = (scenario: Scenario, side: 'front' | 'right' | 'left' | 'rear') => scenario.plot.boundaries.find((b) => b.side === side)?.width ?? 0;
const overrideNumber = (scenario: Scenario, field: string) => {
  const override = scenario.overrides.find((item) => item.field === field);
  if (!override) return null;
  const value = Number(override.usedValue);
  return Number.isFinite(value) ? value : null;
};
/** Plot dimensions with a safe fallback: a missing or zero side is derived from the area. */
export const plotDimensions = (plot: Scenario['plot']) => {
  const area = plot.officialArea || 0;
  let length = plot.length && plot.length > 0 ? plot.length : 0;
  let width = plot.width && plot.width > 0 ? plot.width : 0;
  if (!length && !width) { length = Math.sqrt(area); width = Math.sqrt(area); }
  else if (!length) length = area / width;
  else if (!width) width = area / length;
  return { length, width };
};
const profileRule = (scenario: Scenario, regulation: RegulationPack, side: 'front' | 'right' | 'left' | 'rear') => {
  const boundary = scenario.plot.boundaries.find((item) => item.side === side);
  const profiles = regulation.setbackProfiles;
  if (!boundary || !profiles) return undefined;
  if (boundary.type === 'Neighbor') return side === 'rear' ? profiles.rearNeighbor ?? profiles.neighbor : profiles.neighbor;
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
  const { length: plotLength, width: plotWidth } = plotDimensions(plot);
  const missingRules: string[] = [];
  const notes: string[] = [];
  (['front', 'right', 'left', 'rear'] as const).forEach((side) => { if (setbacks[side] === null) missingRules.push(`${side} setback not defined`); });
  const frontSetback = setbacks.front ?? 0;
  const rearSetback = setbacks.rear ?? 0;
  const buildableWidth = Math.max(0, plotWidth - (setbacks.left ?? 0) - (setbacks.right ?? 0));
  const coverage = {
    ground: regulation.coverage.value.ground ?? overrideNumber(scenario, 'coverage.ground'),
    first: regulation.coverage.value.first ?? overrideNumber(scenario, 'coverage.first'),
    typical: regulation.coverage.value.typical ?? overrideNumber(scenario, 'coverage.typical'),
    roof: regulation.coverage.value.roof ?? overrideNumber(scenario, 'coverage.roof')
  };
  const rawNoFar = regulation.far.source === 'NO_FAR';
  const manualFarRaw = overrideNumber(scenario, 'far');
  // A cleared or zero manual field means "no override", never "zero building area".
  const manualFar = manualFarRaw !== null && manualFarRaw > 0 ? manualFarRaw : null;
  const noFar = rawNoFar && manualFar === null;
  let maxFloorsValue = regulation.maxFloors.value ?? overrideNumber(scenario, 'maxFloors');
  const explicitFar = manualFar ?? regulation.far.value;
  if (maxFloorsValue === null && explicitFar !== null && explicitFar > 0) {
    // Open height: the FAR is what limits the building, so the floor count follows from it.
    const typicalCoverage = coverage.typical ?? coverage.first ?? coverage.ground;
    if (typicalCoverage && typicalCoverage > 0) {
      maxFloorsValue = Math.min(60, Math.ceil(explicitFar / typicalCoverage));
      notes.push(`Open height: ${maxFloorsValue} floors estimated from FAR / coverage — الارتفاع مفتوح: عدد الأدوار مقدّر من المعامل ÷ التغطية`);
    }
  }
  if (maxFloorsValue === null) missingRules.push('Maximum floors not defined');
  const maxFloors = Math.max(1, maxFloorsValue ?? 1);

  // Depth bands measured from the front property line. Each band has its own floor limit.
  const depthCap = regulation.developmentDepth?.value ?? overrideNumber(scenario, 'developmentDepth');
  const bands: { from: number; to: number; floors: number }[] = [];
  const zones = regulation.developmentZones ?? [];
  if (zones.length) {
    let cursor = 0;
    for (const zone of zones) {
      const to = zone.depth === null ? plotLength : Math.min(plotLength, cursor + zone.depth);
      if (zone.floors === null && to > cursor) notes.push(`${zone.name}: governed by another regulation and not counted — باقي العمق يخضع لنظام آخر وغير محسوب`);
      if (to > cursor) bands.push({ from: cursor, to, floors: Math.min(maxFloors, zone.floors ?? 0) });
      cursor = to;
    }
  } else {
    bands.push({ from: 0, to: depthCap ? Math.min(plotLength, depthCap) : plotLength, floors: maxFloors });
  }
  const buildFrom = frontSetback;
  const buildTo = Math.max(buildFrom, plotLength - rearSetback);
  const overlap = (band: { from: number; to: number }) => Math.max(0, Math.min(band.to, buildTo) - Math.max(band.from, buildFrom));
  const activeBands = (index: number) => bands.filter((band) => band.floors > index);
  const geometryAt = (index: number) => round(activeBands(index).reduce((sum, band) => sum + overlap(band), 0) * buildableWidth);
  const landShareAt = (index: number) => plotLength > 0 ? Math.min(1, activeBands(index).reduce((sum, band) => sum + (band.to - band.from), 0) / plotLength) : 0;
  const floorCount = Math.max(1, Math.min(maxFloors, Math.max(0, ...bands.map((band) => band.floors))));

  const effectiveGeometricFootprint = geometryAt(0);
  const coverageLimit = coverage.ground === null ? effectiveGeometricFootprint : round(plotArea * coverage.ground * landShareAt(0));
  const derivedFar = rawNoFar || explicitFar !== null ? null : deriveFarFromFloorRules(regulation, scenario, maxFloorsValue, coverage);
  const farValue = noFar ? null : explicitFar ?? derivedFar?.value ?? null;
  const farSource: FarSourceType = noFar ? 'NO_FAR' : manualFar !== null ? 'USER_OVERRIDE' : regulation.far.value !== null ? 'EXPLICIT_REGULATION' : derivedFar ? 'DERIVED_FROM_FLOOR_RULES' : 'NOT_DEFINED';
  if (farValue === null && !noFar) missingRules.push('FAR not defined');
  const permittedGfa = farValue ? round(plotArea * farValue) : 0;
  const farHowCalculated = farSource === 'DERIVED_FROM_FLOOR_RULES' ? derivedFar?.howCalculated ?? '' : farSource === 'EXPLICIT_REGULATION' ? `Explicit FAR from regulation pack: ${farValue}` : farSource === 'USER_OVERRIDE' ? `Manual FAR override: ${farValue}` : farSource === 'NO_FAR' ? 'لا يوجد معامل بناء / NO_FAR' : 'Not Defined';
  const floorKeys = Array.from({ length: floorCount }, (_, i) => i === 0 ? 'ground' : i === 1 ? 'first' : `typical ${i - 1}`);
  let farRemaining = farValue === null ? Number.POSITIVE_INFINITY : permittedGfa;
  const regulatoryViolations: string[] = [];
  const floorAreas = floorKeys.map((floor, index) => {
    const cov = index === 0 ? coverage.ground : index === 1 ? coverage.first : coverage.typical;
    if (cov === null) missingRules.push(`${floor} coverage not defined`);
    const geometry = geometryAt(index);
    const covLimit = cov === null ? geometry : round(plotArea * cov * landShareAt(index));
    // Villa rule: ground coverage already includes annexes built inside the setbacks.
    const geometryLimit = index === 0 && regulation.groundCoverageIncludesSetbackAnnexes && cov !== null ? covLimit : geometry;
    const farBudget = !noFar && countsTowardFar(regulation, floor) ? farRemaining : Number.POSITIVE_INFINITY;
    const finalAllowedArea = round(Math.min(geometryLimit, covLimit, farBudget));
    if (countsTowardFar(regulation, floor)) farRemaining = Math.max(0, farRemaining - finalAllowedArea);
    return {
      floor,
      coverageLimit: covLimit,
      geometryLimit,
      zoneLimit: geometry,
      farLimit: Number.isFinite(farBudget) ? round(farBudget) : finalAllowedArea,
      finalAllowedArea
    };
  });
  const roofCountsTowardFar = countsTowardFar(regulation, 'roof annex');
  const roofAnnexPercent = regulation.roofAnnexPercent.value ?? overrideNumber(scenario, 'roofAnnexPercent');
  if (roofAnnexPercent === null) missingRules.push('Roof annex percent not defined');
  const roofCoverageLimit = coverage.roof === null ? Number.POSITIVE_INFINITY : plotArea * coverage.roof;
  // The annex sits on the top floor of each depth band (front G+2 and rear G+1 each get their own).
  const roofBase = bands.reduce((sum, band) => {
    const top = Math.min(band.floors, floorAreas.length) - 1;
    if (top < 0) return sum;
    const activeDepth = activeBands(top).reduce((total, item) => total + overlap(item), 0);
    return activeDepth > 0 ? sum + floorAreas[top].finalAllowedArea * (overlap(band) / activeDepth) : sum;
  }, 0);
  const roofAnnexArea = roofAnnexPercent === null ? 0 : round(Math.min(roofCoverageLimit, roofBase * roofAnnexPercent, !noFar && roofCountsTowardFar ? farRemaining : Number.POSITIVE_INFINITY));
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
    { key: 'FAR', value: noFar || !permittedGfa ? Number.POSITIVE_INFINITY : permittedGfa / Math.max(1, floorCount) }
  ].sort((a, b) => a.value - b.value);
  const warnings: string[] = [];
  if (regulation.verificationStatus === 'DEMO_ONLY') warnings.push('Demo data - not regulatory / بيانات تجريبية - ليست اشتراطات رسمية');
  if (plot.accuracy === 'Area Only' || !(plot.length && plot.width)) warnings.push('Plot dimensions missing: envelope assumes a square plot / الأبعاد غير مدخلة: الحساب يفترض أرضًا مربعة');
  if (areaDifference && Math.abs(areaDifference) > 1) warnings.push('Difference between calculated and official plot area / فرق بين المساحة المحسوبة ومساحة الصك');
  warnings.push(...notes, ...Array.from(new Set(missingRules)));
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
    warnings,
    setbacks,
    regulatoryViolations
  };
};

const basementPlate = (scenario: Scenario, footprint: number) =>
  scenario.basementCoverage && scenario.basementCoverage > 0 ? round(scenario.plot.officialArea * Math.min(1, scenario.basementCoverage)) : footprint;

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
  const suggestedUnits = scenario.plot.officialArea && mix.averageUnitArea > 0 ? Math.floor(sellableResidential / mix.averageUnitArea) : 0;
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
    basementArea: round(basementPlate(scenario, envelope.finalFootprint) * Math.max(0, scenario.basementCount)),
    sellableResidential,
    sellableRetail,
    sellableOffice,
    units,
    villas,
    residentialGfa: round(residentialGfa),
    retailGfa: round(retailGfa),
    officeGfa: round(officeGfa)
  };
};

/** Stall 2.8 m x 5.5 m. Streets 15-25 m take perpendicular stalls; 30 m and wider take 45-degree stalls. */
export const STALL_WIDTH = 2.8;
export const STALL_LENGTH = 5.5;
export const LARGE_UNIT_AREA = 180;
const ANGLED_STALL_ALONG_CURB = round(STALL_WIDTH / Math.sin(Math.PI / 4), 2);
/** Ministry residential requirements (2024): one space per 45 m2 of shops or offices. Used when the pack has no rule. */
const DEFAULT_COMMERCIAL_SQM_PER_SPACE = 45;

export const streetParking = (scenario: Scenario): StreetParkingSide[] => {
  const { length, width } = plotDimensions(scenario.plot);
  return scenario.plot.boundaries
    .filter((boundary) => boundary.type === 'Street' && (boundary.width ?? 0) > 0)
    .map((boundary) => {
      const streetWidth = boundary.width ?? 0;
      const frontage = boundary.side === 'front' || boundary.side === 'rear' ? width : length;
      const layout: StreetParkingSide['layout'] = streetWidth >= 30 ? 'ANGLED_45' : streetWidth >= 15 ? 'PERPENDICULAR' : 'NOT_ALLOWED';
      const stallAlongCurb = layout === 'ANGLED_45' ? ANGLED_STALL_ALONG_CURB : STALL_WIDTH;
      const spaces = layout === 'NOT_ALLOWED' ? 0 : Math.max(0, Math.floor(frontage / stallAlongCurb));
      return { side: boundary.side, streetWidth, frontage: round(frontage), layout, stallAlongCurb, spaces };
    });
};

export const calculateParking = (scenario: Scenario, regulation: RegulationPack, outputs: DevelopmentOutputs): ParkingResult => {
  const rules = regulation.parking.value;
  const efficiency = scenario.parkingEfficiencySqmPerSpace ?? 30;
  const plate = basementPlate(scenario, outputs.footprint);
  const spacesPerBasement = Math.max(0, Math.floor(plate / Math.max(1, efficiency)));
  const streetSides = streetParking(scenario);
  const frontSide = streetSides.find((side) => side.side === 'front') ?? streetSides[0];
  const parkingLayout: ParkingResult['parkingLayout'] = !frontSide || frontSide.layout === 'NOT_ALLOWED' ? 'NOT_APPLICABLE' : frontSide.layout;
  const autoSurfaceParking = Math.max(0, streetSides.reduce((sum, side) => sum + side.spaces, 0) - Math.max(0, Math.floor(scenario.streetParkingLostSpaces ?? 0)));
  const developmentUse = scenario.developmentUse;
  const rule = (use: string) => rules.find((r) => r.use === use);
  const mix = scenario.productMix;
  const largeShare = Math.min(1, Math.max(0, mix.largeUnitShare ?? (mix.averageUnitArea > LARGE_UNIT_AREA ? 1 : 0)));
  const demandBreakdown: NonNullable<ParkingResult['demandBreakdown']> = [];
  const apartments = () => {
    const packRule = rule('Residential Apartments');
    const spaces = packRule ? outputs.units * packRule.ratio : outputs.units * (1 + largeShare);
    demandBreakdown.push({ label: { ar: packRule ? `شقق: ${packRule.ratio} موقف لكل وحدة` : 'شقق: موقف للشقة حتى 180م² وموقفان للأكبر', en: 'Apartments' }, spaces: Math.ceil(spaces) });
    return spaces;
  };
  const villas = () => {
    const packRule = rule('Residential Villas');
    const spaces = outputs.villas * (packRule?.ratio ?? 1);
    demandBreakdown.push({ label: { ar: 'فلل: موقف داخل حدود كل فيلا', en: 'Villas (inside each plot)' }, spaces: Math.ceil(spaces) });
    return spaces;
  };
  const commercial = (use: 'Retail' | 'Office', area: number) => {
    if (area <= 0) return 0;
    const packRule = rule(use);
    const spaces = packRule ? (area / 100) * packRule.ratio : area / DEFAULT_COMMERCIAL_SQM_PER_SPACE;
    demandBreakdown.push({ label: { ar: `${use === 'Retail' ? 'تجاري' : 'مكاتب'}: ${packRule ? `${packRule.ratio} موقف لكل 100م²` : 'موقف لكل 45م²'}`, en: use }, spaces: Math.ceil(spaces) });
    return spaces;
  };
  const retailArea = rule('Retail') ? outputs.sellableRetail : outputs.retailGfa ?? outputs.sellableRetail;
  const officeArea = rule('Office') ? outputs.sellableOffice : outputs.officeGfa ?? outputs.sellableOffice;
  let calculatedDemand: number | null = null;
  let internalSpaces = 0;
  if (developmentUse === 'Residential Villas') { calculatedDemand = villas(); internalSpaces = Math.ceil(calculatedDemand); }
  else if (developmentUse === 'Residential Apartments') calculatedDemand = apartments();
  else if (developmentUse === 'Retail' || developmentUse === 'Commercial') calculatedDemand = commercial('Retail', retailArea);
  else if (developmentUse === 'Office') calculatedDemand = commercial('Office', officeArea);
  else if (developmentUse === 'Residential + Retail') calculatedDemand = Math.ceil(apartments()) + Math.ceil(commercial('Retail', retailArea));
  else if (developmentUse === 'Retail + Office') calculatedDemand = Math.ceil(commercial('Retail', retailArea)) + Math.ceil(commercial('Office', officeArea));
  const manualRequiredSpaces = overrideNumber(scenario, 'parking.requiredSpaces');
  const canCalculateParking = manualRequiredSpaces !== null || calculatedDemand !== null;
  const requiredSpaces = manualRequiredSpaces ?? (calculatedDemand === null ? 0 : Math.ceil(calculatedDemand));
  // Street spaces come first; a confirmed manual count replaces the estimate.
  const surfaceParking = Math.max(0, scenario.surfaceParking ?? autoSurfaceParking) + internalSpaces;
  const shortfall = Math.max(0, requiredSpaces - surfaceParking);
  const basementCountRequired = shortfall === 0 ? 0 : spacesPerBasement > 0 ? Math.ceil(shortfall / spacesPerBasement) : 0;
  const basementMode: 'AUTO' | 'MANUAL' = scenario.basementMode ?? 'MANUAL';
  const providedBasements = basementMode === 'AUTO' ? basementCountRequired : Math.max(0, scenario.basementCount);
  const providedSpaces = surfaceParking + providedBasements * spacesPerBasement;
  const balance = providedSpaces - requiredSpaces;
  const warnings: string[] = [];
  if (!developmentUse) warnings.push('Development use not defined for parking demand / نوع التطوير غير محدد لحساب المواقف');
  else if (calculatedDemand === null && manualRequiredSpaces === null) warnings.push('Parking rule not defined for selected development use / لا توجد قاعدة مواقف لهذا الاستخدام');
  if (manualRequiredSpaces !== null) warnings.push('Parking required spaces entered manually / عدد المواقف المطلوبة مدخل يدويًا');
  if (scenario.surfaceParking === undefined && autoSurfaceParking > 0) warnings.push('Street spaces are estimated from frontage; deduct entrances and corners / مواقف الشوارع محسوبة من طول الواجهة؛ اخصم المداخل والزوايا');
  if (streetSides.some((side) => side.layout === 'NOT_ALLOWED')) warnings.push('Streets narrower than 15 m are not counted for parking / الشوارع الأقل من 15م غير محتسبة للمواقف');
  if (shortfall > 0 && spacesPerBasement === 0) warnings.push('Basement capacity cannot be calculated without a footprint / لا يمكن حساب سعة القبو بدون بصمة بناء');
  return {
    requiredSpaces: canCalculateParking ? requiredSpaces : 0,
    autoSurfaceParking,
    surfaceParkingMode: scenario.surfaceParking === undefined ? 'AUTO' : 'MANUAL',
    parkingLayout,
    spacesPerBasement,
    basementCountRequired,
    providedBasements,
    surfaceParking,
    providedSpaces,
    balance: canCalculateParking ? balance : 0,
    effectiveCapacityRatio: requiredSpaces ? round(Math.min(1, providedSpaces / requiredSpaces)) : 1,
    status: canCalculateParking ? providedSpaces >= requiredSpaces ? 'OK' : 'SHORTAGE' : 'ASSUMPTION',
    warnings,
    streetSides,
    basementMode,
    demandBreakdown,
    internalSpaces
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
  const mode = f.mode === 'RENT' ? 'RENT' : 'SALE';
  const landCost = round(scenario.plot.officialArea * f.landPrice);
  const constructionRate = f.structuralRate + f.finishingRate + f.mepRate;
  const constructionCost = round(outputs.gfa * constructionRate + outputs.basementArea * f.basementRate);
  const directCost = landCost + constructionCost;
  const taxes = round(landCost * (f.rettPercent ?? 0) + constructionCost * (f.constructionVatPercent ?? 0));
  const acquisitionCost = round(landCost * (f.brokeragePercent ?? 0) + (f.otherAcquisitionCost ?? 0));
  const fixedSoftCosts = (f.designCost ?? 0) + (f.consultancyCost ?? 0) + (f.supervisionCost ?? 0) +
    (f.permitsCost ?? 0) + (f.adminCost ?? 0) + (f.externalWorksCost ?? 0);
  const months = 18;
  if (mode === 'RENT') {
    const occupancy = Math.min(1, Math.max(0, f.occupancyPercent ?? 0.9));
    const annualGrossRent = round((outputs.sellableResidential * (f.rentResidential ?? 0) + outputs.sellableRetail * (f.rentRetail ?? 0) + outputs.sellableOffice * (f.rentOffice ?? 0)) * occupancy);
    const annualNoi = round(annualGrossRent * (1 - Math.min(1, Math.max(0, f.opexPercent ?? 0))));
    // Leasing and marketing are charged once, on the first year's rent.
    const softCosts = round(acquisitionCost + fixedSoftCosts + taxes + constructionCost * f.contingencyPercent + annualGrossRent * (f.marketingPercent + f.salesCommissionPercent));
    const totalCost = round(directCost + softCosts);
    const capRate = f.capRate && f.capRate > 0 ? f.capRate : 0.08;
    const exitValue = round(annualNoi / capRate);
    const profit = round(exitValue - totalCost);
    let cumulative = 0;
    const monthlyCashFlow = Array.from({ length: months }, (_, index) => {
      const cost = round(index === 0 ? landCost : (constructionCost + softCosts) / (months - 1));
      cumulative = round(cumulative - cost);
      return { month: index + 1, cost, revenue: 0, net: -cost, cumulative };
    });
    // Ten-year hold: build in years 1-2, collect NOI, sell at the cap-rate value in year 10.
    const annual = [-landCost - (constructionCost + softCosts) * (11 / 17), -(constructionCost + softCosts) * (6 / 17) + annualNoi / 2, ...Array.from({ length: 7 }, () => annualNoi), annualNoi + exitValue];
    return {
      landCost, constructionCost, softCosts, totalCost,
      revenue: exitValue, profit,
      profitMargin: exitValue ? round(profit / exitValue) : 0,
      roi: totalCost ? round(profit / totalCost) : 0,
      monthlyCashFlow,
      peakFunding: totalCost,
      breakEvenMonth: null,
      irr: calculateIrr(annual),
      npv: round(annual.reduce((sum, cf, index) => sum + cf / Math.pow(1.1, index), 0)),
      mode, taxes, annualGrossRent, annualNoi,
      yieldOnCost: totalCost ? round(annualNoi / totalCost, 4) : 0,
      paybackYears: annualNoi > 0 ? round(totalCost / annualNoi, 1) : null,
      exitValue
    };
  }
  const revenue = round(
    outputs.sellableResidential * f.sellingPriceResidential +
    outputs.sellableRetail * f.sellingPriceRetail +
    outputs.sellableOffice * f.sellingPriceOffice
  );
  const softCosts = round(acquisitionCost + fixedSoftCosts + taxes + constructionCost * f.contingencyPercent +
    revenue * (f.marketingPercent + f.salesCommissionPercent));
  const totalCost = round(directCost + softCosts);
  const profit = round(revenue - totalCost);
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
    npv: round(cashFlows.reduce((sum, cf, index) => sum + cf / Math.pow(1.1, index / 12), 0)),
    mode,
    taxes
  };
};

/** Decision thresholds. Sale: return on total cost. Rent: net yield on total cost. */
export const DECISION_THRESHOLDS = { saleProceed: 0.18, saleConditional: 0.1, rentProceed: 0.08, rentConditional: 0.06, rentWeak: 0.04 };

export const decide = (financial: FinancialResult, parking: ParkingResult, envelope: DevelopmentEnvelope): DecisionResult => {
  const T = DECISION_THRESHOLDS;
  if (envelope.regulatoryViolations.length) {
    return { status: 'NOT_RECOMMENDED', label: { ar: 'مخالفة تنظيمية', en: 'REGULATORY VIOLATION' }, reasons: envelope.regulatoryViolations.map((reason) => ({ ar: reason, en: reason })) };
  }
  if (parking.status === 'SHORTAGE') {
    return { status: 'RECONSIDER', label: { ar: 'إعادة الدراسة', en: 'RECONSIDER' }, reasons: [{ ar: `عجز ${Math.abs(parking.balance)} موقف: زد الأقبية أو قلل عدد الوحدات.`, en: `Parking shortfall of ${Math.abs(parking.balance)} spaces.` }] };
  }
  const incomplete = envelope.farSource === 'NOT_DEFINED' || parking.status === 'ASSUMPTION';
  const rent = financial.mode === 'RENT';
  const measure = rent ? financial.yieldOnCost ?? 0 : financial.roi;
  const strong = rent ? T.rentProceed : T.saleProceed;
  const fair = rent ? T.rentConditional : T.saleConditional;
  const weak = rent ? T.rentWeak : 0;
  const pct = `${(measure * 100).toFixed(1)}%`;
  const what = rent ? { ar: 'العائد الإيجاري على التكلفة', en: 'Yield on cost' } : { ar: 'العائد على التكلفة', en: 'Return on cost' };
  if (measure >= strong && !incomplete) {
    return { status: 'PROCEED', label: { ar: 'المضي بالمشروع', en: 'PROCEED' }, reasons: [{ ar: `${what.ar} ${pct} والمواقف مغطاة.`, en: `${what.en} ${pct}; parking is covered.` }] };
  }
  if (measure >= fair) {
    return { status: 'PROCEED_WITH_CONDITIONS', label: { ar: 'المضي بشروط', en: 'PROCEED WITH CONDITIONS' }, reasons: [{ ar: incomplete ? `${what.ar} ${pct}، لكن بعض بيانات النظام أو المواقف ناقصة.` : `${what.ar} ${pct}: مقبول ويحتاج تأكيد الأسعار والتكاليف.`, en: `${what.en} ${pct}; confirm assumptions.` }] };
  }
  if (measure >= weak) {
    return { status: 'RECONSIDER', label: { ar: 'إعادة الدراسة', en: 'RECONSIDER' }, reasons: [{ ar: `${what.ar} ${pct}: ضعيف. راجع سعر الأرض أو المنتج.`, en: `${what.en} ${pct} is weak.` }] };
  }
  return { status: 'NOT_RECOMMENDED', label: { ar: 'غير موصى به', en: 'NOT RECOMMENDED' }, reasons: [{ ar: rent ? `${what.ar} ${pct}: أقل من الحد المقبول.` : 'التكلفة أعلى من الإيرادات في السيناريو الحالي.', en: rent ? `${what.en} ${pct} is below the acceptable level.` : 'The current scenario is financially negative.' }] };
};

export const runScenario = (scenario: Scenario, regulation: RegulationPack): ScenarioResult => {
  const envelope = calculateEnvelope(scenario, regulation);
  const outputs = calculateOutputs(scenario, envelope);
  const parking = calculateParking(scenario, regulation, outputs);
  // In AUTO mode a basement exists only if street parking falls short, so its cost follows the parking result.
  if (parking.basementMode === 'AUTO') outputs.basementArea = round(basementPlate(scenario, outputs.footprint) * parking.providedBasements);
  const financial = calculateFinancial(scenario, outputs);
  const mix = scenario.productMix;
  const mixTotal = mix.residentialShare + mix.retailShare + mix.officeShare;
  const mixInvalid = Math.abs(mixTotal - 1) > 0.001 || [mix.residentialShare, mix.retailShare, mix.officeShare].some((v) => v < 0 || v > 1);
  if (mixInvalid) envelope.warnings.push('Product mix shares must total 100% / مجموع نسب الاستخدامات يجب أن يساوي 100%');
  const decision: DecisionResult = mixInvalid ? { status: 'RECONSIDER' as const, label: { ar: 'راجع نسب الاستخدامات', en: 'CHECK PRODUCT MIX' }, reasons: [{ ar: 'يجب ضبط مجموع نسب الاستخدامات إلى 100% قبل اتخاذ قرار الاستثمار.', en: 'Product mix must total 100% before relying on the investment decision.' }] } : decide(financial, parking, envelope);
  const insights = [
    parking.providedBasements > 0 ? `${parking.providedBasements} basement level(s) needed after street parking` : 'Street parking covers the demand without a basement',
    financial.profit < 0 ? 'Revenue does not cover development cost in this scenario' : `Estimated profit is ${financial.profit.toLocaleString()} SAR`
  ];
  return { envelope, outputs, parking, financial, decision, insights, regulationConfidence: regulationConfidence(scenario, regulation) };
};

export const createScenarioComparison = (scenarios: Scenario[], regulations: RegulationPack[]) => scenarios.map((scenario) => {
  const regulation = regulations.find((r) => r.id === scenario.regulationId);
  return { scenario, result: regulation ? runScenario(scenario, regulation) : null };
});
