import { create } from 'zustand';
import { parcelKey, plotSignature } from '../core/regulationSelection';
import { demoRegulationPack, regulationLibrarySeed } from '../data/demoRegulations';
import { defaultCompany, defaultFinancial, defaultPlot, defaultProductMix, defaultSettings } from '../shared/defaults';
import { AppStateFile, ProjectRecord, ProjectUse, RegulationPack, Scenario } from '../shared/types';

const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const api = () => {
  if (!window.desktopAPI) throw new Error('desktopAPI preload bridge is not available.');
  return window.desktopAPI;
};

export interface AppStore extends AppStateFile {
  activeProjectId: string | null;
  activeView: string;
  hydrated: boolean;
  storageError: string | null;
  setActiveView: (view: string) => void;
  setActiveProject: (projectId: string) => void;
  updateSettings: (patch: Partial<AppStateFile['settings']>) => void;
  updateCompany: (patch: Partial<AppStateFile['company']>) => void;
  load: () => Promise<void>;
  persist: () => Promise<void>;
  createProject: (draft?: Partial<ProjectRecord['info']> & { regulationId?: string }) => ProjectRecord;
  openDemoProject: () => ProjectRecord;
  updateProject: (project: ProjectRecord) => void;
  duplicateScenario: (projectId: string, scenarioId: string) => void;
  createCustomRegulation: () => RegulationPack;
  updateRegulation: (regulation: RegulationPack) => void;
  importBackup: () => Promise<boolean>;
  exportBackup: () => Promise<string>;
}

const makeScenario = (regulationId: string, name = 'S01 Residential', developmentUse: Scenario['developmentUse'] = 'Residential Apartments'): Scenario => ({
  id: id('scenario'),
  name,
  regulationId,
  plot: structuredClone(defaultPlot),
  financial: structuredClone(defaultFinancial),
  productMix: structuredClone(defaultProductMix),
  developmentUse,
  basementCount: 1,
  surfaceParking: undefined,
  parkingEfficiencySqmPerSpace: 30,
  overrides: []
});

const makeDemoProject = (regulation: RegulationPack): ProjectRecord => {
  const regulationId = regulation.id;
  const scenario = makeScenario(regulationId);
  return {
    info: {
      id: id('project'),
      name: 'Demo Residential Project',
      city: 'Riyadh',
      district: 'Demo District',
      location: 'Riyadh',
      owner: 'Demo Owner',
      use: 'Residential Apartments',
      status: 'Draft',
      updatedAt: new Date().toISOString()
    },
    scenarios: [scenario],
    activeScenarioId: scenario.id,
    versions: [{ id: id('version'), label: 'V01 Initial Study', createdAt: new Date().toISOString(), notes: 'Demo only' }],
    changeLog: [],
    regulationSnapshots: [structuredClone(regulation)]
  };
};

