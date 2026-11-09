export type LanguageMode = 'ar' | 'en' | 'bi';
export type ThemeMode = 'light' | 'dark' | 'system';
export type VerificationStatus = 'VERIFIED' | 'LOCATION_DEPENDENT' | 'AUTHORITY_CONFIRMATION' | 'UNVERIFIED' | 'DEMO_ONLY' | 'USER_REFERENCE' | 'USER_REFERENCE_CALCULABLE' | 'USER_REFERENCE_CALCULABLE_PARTIAL' | 'USER_OVERRIDE';
export type ProjectStatus = 'Draft' | 'In Progress' | 'For Review' | 'Approved' | 'Archived';
export type ProjectUse = 'Residential Villas' | 'Residential Apartments' | 'Residential + Retail' | 'Commercial' | 'Retail' | 'Office' | 'Retail + Office' | 'Manual / Custom Study';
export type FarSourceType = 'EXPLICIT_REGULATION' | 'DERIVED_FROM_FLOOR_RULES' | 'USER_OVERRIDE' | 'NO_FAR' | 'NOT_DEFINED';
export type DecisionStatus = 'PROCEED' | 'PROCEED_WITH_CONDITIONS' | 'RECONSIDER' | 'NOT_RECOMMENDED';
export type AccuracyStatus = 'Exact' | 'Approximate' | 'Area Only';

export interface LocalizedText {
  ar: string;
  en: string;
}

export interface Boundary {
  side: 'front' | 'right' | 'left' | 'rear';
  type: 'Street' | 'Neighbor' | 'Corridor' | 'Other';
  width?: number;
  streetRole?: 'main' | 'secondary' | 'kingFahd' | 'olaya' | 'commercial';
}

export interface PlotData {
  officialArea: number;
  length?: number;
  width?: number;
  accuracy: AccuracyStatus;
  boundaries: Boundary[];
  irregularType?: 'Trapezoid' | 'Chamfered Plot' | 'L-Shape' | 'Simple Polygon';
}

export interface ProjectInfo {
  id: string;
  name: string;
  city: 'Riyadh';
  district: string;
  location?: string;
  owner?: string;
  planNumber?: string;
  plotNumber?: string;
  deedNumber?: string;
  use: ProjectUse;
  status: ProjectStatus;
  updatedAt: string;
}

export interface RegulationRule<T = number | string | boolean> {
  id: string;
  label: LocalizedText;
  value: T;
  source: string;
  status: VerificationStatus;
  type: 'CALCULATION_RULE' | 'COMPLIANCE_CHECK' | 'REFERENCE_ONLY';
  notes?: LocalizedText;
}

export interface FloorCoverage {
  ground: number | null;
  first: number | null;
  typical: number | null;
  roof: number | null;
}

export type SetbackValue = number | null | { type: 'fixed'; value: number } | { type: 'streetWidthDivisor'; divisor: number; min?: number; max?: number };

export interface SetbackRules {
  front: SetbackValue;
  right: SetbackValue;
  left: SetbackValue;
  rear: SetbackValue;
}

export interface RegulationApplicabilityScope {
  /** Explicit geographic and regulatory scope. Omission means applicability is NOT established. */
  kind: 'GENERAL' | 'SPECIAL' | 'LOCAL' | 'REFERENCE' | 'DEMO';
  districts?: string[];
  planNumbers?: string[];
  plotNumbers?: string[];
  supersedesPackIds?: string[];
  authorityDocument?: string;
}

export interface RegulationSelectionEvidence {
  regulationId: string;
  regulationVersion: string;
  /** Study / plot identity when the candidate was attached; editing plot invalidates it. */
  parcelKey: string;
  plotSignature: string;
  developmentUse: ProjectUse;
  documentReference: string;
  applicabilityReason: string;
  precedenceReason: string;
  reviewer: string;
  recordedAt: string;
  /** Documented by the user, never a claim of authority verification. */
  status: 'USER_DOCUMENTED';
}

