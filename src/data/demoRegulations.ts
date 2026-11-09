import { RegulationPack } from '../shared/types';

export const demoRegulationPack: RegulationPack = {
  id: 'DEMO_ONLY_RIYADH_MIXED_01',
  name: {
    ar: 'نظام تجريبي للتطوير المختلط',
    en: 'Demo Mixed-Use Development Regulation'
  },
  code: 'DEMO_ONLY',
  authority: {
    ar: 'بيانات تجريبية - ليست جهة تنظيمية',
    en: 'Demo data - not an authority'
  },
  planningZone: 'DEMO',
  city: 'Riyadh',
  version: '1.0-demo',
  effectiveDate: '2026-08-31',
  verificationDate: '2026-08-31',
  source: 'Internal demo seed',
  sourceReference: 'Demo data - not regulatory / بيانات تجريبية - ليست اشتراطات رسمية',
  verificationStatus: 'DEMO_ONLY',
  applicableUses: [
    'Residential Villas',
    'Residential Apartments',
    'Residential + Retail',
    'Commercial',
    'Office',
    'Retail + Office',
    'Manual / Custom Study'
  ],
  priority: 999,
  maxFloors: {
    id: 'demo-max-floors',
    label: { ar: 'أقصى عدد أدوار', en: 'Maximum Floors' },
    value: 4,
    source: 'Demo only',
    status: 'DEMO_ONLY',
    type: 'CALCULATION_RULE'
  },
  roofAnnexPercent: {
    id: 'demo-roof-annex',
    label: { ar: 'ملحق السطح', en: 'Roof Annex' },
    value: 0.5,
    source: 'Demo only',
    status: 'DEMO_ONLY',
    type: 'CALCULATION_RULE'
  },
  coverage: {
    id: 'demo-coverage',
    label: { ar: 'نسب التغطية', en: 'Coverage Rules' },
    value: { ground: 0.6, first: 0.75, typical: 0.75, roof: 0.5 },
    source: 'Demo only',
    status: 'DEMO_ONLY',
    type: 'CALCULATION_RULE'
  },
  far: {
    id: 'demo-far',
    label: { ar: 'معامل البناء', en: 'FAR' },
    value: 2.6,
    source: 'Demo only',
    status: 'DEMO_ONLY',
    type: 'CALCULATION_RULE'
  },
  setbacks: {
    id: 'demo-setbacks',
    label: { ar: 'الارتدادات', en: 'Setbacks' },
    value: { front: 3, right: 2, left: 2, rear: 2 },
    source: 'Demo only',
    status: 'DEMO_ONLY',
    type: 'CALCULATION_RULE'
  },
  parking: {
    id: 'demo-parking',
    label: { ar: 'المواقف', en: 'Parking' },
    value: [
      { use: 'Residential Apartments', ratio: 1.2, basis: 'unit', status: 'DEMO_ONLY' },
      { use: 'Residential Villas', ratio: 2, basis: 'unit', status: 'DEMO_ONLY' },
      { use: 'Retail', ratio: 3, basis: '100sqm', status: 'DEMO_ONLY' },
      { use: 'Office', ratio: 2, basis: '100sqm', status: 'DEMO_ONLY' }
    ],
    source: 'Demo only',
    status: 'DEMO_ONLY',
    type: 'CALCULATION_RULE'
  },
  notes: {
    ar: 'هذه حزمة تجريبية لا تمثل اشتراطات رسمية للرياض. استورد حزمة موثقة أو أنشئ نظامًا مخصصًا قبل الاعتماد.',
    en: 'This demo pack is not an official Riyadh regulation. Import a verified pack or create a custom regulation before relying on results.'
  }
};

