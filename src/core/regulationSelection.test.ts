import { describe, expect, it } from 'vitest';
import { demoRegulationPack, userReferenceRegulationPacks } from '../data/demoRegulations';
import { defaultPlot, defaultFinancial, defaultProductMix } from '../shared/defaults';
import type { ProjectInfo, Scenario, RegulationPack } from '../shared/types';
import { assessRegulation, evidenceValid, parcelIdentified, parcelKey, plotSignature, validateEvidence } from './regulationSelection';
import { runScenario } from './engines';

const info: ProjectInfo = {id:'p',name:'Plot Study',city:'Riyadh',district:'المروج',planNumber:'123',plotNumber:'45',use:'Residential Apartments',status:'Draft',updatedAt:'2026-11-09'};
const scenario: Scenario = {id:'s',name:'base',regulationId:'',plot:defaultPlot,financial:defaultFinancial,productMix:{...defaultProductMix,residentialShare:1,retailShare:0,officeShare:0},developmentUse:'Residential Apartments',basementCount:1,overrides:[]};
const reg = userReferenceRegulationPacks.find(r=>r.applicableUses.includes('Residential Apartments'))!;
const evidence={ documentReference:'قرار مساحي رقم 123/45',applicabilityReason:'النظام مذكور في خطاب الجهة المختصة للقطعة 45',precedenceReason:'المستند الخاص بهذه القطعة يحسم انطباقه دون الأنظمة العامة',reviewer:'مراجع الدراسة'};
function documented(r:RegulationPack):Scenario {
 return {...scenario,regulationId:r.id,regulationEvidence:{...evidence,regulationId:r.id,regulationVersion:r.version,parcelKey:parcelKey(info),plotSignature:plotSignature(scenario.plot),developmentUse:scenario.developmentUse!,recordedAt:'2026-11-09',status:'USER_DOCUMENTED'}};
}

describe('Regulation applicability and anti-shopping safeguards',()=>{
 it('does not treat city or district matching as verified applicability',()=>{
   const c=assessRegulation(reg,info,scenario.developmentUse!);
   expect(c.status).toBe('LOCATION_UNCONFIRMED');
   expect(c.locationMatched).toBe(false);
 });
 it('excludes use mismatch and demo packs',()=>{
   const villas=userReferenceRegulationPacks.find(r=>r.applicableUses.length===1 && r.applicableUses[0]==='Residential Villas')!;
   expect(assessRegulation(villas,info,'Residential Apartments').status).toBe('EXCLUDED');
   expect(assessRegulation(demoRegulationPack,info,'Residential Apartments').status).toBe('EXCLUDED');
 });
 it('applies explicit plan and district restrictions, excluding wrong plot',()=>{
   const restricted:RegulationPack={...reg,applicabilityScope:{kind:'SPECIAL',districts:['المروج'],planNumbers:['123'],plotNumbers:['45']}};
   expect(assessRegulation(restricted,info,'Residential Apartments').status).toBe('POSSIBLE');
   expect(assessRegulation(restricted,{...info,plotNumber:'46'},'Residential Apartments').status).toBe('EXCLUDED');
 });
 it('requires parcel identity and parcel-specific evidence, not arbitrary selection',()=>{
   expect(parcelIdentified(info)).toBe(true);
   expect(parcelIdentified({...info,planNumber:'',plotNumber:'',deedNumber:''})).toBe(false);
   expect(validateEvidence(reg,info,scenario,{...evidence,documentReference:''},true)).not.toHaveLength(0);
   expect(validateEvidence(reg,info,scenario,{...evidence,precedenceReason:''},true).some(e=>e.includes('أولوية'))).toBe(true);
   expect(validateEvidence(reg,info,scenario,evidence,true)).toHaveLength(0);
 });
 it('blocks a general rule when a verified parcel-matched special rule explicitly supersedes it',()=>{
   const general:RegulationPack={...reg,id:'GENERAL-123',applicabilityScope:{kind:'GENERAL'}};
   const special:RegulationPack={...reg,id:'SPECIAL-123',code:'SPECIAL123',verificationStatus:'VERIFIED',applicabilityScope:{kind:'SPECIAL',districts:['المروج'],planNumbers:['123'],plotNumbers:['45'],supersedesPackIds:['GENERAL-123']}};
   const issues=validateEvidence(general,info,scenario,evidence,true,[general,special]);
   expect(issues.some(v=>v.includes('إحلالًا'))).toBe(true);
 });
 it('rejects evidence when the plot, use, version or regulation changes',()=>{
   const s=documented(reg);
   expect(evidenceValid(s,reg)).toBe(true);
   expect(evidenceValid({...s,plot:{...s.plot,officialArea:1100}},reg)).toBe(false);
   expect(evidenceValid({...s,developmentUse:'Retail'},reg)).toBe(false);
   expect(evidenceValid(s,{...reg,version:'different'})).toBe(false);
   expect(evidenceValid({...s,regulationId:'arbitrary'},reg)).toBe(false);
   // A new regulation may have a similar snapshot. Evidence is bound to the
   // selected pack id, never only to the supplied pack object.
   expect(evidenceValid(s,{...reg,id:'replacement'})).toBe(false);
   // Explicit parcel metadata must match the captured evidence too.
   expect(evidenceValid(s,reg,info)).toBe(true);
   expect(evidenceValid(s,reg,{...info,plotNumber:'different'})).toBe(false);
   expect(evidenceValid({...s,regulationEvidence:{...s.regulationEvidence!,regulationId:'arbitrary'}},reg)).toBe(false);
 });
 it('invalidates parcel evidence if a scenario switches regulations',()=>{
   const verified=documented(reg);
   expect(evidenceValid(verified,reg,info)).toBe(true);
   expect(evidenceValid({...verified,regulationId:'new-regulation-id'},reg,info)).toBe(false);
 });
 it('invalidates parcel evidence when the plan, plot or use changes',()=>{
   const verified=documented(reg);
   expect(evidenceValid(verified,reg,{...info,planNumber:'999'})).toBe(false);
   expect(evidenceValid(verified,reg,{...info,plotNumber:'999'})).toBe(false);
   expect(evidenceValid(verified,reg,{...info,use:'Retail'})).toBe(false);
 });
 it('never treats a demo regulation as valid documentary evidence',()=>{
   const demoDocumented=documented(demoRegulationPack);
   expect(evidenceValid(demoDocumented,demoRegulationPack)).toBe(false);
 });
 it('never returns an endorsed proceed decision for undocumented or user-documented regulation',()=>{
   const result0=runScenario({...scenario,regulationId:reg.id},reg);
   const result1=runScenario(documented(reg),reg);
   expect(result0.decision.status).toBe('RECONSIDER');
   expect(result1.decision.status).toBe('RECONSIDER');
   expect(result1.decision.label.ar).toContain('مبدئية');
 });
});