export interface RegulationPack {
  id: string;
  name: LocalizedText;
  code: string;
  authority: LocalizedText;
  planningZone: string;
  applicabilityScope?: RegulationApplicabilityScope;
  city: 'Riyadh';
  version: string;
  effectiveDate: string;
  verificationDate: string;
  source: string;
  sourceReference: string;
  verificationStatus: VerificationStatus;
  applicableUses: ProjectUse[];
  priority: number;
  maxFloors: RegulationRule<number | null>;
  roofAnnexPercent: RegulationRule<number | null>;
  coverage: RegulationRule<FloorCoverage>;
  far: RegulationRule<number | null>;
  setbacks: RegulationRule<SetbackRules>;
  parking: RegulationRule<ParkingRule[]>;
  setbackProfiles?: Partial<Record<'mainStreet' | 'secondaryStreet' | 'neighbor' | 'kingFahdRoad' | 'olayaStreet' | 'commercialStreet', SetbackValue>>;
  floorAreaTypes?: FloorAreaTypeRule[];
  calculationReady?: boolean;
  developmentDepth?: RegulationRule<number | null>;
  developmentZones?: DevelopmentZoneRule[];
  definedRules?: string[];
  missingRules?: string[];
  notes: LocalizedText;
}

export interface DevelopmentZoneRule {
  name: string;
  depth: number | null;
  floors: number | null;
  coverage: number | null;
  use?: string;
  countsTowardFAR?: boolean;
  notes?: string;
}

export interface FloorAreaTypeRule {
  floor: string;
  countsTowardFAR: boolean;
}

export interface ParkingRule {
  use: ProjectUse | 'Retail' | 'Office';
  ratio: number;
  basis: 'unit' | '100sqm';
  status: VerificationStatus;
}

export interface ManualOverride {
  id: string;
  field: string;
  originalValue: string;
  usedValue: string;
  source: 'USER_OVERRIDE';
  reason: string;
  createdAt: string;
}

export interface FinancialInputs {
  landPrice: number;
  structuralRate: number;
  finishingRate: number;
  mepRate: number;
  basementRate: number;
  sellingPriceResidential: number;
  sellingPriceRetail: number;
  sellingPriceOffice: number;
  sellableEfficiencyResidential: number;
  sellableEfficiencyRetail: number;
  sellableEfficiencyOffice: number;
  marketingPercent: number;
  salesCommissionPercent: number;
  contingencyPercent: number;
  /** Optional detailed costs; left zero until entered by the project analyst. */
  brokeragePercent?: number;
  otherAcquisitionCost?: number;
  designCost?: number;
  consultancyCost?: number;
  supervisionCost?: number;
  permitsCost?: number;
  adminCost?: number;
  externalWorksCost?: number;
}

export interface ProductMix {
  averageUnitArea: number;
  averageVillaPlotArea: number;
  residentialShare: number;
  retailShare: number;
  officeShare: number;
}

export interface Scenario {
  id: string;
  name: string;
  regulationId: string;
  regulationEvidence?: RegulationSelectionEvidence;
  plot: PlotData;
  financial: FinancialInputs;
  productMix: ProductMix;
  developmentUse?: ProjectUse | 'Retail';
  basementCount: number;
  surfaceParking?: number;
  parkingEfficiencySqmPerSpace?: number;
  overrides: ManualOverride[];
}

export interface ProjectRecord {
  info: ProjectInfo;
  scenarios: Scenario[];
  activeScenarioId: string;
  versions: ProjectVersion[];
  changeLog: ChangeLogEntry[];
  regulationSnapshots: RegulationPack[];
}

export interface ProjectVersion {
  id: string;
  label: string;
  createdAt: string;
  notes?: string;
}

export interface ChangeLogEntry {
  id: string;
  date: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  reason: string;
}