const userReference = (code: string, name: string, overrides: Partial<RegulationPack> = {}): RegulationPack => ({
  ...demoRegulationPack,
  id: `USER_REFERENCE_${code.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`,
  code,
  name: { ar: name, en: name },
  authority: { ar: 'مرجع مستخدم', en: 'User reference' },
  planningZone: 'USER_REFERENCE',
  version: 'user-reference',
  effectiveDate: 'user-reference',
  verificationDate: 'user-reference',
  source: 'User supplied reference',
  sourceReference: 'USER_REFERENCE - values must be verified by the user before reliance',
  verificationStatus: 'USER_REFERENCE',
  priority: 100,
  calculationReady: false,
  maxFloors: { ...demoRegulationPack.maxFloors, value: null, status: 'USER_REFERENCE', source: 'Not defined in supplied reference' },
  roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: null, status: 'USER_REFERENCE', source: 'Not defined in supplied reference' },
  coverage: { ...demoRegulationPack.coverage, value: { ground: null, first: null, typical: null, roof: null }, status: 'USER_REFERENCE', source: 'Not defined in supplied reference' },
  far: { ...demoRegulationPack.far, value: null, status: 'USER_REFERENCE', source: 'Awaiting user supplied values' },
  setbacks: { ...demoRegulationPack.setbacks, value: { front: null, right: null, left: null, rear: null }, status: 'USER_REFERENCE', source: 'Not defined in supplied reference' },
  parking: { ...demoRegulationPack.parking, value: [], status: 'USER_REFERENCE', source: 'Not defined in supplied reference' },
  floorAreaTypes: [
    { floor: 'ground', countsTowardFAR: true },
    { floor: 'first', countsTowardFAR: true },
    { floor: 'typical', countsTowardFAR: true },
    { floor: 'roof annex', countsTowardFAR: true }
  ],
  ...overrides
});

const calc = (definedRules: string[], missingRules: string[]) => ({
  verificationStatus: 'USER_REFERENCE_CALCULABLE' as const,
  calculationReady: true,
  definedRules,
  missingRules
});
const partial = (definedRules: string[], missingRules: string[]) => ({
  verificationStatus: 'USER_REFERENCE_CALCULABLE_PARTIAL' as const,
  calculationReady: true,
  definedRules,
  missingRules
});
const cov = (ground: number | null, first: number | null, typical: number | null, roof: number | null) => ({ ground, first, typical, roof });
const sw = (divisor: number, min?: number, max?: number) => ({ type: 'streetWidthDivisor' as const, divisor, min, max });