export const useAppStore = create<AppStore>((set, get) => ({
  settings: defaultSettings,
  company: defaultCompany,
  projects: [],
  regulations: regulationLibrarySeed,
  activeProjectId: null,
  activeView: 'home',
  hydrated: false,
  storageError: null,
  setActiveView: (view) => set({ activeView: view }),
  setActiveProject: (projectId) => set({ activeProjectId: projectId }),
  updateSettings: (patch) => {
    set({ settings: { ...get().settings, ...patch } });
    void get().persist().catch(() => undefined);
  },
  updateCompany: (patch) => {
    set({ company: { ...get().company, ...patch } });
    void get().persist().catch(() => undefined);
  },
  load: async () => {
    const loaded = await api().loadState();
    const existing = loaded?.regulations ?? [];
    const missingSeeds = regulationLibrarySeed.filter((seed) => !existing.some((reg) => reg.id === seed.id));
    const regulations = [...existing.filter((reg) => reg.verificationStatus !== 'DEMO_ONLY'), ...missingSeeds];
    const projects = loaded?.projects ?? [];
    set({
      settings: loaded?.settings ?? defaultSettings,
      company: loaded?.company ?? defaultCompany,
      regulations,
      projects,
      activeProjectId: projects[0]?.info.id ?? null,
      hydrated: true
    });
    await get().persist();
  },
  persist: async () => {
    const { settings, company, projects, regulations } = get();
    try {
      await api().saveState({ settings, company, projects, regulations });
      set({ storageError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ storageError: message });
      throw error;
    }
  },
  createProject: (draft) => {
    // New studies must establish their applicable regulation AFTER the plot is identified.
    const regulation = undefined;
    const scenario = makeScenario(regulation?.id ?? '', 'S01 Base Study', (draft?.use ?? 'Residential Apartments') as Scenario['developmentUse']);
    scenario.plot = { ...structuredClone(defaultPlot), officialArea: 0, length: 0, width: 0, accuracy: 'Area Only', boundaries: defaultPlot.boundaries.map(b => ({ ...b, type: 'Other' as const, width: undefined, streetRole: undefined })) };
    const use = scenario.developmentUse;
    scenario.productMix = use === 'Residential + Retail' ? { ...scenario.productMix, residentialShare: 0.75, retailShare: 0.25, officeShare: 0 } :
      use === 'Retail + Office' ? { ...scenario.productMix, residentialShare: 0, retailShare: 0.5, officeShare: 0.5 } :
      use === 'Retail' || use === 'Commercial' ? { ...scenario.productMix, residentialShare: 0, retailShare: 1, officeShare: 0 } :
      use === 'Office' ? { ...scenario.productMix, residentialShare: 0, retailShare: 0, officeShare: 1 } :
      { ...scenario.productMix, residentialShare: 1, retailShare: 0, officeShare: 0 };
    const project: ProjectRecord = {
      info: {
        id: id('project'),
        name: draft?.name ?? 'New Riyadh Study',
        city: 'Riyadh',
        district: draft?.district ?? 'Riyadh',
        location: draft?.location,
        owner: draft?.owner,
        use: (draft?.use ?? 'Residential Apartments') as ProjectUse,
        status: 'Draft',
        updatedAt: new Date().toISOString()
      },
      scenarios: [scenario],
      activeScenarioId: scenario.id,
      versions: [{ id: id('version'), label: 'V01 Initial Study', createdAt: new Date().toISOString() }],
      changeLog: [],
      regulationSnapshots: regulation ? [regulation] : []
    };
    set({ projects: [project, ...get().projects], activeProjectId: project.info.id, activeView: 'plot' });
    void get().persist().catch(() => undefined);
    return project;
  },
  openDemoProject: () => {
    const existing = get().projects.find((p) => p.info.name === 'Demo Residential Project');
    if (existing) {
      set({ activeProjectId: existing.info.id, activeView: 'overview' });
      return existing;
    }
    const project = makeDemoProject(get().regulations[0] ?? demoRegulationPack);
    set({ projects: [project, ...get().projects], activeProjectId: project.info.id, activeView: 'overview' });
    void get().persist().catch(() => undefined);
    return project;
  },
  updateProject: (project) => {
    const current = get().projects.find((p) => p.info.id === project.info.id);
    const identityChanged = Boolean(current && parcelKey(current.info) !== parcelKey(project.info));
    const scenarios = project.scenarios.map((s) => {
      const old = current?.scenarios.find((v) => v.id === s.id);
      const changed = identityChanged || Boolean(old && (plotSignature(old.plot) !== plotSignature(s.plot) || old.developmentUse !== s.developmentUse));
      return changed && s.regulationEvidence ? { ...s, regulationEvidence: undefined } : s;
    });
    const updated = { ...project, scenarios, info: { ...project.info, updatedAt: new Date().toISOString() } };
    set({ projects: get().projects.map((p) => (p.info.id === updated.info.id ? updated : p)) });
    void get().persist().catch(() => undefined);
  },
  duplicateScenario: (projectId, scenarioId) => {
    const projects = get().projects.map((project) => {
      if (project.info.id !== projectId) return project;
      const source = project.scenarios.find((scenario) => scenario.id === scenarioId);
      if (!source) return project;
      const copy = { ...structuredClone(source), id: id('scenario'), name: `${source.name} Copy` };
      return { ...project, scenarios: [...project.scenarios, copy], activeScenarioId: copy.id };
    });
    set({ projects });
    void get().persist().catch(() => undefined);
  },
  createCustomRegulation: () => {
    const custom = structuredClone(regulationLibrarySeed[0] ?? demoRegulationPack);
    custom.id = id('custom_reg');
    custom.code = 'CUSTOM';
    custom.name = { ar: 'نظام مخصص', en: 'Custom Regulation' };
    custom.verificationStatus = 'USER_REFERENCE_CALCULABLE';
    custom.calculationReady = true;
    custom.source = 'User Supplied';
    custom.sourceReference = 'Manual custom copy';
    set({ regulations: [custom, ...get().regulations], activeView: 'regulations' });
    void get().persist().catch(() => undefined);
    return custom;
  },
  updateRegulation: (regulation) => {
    const updated = {
      ...regulation,
      version: regulation.version || 'user-edited',
      verificationDate: new Date().toISOString(),
      source: regulation.source === 'User supplied reference' ? 'User edited reference' : regulation.source,
      sourceReference: regulation.sourceReference || 'User edited regulation pack'
    };
    set({ regulations: get().regulations.map((item) => item.id === updated.id ? updated : item) });
    void get().persist().catch(() => undefined);
  },
  exportBackup: async () => {
    const { settings, company, projects, regulations } = get();
    return await api().exportBackup({ settings, company, projects, regulations });
  },
  importBackup: async () => {
    const state = await api().importBackup();
    if (!state) return false;
    set({ ...state, activeProjectId: state.projects[0]?.info.id ?? null });
    await get().persist();
    return true;
  }
}));