export interface DevelopmentEnvelope {
  calculatedArea?: number;
  areaDifference?: number;
  plotArea: number;
  plotLength: number;
  plotWidth: number;
  geometricFootprint: number;
  coverageLimit: number;
  finalFootprint: number;
  permittedGfa: number;
  achievedGfa: number;
  unusedGfa: number;
  achievedFar: number;
  farUtilization: number;
  farSource: FarSourceType;
  farHowCalculated: string;
  floorAreas: FloorAreaResult[];
  controllingConstraint: string;
  warnings: string[];
  setbacks: { front: number | null; right: number | null; left: number | null; rear: number | null };
  regulatoryViolations: string[];
}

export interface FloorAreaResult {
  floor: string;
  coverageLimit: number;
  geometryLimit: number;
  zoneLimit: number;
  farLimit: number;
  finalAllowedArea: number;
}

export interface DevelopmentOutputs {
  footprint: number;
  groundFloorArea: number;
  firstFloorArea: number;
  typicalFloorArea: number;
  roofAnnexArea: number;
  aboveGroundBuiltUpArea: number;
  gfa: number;
  basementArea: number;
  sellableResidential: number;
  sellableRetail: number;
  sellableOffice: number;
  units: number;
  villas: number;
}

export interface ParkingResult {
  requiredSpaces: number;
  autoSurfaceParking: number;
  surfaceParkingMode: 'AUTO' | 'MANUAL';
  parkingLayout: 'ANGLED_45' | 'PERPENDICULAR' | 'NOT_APPLICABLE';
  spacesPerBasement: number;
  basementCountRequired: number;
  providedBasements: number;
  surfaceParking: number;
  providedSpaces: number;
  balance: number;
  effectiveCapacityRatio: number;
  status: 'OK' | 'SHORTAGE' | 'ASSUMPTION';
  warnings: string[];
}

export interface FinancialResult {
  landCost: number;
  constructionCost: number;
  softCosts: number;
  totalCost: number;
  revenue: number;
  profit: number;
  profitMargin: number;
  roi: number;
  monthlyCashFlow: CashFlowRow[];
  peakFunding: number;
  breakEvenMonth: number | null;
  irr: number | null;
  npv: number;
}

export interface CashFlowRow {
  month: number;
  cost: number;
  revenue: number;
  net: number;
  cumulative: number;
}

export interface ScenarioResult {
  envelope: DevelopmentEnvelope;
  outputs: DevelopmentOutputs;
  parking: ParkingResult;
  financial: FinancialResult;
  decision: DecisionResult;
  insights: string[];
}

export interface DecisionResult {
  status: DecisionStatus;
  label: LocalizedText;
  reasons: LocalizedText[];
}

export interface AppSettings {
  language: LanguageMode;
  reportLanguage: LanguageMode;
  theme: ThemeMode;
  appLockEnabled: boolean;
  autoBackup: boolean;
  startWithWindows: boolean;
}

export interface CompanyProfile {
  companyNameAr: string;
  companyNameEn: string;
  logoDataUrl?: string;
  crNumber?: string;
  vatNumber?: string;
  addressAr?: string;
  addressEn?: string;
  phone?: string;
  email?: string;
  website?: string;
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface AppStateFile {
  settings: AppSettings;
  company: CompanyProfile;
  projects: ProjectRecord[];
  regulations: RegulationPack[];
}

export interface DiagnosticsInfo {
  appVersion: string;
  databasePath: string;
  userDataPath: string;
  regulationPackVersion: string;
  reportOutputPath: string;
  logPath: string;
  electronVersion: string;
}

export interface ExportWriteResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

declare global {
  interface Window {
    desktopAPI: {
      loadState: () => Promise<AppStateFile>;
      saveState: (state: AppStateFile) => Promise<{ ok: boolean }>;
      diagnostics: () => Promise<DiagnosticsInfo>;
      exportBackup: (state: AppStateFile) => Promise<string>;
      importBackup: () => Promise<AppStateFile | null>;
      selectLogo: () => Promise<{ dataUrl: string; filePath: string } | null>;
      writeExport: (fileName: string, bytes: number[]) => Promise<ExportWriteResult>;
      openPath: (target: string) => Promise<void>;
    };
    saudiDevelopIQ?: Window['desktopAPI'];
  }
}