export const userReferenceRegulationPacks: RegulationPack[] = [
  userReference('S111', 'S111 | س111', {
    id: 'RIYADH-S111',
    applicableUses: ['Residential Villas'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 2, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.6, 0.6, null, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: sw(5, 2), right: 2, left: 2, rear: 2 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: sw(5, 2), secondaryStreet: sw(5, 2), neighbor: 2 },
    far: { ...demoRegulationPack.far, value: null, status: 'USER_REFERENCE', source: 'Not defined in supplied reference' },
    developmentDepth: { id: 's111-depth', label: { ar: 'عمق التطوير', en: 'Development Depth' }, value: null, status: 'USER_REFERENCE', source: 'Not defined in supplied reference', type: 'CALCULATION_RULE' },
    ...calc(['Floors: Ground + First', 'Roof Annex 50% of First', 'Coverage 60%', 'Street setbacks width/5 min 2m', 'Neighbors 2m'], ['FAR', 'Parking', 'Development Depth'])
  }),
  userReference('M111', 'M111 | م111', {
    id: 'RIYADH-M111',
    applicableUses: ['Residential Apartments', 'Commercial', 'Office'],
    setbacks: {
      ...demoRegulationPack.setbacks,
      id: 'user-m111-setbacks',
      value: { front: sw(5, 2, undefined), right: 2, left: 2, rear: 2 },
      status: 'USER_REFERENCE_CALCULABLE',
      source: 'User supplied reference'
    },
    setbackProfiles: { mainStreet: sw(5, 2), secondaryStreet: sw(5, 2), neighbor: 2 },
    maxFloors: { ...demoRegulationPack.maxFloors, value: 2, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, id: 'user-m111-coverage', value: cov(0.6, 0.6, null, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    far: { ...demoRegulationPack.far, id: 'user-m111-far', value: 1.2, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    floorAreaTypes: [{ floor: 'ground', countsTowardFAR: true }, { floor: 'first', countsTowardFAR: true }, { floor: 'roof annex', countsTowardFAR: false }],
    developmentDepth: { id: 'm111-commercial-depth', label: { ar: 'عمق الاستخدام التجاري', en: 'Commercial Development Depth' }, value: null, status: 'AUTHORITY_CONFIRMATION', source: 'User supplied reference', type: 'CALCULATION_RULE', notes: { ar: 'يجب مراجعة أمانة منطقة الرياض لتحديد عمق الاستخدام التجاري المسموح به حسب موقع الأرض.', en: 'Riyadh Municipality confirmation required for commercial depth by location.' } },
    ...calc(['Floors: Ground + First', 'Roof Annex 50% excluded from FAR', 'Coverage 60%', 'FAR 1.20', 'Street setbacks width/5 min 2m; 30m+ min 6m', 'Neighbors 2m'], ['Commercial Development Depth', 'Parking'])
  }),
  userReference('M112', 'M112 | م112', {
    id: 'RIYADH-M112',
    applicableUses: ['Residential Apartments', 'Commercial', 'Office'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 3, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, id: 'user-m112-setbacks', value: { front: sw(5, 3), right: 2, left: 2, rear: 2 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: sw(5, 3), secondaryStreet: sw(5, 2), neighbor: 2 },
    coverage: { ...demoRegulationPack.coverage, id: 'user-m112-coverage', value: cov(0.6, 0.6, 0.6, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    far: { ...demoRegulationPack.far, id: 'user-m112-far', value: null, status: 'USER_REFERENCE', source: 'Not defined in supplied reference' },
    developmentDepth: { id: 'm112-depth', label: { ar: 'عمق التطوير', en: 'Development Depth' }, value: null, status: 'USER_REFERENCE', source: 'Not defined in supplied reference', type: 'CALCULATION_RULE' },
    ...calc(['Floors: Ground + 2 Upper Floors', 'Roof Annex 50%', 'Coverage 60%', 'Main setback width/5 min 3m', 'Secondary setback width/5 min 2m', 'Neighbors 2m'], ['FAR', 'Parking', 'Development Depth'])
  }),
  userReference('M112 Central Spine Case', 'M112 - Central Spine Case', {
    id: 'RIYADH-M112-CENTRAL-SPINE',
    applicableUses: ['Residential Apartments', 'Commercial', 'Office'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 3, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.6, 0.6, 0.6, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: sw(5, 3), right: 2, left: 2, rear: 2 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: sw(5, 3), secondaryStreet: sw(5, 2), neighbor: 2 },
    developmentZones: [{ name: 'Zone A', depth: 30, floors: 3, coverage: 0.6, notes: 'Central Spine rules where applicable' }, { name: 'Zone B', depth: null, floors: 2, coverage: 0.6, use: 'Residential Apartments' }],
    ...calc(['M112 base', 'Zone A first 30m', 'Zone B remaining depth Ground + First', 'Coverage 60%', 'Setbacks from M112'], ['FAR', 'Parking'])
  }),
  userReference('S221', 'S221 | س221', {
    id: 'RIYADH-S221',
    applicableUses: ['Residential Apartments'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 2, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.6, 0.6, null, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: sw(5, 2), right: 2, left: 2, rear: 2 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: sw(5, 2), secondaryStreet: sw(5, 2), neighbor: 2 },
    developmentDepth: { id: 's221-depth', label: { ar: 'عمق التطوير', en: 'Development Depth' }, value: null, status: 'AUTHORITY_CONFIRMATION', source: 'Not defined numerically', type: 'CALCULATION_RULE' },
    ...calc(['Floors: Ground + First', 'Roof Annex 50%', 'Coverage 60%', 'Street setbacks width/5 min 2m', 'Neighbors 2m'], ['Development Depth', 'FAR', 'Parking'])
  }),
  userReference('S231', 'S231 | س231', {
    id: 'RIYADH-S231',
    applicableUses: ['Residential Apartments'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 2, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(1, 1, null, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: 0, right: 0, left: 0, rear: 0 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: 0, secondaryStreet: 0, neighbor: 0 },
    ...calc(['Floors: Ground + First', 'Roof Annex 50%', 'Coverage 100%', 'All setbacks 0m'], ['FAR', 'Parking', 'Development Depth'])
  }),
  userReference('Developed Case 3', 'Developed Regulation - Case 3', {
    id: 'RIYADH-DEVELOPED-CASE-3',
    applicableUses: ['Residential Apartments', 'Residential Villas'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 3, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.6, 0.75, 0.75, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: 6, right: 2, left: 2, rear: 2 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: 6, commercialStreet: 6, secondaryStreet: sw(5, 3, 6), neighbor: 2 },
    far: { ...demoRegulationPack.far, value: null, status: 'USER_REFERENCE_CALCULABLE', source: 'NO_FAR' },
    developmentZones: [{ name: 'Front Zone', depth: 30, floors: 3, coverage: 0.75 }, { name: 'Rear Zone', depth: null, floors: 2, coverage: 0.75 }],
    notes: { ar: 'لا يوجد معامل بناء. ينطبق على شوارع 30م و36م حسب المرجع المزود، والاختيار يدوي.', en: 'NO_FAR. Developed regulation for 30m and 36m streets per supplied reference; selected manually.' },
    ...calc(['Main/Commercial Street 6m', 'Neighbors 2m', 'Secondary street width/5 min 3m max 6m', 'Front Zone depth 30m Ground + 2 Floors', 'Rear Zone Ground + First', 'Coverage Ground 60%', 'Repeated 75%', 'Roof Annex 50%', 'NO_FAR'], ['Parking'])
  }),
  userReference('Developed Commercial Depth 30m', 'Developed Regulation - Commercial Depth 30m', {
    id: 'RIYADH-DEVELOPED-COMMERCIAL-DEPTH-30',
    applicableUses: ['Residential Apartments'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 3, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    roofAnnexPercent: { ...demoRegulationPack.roofAnnexPercent, value: 0.5, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.6, 0.75, 0.75, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: 6, right: 2, left: 2, rear: null }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: 6, secondaryStreet: sw(5, 3), neighbor: 2 },
    developmentDepth: { id: 'developed-commercial-depth-30', label: { ar: 'عمق تجاري', en: 'Commercial Depth' }, value: 30, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference', type: 'CALCULATION_RULE' },
    developmentZones: [{ name: 'Front Zone', depth: 30, floors: 3, coverage: 0.75 }, { name: 'Remaining Depth', depth: null, floors: null, coverage: null, notes: 'Residential condition applies' }],
    ...calc(['Commercial Depth 30m', 'Front Zone Ground + 2 Floors', 'Roof Annex 50%', 'Coverage Ground 60%', 'Repeated 75%', 'Main 6m', 'Neighbors 2m', 'Secondary width/5 min 3m'], ['FAR', 'Parking', 'Rear setback'])
  }),
  userReference('Main Activity Spine 30m', 'Main Activity Spine - Maximum 30m', {
    id: 'RIYADH-MAIN-ACTIVITY-SPINE-30M',
    applicableUses: ['Residential Apartments'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 3, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.5, 0.5, 0.5, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    far: { ...demoRegulationPack.far, value: 1.5, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied referenced front condition where applicable' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: null, right: 3, left: 3, rear: 3 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: null, secondaryStreet: sw(5, 4), neighbor: 3 },
    developmentDepth: { id: 'main-activity-depth-30', label: { ar: 'عمق المنطقة الأمامية', en: 'Front Zone Depth' }, value: 30, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference', type: 'CALCULATION_RULE' },
    developmentZones: [{ name: 'Front Zone', depth: 30, floors: 3, coverage: 0.5, notes: 'King Salman Road referenced condition' }, { name: 'Rear Zone', depth: null, floors: 2, coverage: 0.5, use: 'Residential' }],
    ...calc(['Ground + 2 Floors', 'Coverage 50%', 'Front Zone max 30m', 'Rear Zone Ground + First', 'FAR 1.5 where applicable', 'Neighbors 3m', 'Secondary width/5 min 4m'], ['Main setback', 'Parking'])
  }),
  userReference('Main Activity Spine Front', 'Main Activity Spine - Front Plots', {
    id: 'RIYADH-MAIN-ACTIVITY-SPINE-FRONT',
    applicableUses: ['Residential Apartments', 'Commercial', 'Office'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 6, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.4, 0.4, 0.4, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: 6, right: 3, left: 3, rear: 3 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: 6, secondaryStreet: sw(5, 3), neighbor: 3 },
    developmentDepth: { id: 'main-activity-front-depth-50', label: { ar: 'عمق التطوير الأمامي', en: 'Front Development Depth' }, value: 50, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference', type: 'CALCULATION_RULE' },
    developmentZones: [{ name: 'Front Development', depth: 50, floors: 6, coverage: 0.4 }, { name: 'Rear Development', depth: null, floors: 3, coverage: 0.4, use: 'Residential' }],
    ...calc(['Front Ground + 5 Floors', 'Front depth 50m', 'Rear max 3 residential floors', 'Coverage 40%', 'Main 6m', 'Neighbors 3m', 'Secondary width/5 min 3m'], ['FAR', 'Parking'])
  }),
  userReference('Central Spine', 'Central Spine', {
    id: 'RIYADH-CENTRAL-SPINE',
    applicableUses: ['Residential Apartments', 'Commercial', 'Office'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: null, status: 'USER_REFERENCE_CALCULABLE', source: 'Unlimited height in supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.35, 0.35, 0.35, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: 6, right: 3, left: 3, rear: 3 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: 6, kingFahdRoad: 4, olayaStreet: 6, secondaryStreet: sw(5, 3), neighbor: 3 },
    notes: { ar: 'الارتفاع مطلق حسب المرجع. طريق الملك فهد 4م بدون مواقف عمودية و8م مع المواقف. شارع العليا 6م. شروط المواقف/الارتدادات الخاصة محفوظة كملاحظات عند عدم نمذجتها بالكامل.', en: 'Unlimited height per reference. King Fahd Road 4m without perpendicular parking and 8m with it. Olaya Street 6m.' },
    ...calc(['Unlimited height noted', 'Coverage 35%', 'Neighbors 3m', 'King Fahd 4m/8m', 'Olaya 6m', 'Secondary width/5 min 3m / 8m with perpendicular parking'], ['FAR', 'Development Depth', 'Parking Demand'])
  }),
  userReference('Central Spine Commercial Depth 70m', 'Central Spine - Commercial Depth 70m', {
    id: 'RIYADH-CENTRAL-SPINE-COMMERCIAL-DEPTH-70',
    applicableUses: ['Residential Apartments', 'Commercial', 'Office'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: null, status: 'USER_REFERENCE_CALCULABLE', source: 'Unlimited height in supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.35, 0.35, 0.35, null), status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbacks: { ...demoRegulationPack.setbacks, value: { front: 6, right: 3, left: 3, rear: 6 }, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference' },
    setbackProfiles: { mainStreet: 6, kingFahdRoad: 4, secondaryStreet: sw(5, 3), neighbor: 3 },
    developmentDepth: { id: 'central-spine-commercial-depth-70', label: { ar: 'عمق تجاري', en: 'Commercial Depth' }, value: 70, status: 'USER_REFERENCE_CALCULABLE', source: 'User supplied reference', type: 'CALCULATION_RULE' },
    ...calc(['Unlimited height', 'Coverage 35%', 'Commercial Depth 70m', 'King Fahd 4m/8m', 'Intersecting Main Streets 6m', 'Neighbors 3m / rear 6m where applies', 'Secondary width/5 min 3m'], ['FAR', 'Parking Demand'])
  }),
  userReference('SB-T3.2', 'SB-T3.2', {
    id: 'RIYADH-SB-T3-2',
    applicableUses: ['Residential Villas', 'Residential Apartments'],
    maxFloors: { ...demoRegulationPack.maxFloors, value: 3, status: 'USER_REFERENCE_CALCULABLE_PARTIAL', source: 'User supplied reference' },
    coverage: { ...demoRegulationPack.coverage, value: cov(0.7, 0.7, 0.7, null), status: 'USER_REFERENCE_CALCULABLE_PARTIAL', source: 'Range 35%-70%; engine uses maximum known bound' },
    ...partial(['Minimum Ground + 1 Floor', 'Maximum Ground + 2 Floors', 'Coverage range 35%-70%'], ['Setbacks', 'FAR', 'Roof', 'Parking'])
  })
];

export const regulationLibrarySeed: RegulationPack[] = userReferenceRegulationPacks;
