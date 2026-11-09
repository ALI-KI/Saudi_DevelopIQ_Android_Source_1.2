import { LanguageMode, LocalizedText } from '../shared/types';

export const L = (text: LocalizedText, mode: LanguageMode): string => {
  if (mode === 'ar') return text.ar;
  if (mode === 'en') return text.en;
  return `${text.ar} | ${text.en}`;
};

export const dirFor = (mode: LanguageMode): 'rtl' | 'ltr' => (mode === 'en' ? 'ltr' : 'rtl');

export const t = (key: string, mode: LanguageMode): string => {
  const dict: Record<string, LocalizedText> = {
    newStudy: { ar: 'دراسة جديدة', en: 'New Study' },
    projects: { ar: 'المشروعات', en: 'Projects' },
    regulationLibrary: { ar: 'أنظمة البناء', en: 'Regulation Library' },
    templates: { ar: 'قوالب الدراسة', en: 'Study Templates' },
    company: { ar: 'إعدادات الشركة', en: 'Company Profile' },
    backup: { ar: 'النسخ الاحتياطي', en: 'Backup' },
    settings: { ar: 'الإعدادات', en: 'Settings' },
    about: { ar: 'حول البرنامج', en: 'About' },
    overview: { ar: 'نظرة عامة', en: 'Overview' },
    plot: { ar: 'الأرض', en: 'Plot' },
    regulation: { ar: 'نظام البناء', en: 'Regulation' },
    development: { ar: 'التطوير', en: 'Development' },
    parking: { ar: 'المواقف', en: 'Parking' },
    financial: { ar: 'المالية', en: 'Financial' },
    scenarios: { ar: 'السيناريوهات', en: 'Scenarios' },
    reports: { ar: 'التقارير', en: 'Reports' },
    history: { ar: 'السجل', en: 'History' },
    export: { ar: 'تصدير', en: 'Export' },
    save: { ar: 'حفظ', en: 'Save' }
  };
  return L(dict[key] ?? { ar: key, en: key }, mode);
};
