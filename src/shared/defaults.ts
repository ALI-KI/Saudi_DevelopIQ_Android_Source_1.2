import { AppSettings, CompanyProfile, FinancialInputs, PlotData, ProductMix } from './types';

export const defaultSettings: AppSettings = {
  language: 'ar',
  reportLanguage: 'bi',
  theme: 'system',
  appLockEnabled: false,
  autoBackup: false,
  startWithWindows: false
};

export const defaultCompany: CompanyProfile = {
  companyNameAr: 'شركة التطوير العقاري',
  companyNameEn: 'Real Estate Development Company',
  preparedBy: 'Mahmoud Elgamsy',
  reviewedBy: '',
  approvedBy: '',
  primaryColor: '#176B5B',
  secondaryColor: '#C8A24A'
};

export const defaultPlot: PlotData = {
  officialArea: 900,
  length: 30,
  width: 30,
  accuracy: 'Approximate',
  boundaries: [
    { side: 'front', type: 'Street', width: 20 },
    { side: 'right', type: 'Neighbor' },
    { side: 'left', type: 'Neighbor' },
    { side: 'rear', type: 'Neighbor' }
  ]
};

export const defaultFinancial: FinancialInputs = {
  landPrice: 3000,
  structuralRate: 1450,
  finishingRate: 950,
  mepRate: 650,
  basementRate: 1850,
  sellingPriceResidential: 6200,
  sellingPriceRetail: 9000,
  sellingPriceOffice: 7600,
  sellableEfficiencyResidential: 0.82,
  sellableEfficiencyRetail: 0.88,
  sellableEfficiencyOffice: 0.78,
  mode: 'SALE',
  rentResidential: 450,
  rentRetail: 1200,
  rentOffice: 900,
  occupancyPercent: 0.9,
  opexPercent: 0.15,
  capRate: 0.08,
  rettPercent: 0,
  constructionVatPercent: 0,
  marketingPercent: 0.015,
  salesCommissionPercent: 0.025,
  contingencyPercent: 0.06
};

export const defaultProductMix: ProductMix = {
  averageUnitArea: 145,
  averageVillaPlotArea: 300,
  residentialShare: 0.8,
  retailShare: 0.1,
  officeShare: 0.1
};
