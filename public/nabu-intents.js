/** Intent is declared planning context, never learner evidence.
 * The local parser is deliberately bounded. Unsupported text stays verbatim,
 * with unknown fields, rather than becoming an invented goal or language.
 */
import * as C from './nabu-core.js';

export const INTENT_SCHEMA_VERSION = 1;
export const INTENT_PARSER_VERSION = 'local-intent-v1';
export const INTENT_FIELDS = Object.freeze(['immediateActivity','destination','timeHorizon','languages','modalities','sourceContent','context','constraints','preferences']);
export const INTENT_STATUSES = Object.freeze(['active','paused','completed','abandoned']);
export const INTENT_OBJECTIVES = Object.freeze(['explicit','inferred','exploratory','unknown']);
export const INTENT_MODALITIES = Object.freeze(['reading','listening','speaking','writing','watching']);
const SOURCES = ['user_text','user_edit','local_parser','provider','reader_context','none'];
const LIMITS = {rawText:1200,immediateActivity:1200,destination:400,timeHorizon:120,context:500};
const clone = value => structuredClone(value);
const present = value => value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
function string(value,name,max,{nullable=false,verbatim=false}={}){
 if(nullable&&value===null)return null;
 if(typeof value!=='string')throw Error(`${name} must be text.`);
 if(value.length>max)throw Error(`${name} must be ${max} characters or fewer.`);
 if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value))throw Error(`${name} contains unsupported control characters.`);
 return verbatim?value:value.trim()||null;
}
function list(value,name,allowed=null){
 if(!Array.isArray(value)||value.length>12)throw Error(`${name} must contain at most 12 values.`);
 const result=value.map(x=>string(x,name,200));
 if(result.some(x=>!x)||new Set(result).size!==result.length)throw Error(`${name} contains an empty or repeated value.`);
 if(allowed&&result.some(x=>!allowed.includes(x)))throw Error(`Unsupported ${name.toLowerCase()}.`);
 return result;
}
function emptyProvenance(parser=INTENT_PARSER_VERSION){
 return {parser,fields:Object.fromEntries(INTENT_FIELDS.map(field=>[field,{status:'unknown',source:'none'}]))};
}
function setField(content,field,value,{status='explicit',source='local_parser',evidence}={}){
 content[field]=value;
 content.provenance.fields[field]=present(value)?{status,source,...(evidence?{evidence}:{})}:{status:'unknown',source:'none'};
}

/** An unsaved form draft only. validateIntentContent rejects this until the
 * learner supplies an activity/statement; skipping creates no record. */
export function emptyIntentContent(){
 return {rawText:'',immediateActivity:null,destination:null,timeHorizon:null,languages:[],modalities:[],sourceContent:null,context:null,constraints:[],preferences:[],objectiveStatus:'unknown',status:'active',provenance:emptyProvenance()};
}

export function validateIntentContent(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid intent.');
 const result={};
 for(const field of Object.keys(LIMITS))result[field]=string(input[field],field,LIMITS[field],{nullable:field!=='rawText',verbatim:field==='rawText'});
 if(!result.rawText.trim()&&!result.immediateActivity)throw Error('Enter what you want to do, or choose Skip and explore.');
 result.languages=list(input.languages,'Languages',C.LANGUAGES.map(x=>x[0]));
 result.modalities=list(input.modalities,'Modalities',INTENT_MODALITIES);
 result.constraints=list(input.constraints,'Constraints');
 result.preferences=list(input.preferences,'Preferences');
 if(input.sourceContent===null)result.sourceContent=null;
 else{
  const s=input.sourceContent;
  if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).some(k=>!['id','version'].includes(k)))throw Error('Use a source reference, not a copy of the media.');
  const id=string(s.id,'Source reference',160),version=s.version===null?null:string(s.version,'Source version',80);
  if(!id)throw Error('Source reference is required.');
  result.sourceContent={id,version};
 }
 if(!INTENT_OBJECTIVES.includes(input.objectiveStatus))throw Error('Choose an explicit, inferred, exploratory, or unknown objective.');
 if(!INTENT_STATUSES.includes(input.status))throw Error('Unknown intent status.');
 result.objectiveStatus=input.objectiveStatus;result.status=input.status;
 const p=input.provenance;
 if(!p||typeof p!=='object'||!p.fields||typeof p.fields!=='object'||Array.isArray(p.fields))throw Error('Intent field provenance is required.');
 const parser=string(p.parser,'Parser version',80);
 if(!parser||Object.keys(p.fields).length!==INTENT_FIELDS.length||Object.keys(p.fields).some(k=>!INTENT_FIELDS.includes(k)))throw Error('Invalid intent field provenance.');
 result.provenance={parser,fields:{}};
 for(const field of INTENT_FIELDS){
  const detail=p.fields[field];
  if(!detail||typeof detail!=='object'||Array.isArray(detail)||Object.keys(detail).some(k=>!['status','source','evidence'].includes(k)))throw Error('Invalid provenance for '+field+'.');
  if(!INTENT_OBJECTIVES.includes(detail.status)||!SOURCES.includes(detail.source))throw Error('Invalid provenance for '+field+'.');
  if(detail.source==='provider'&&detail.status!=='inferred')throw Error('Provider suggestions must remain inferred until the learner confirms them.');
  const populated=present(result[field]);
  if(!populated&&(detail.status!=='unknown'||detail.source!=='none'||detail.evidence))throw Error('Unknown fields must remain unknown.');
  if(populated&&(detail.status==='unknown'||detail.source==='none'||(detail.status==='exploratory'&&field!=='immediateActivity')))throw Error('Populated fields need explicit or inferred provenance.');
  const evidence=detail.evidence==null?null:string(detail.evidence,'Evidence',1200);
  result.provenance.fields[field]={status:detail.status,source:detail.source,...(evidence?{evidence}:{})};
 }
 return result;
}

export function parseIntentLocal(rawText,{sourceContent=null}={}){
 const raw=string(rawText,'Intent',1200,{verbatim:true});
 if(!raw.trim())throw Error('Enter what you want to do, or choose Skip and explore.');
 const t=raw.trim();
 const result={...emptyIntentContent(),rawText:raw};
 // We do not resolve relative dates, relationship details, proficiency, or
 // nationality into structured facts. In particular, Mexican != Spanish.
 const withoutGoal=/\b(?:no (?:particular )?(?:end )?goal|without (?:a |any )?(?:particular )?(?:end )?goal)\b/iu;
 const uncertain=/\b(?:maybe|perhaps|possibly|not sure|something|anything)\b/iu.test(t);
 const negative=/\b(?:not|don['’]t|do not|never|avoid|without|no|cannot|can['’]t|won['’]t|doesn['’]t|isn['’]t|instead of|rather than)\b/iu.test(t.replace(withoutGoal,''));
 const desire=/^(?:(?:I|we) (?:want|need|hope|plan|would like)|I['’]d like|(?:my|our) team (?:wants|needs|hopes|plans)) to \S/iu;
 const ongoing=/^(?:(?:I am|I['’]m|we are|we['’]re|(?:my|our) team is) (?:reading|listening|speaking|writing|watching|meeting|exploring|practi[cs]ing))\s+\S/iu;
 const direct=/^(?:understand|explore|read|listen|speak|write|watch|meet|practi[cs]e|quiero)\s+\S/iu;
 const stated=desire.test(t)||ongoing.test(t)||direct.test(t)||/^(?:أريد|أرغب|استكشف)\s+\S/u.test(t);
 if(stated&&!uncertain&&!negative){
  let activity=t;
  const marker=/\s+(?:so that|with (?:a |the )?goal of)\s+(.+?)[.!]?$/iu.exec(t);
  const impression=/\s+and\s+(make a good impression)[.!]?$/iu.exec(t);
  const destination=marker||impression;
  if(destination&&destination[1].length<=400){activity=t.slice(0,destination.index);setField(result,'destination',destination[1],{evidence:destination[1]});}
  setField(result,'immediateActivity',activity,{source:'user_text'});
  result.objectiveStatus=/\bexplor(?:e|ing|ation)\b/iu.test(t)&&!result.destination?'exploratory':'explicit';
  if(result.objectiveStatus==='exploratory')result.provenance.fields.immediateActivity.status='exploratory';
  // A topic clause describes the media, not another action or language the
  // learner has chosen. Preserve the full statement/activity, but do not turn
  // "an article about speaking French" into a speaking or French intention.
  const extractionText=t.split(/\babout\b/iu,1)[0];
  // Only named languages directly attached to a stated action/content relation.
  // Disjunctions remain unknown; mere mention or the script of text is not a goal.
  if(!/\bor\b/iu.test(extractionText)){
   const languages=[],languageEvidence=[];
   for(const [code,name] of C.LANGUAGES){
    const before=new RegExp('\\b(?:in|learn|learning|study|studying|practi[cs]e|practi[cs]ing|explore|exploring|understand|reading|read|speak|speaking|listen to)\\s+'+name+'\\b','iu');
    const after=new RegExp('\\b'+name+'\\s+(?:poetry|songs?|articles?|paragraphs?|conversations?|customer[- ]support|support|calls?|stories|texts?|videos?|dialogue)\\b','iu');
    const mention=before.exec(extractionText)||after.exec(extractionText);
    if(mention){languages.push(code);languageEvidence.push(mention[0]);}
   }
   if(languages.length)setField(result,'languages',languages,{evidence:languageEvidence.length===1?languageEvidence[0]:undefined});
  }
  const modeMatches=[['reading',/\b(?:read|reading)\b/iu],['listening',/\b(?:listen|listening)\b/iu],['speaking',/\b(?:speak|speaking|conversation|talk|talking)\b/iu],['writing',/\b(?:write|writing)\b/iu],['watching',/\b(?:watch|watching)\b/iu]].map(([mode,pattern])=>({mode,match:pattern.exec(extractionText)})).filter(x=>x.match);
  if(modeMatches.length)setField(result,'modalities',modeMatches.map(x=>x.mode),{evidence:modeMatches.length===1?modeMatches[0].match[0]:undefined});
 }
 if(sourceContent!==null)setField(result,'sourceContent',clone(sourceContent),{source:'reader_context'});
 return validateIntentContent(result);
}

/** A future provider must be passed explicitly AND permitted for this request.
 * No translation/model provider or credential is reused implicitly. A provider
 * result remains inferred, even if it labels its own output "explicit".
 */
export async function parseIntent(rawText,{parser=null,allowExternalParser=false,sourceContent=null}={}){
 const local=parseIntentLocal(rawText,{sourceContent});
 if(!parser||!allowExternalParser)return local;
 try{
  const offered=await parser(rawText);
  if(!offered||typeof offered!=='object')return local;
  const result=clone(local);result.provenance.parser='external-intent-adapter-v1';
  for(const field of INTENT_FIELDS){
   if(field==='sourceContent'||!Object.hasOwn(offered,field)||!present(offered[field])||present(result[field]))continue;
   setField(result,field,clone(offered[field]),{status:'inferred',source:'provider'});
  }
  if(!result.immediateActivity)result.objectiveStatus='unknown';
  else if(result.provenance.fields.immediateActivity.status==='inferred')result.objectiveStatus='inferred';
  return validateIntentContent(result);
 }catch{return local;}
}

export function editIntentContent(content,changes){
 const base=validateIntentContent(content);
 if(!changes||typeof changes!=='object'||Array.isArray(changes))throw Error('Invalid intent edit.');
 const allowed=['rawText',...INTENT_FIELDS,'objectiveStatus','status'];
 if(Object.keys(changes).some(k=>!allowed.includes(k)))throw Error('Intent ownership and provenance cannot be edited directly.');
 // Replacing the original statement invalidates previous extractions. Reapply
 // only the optional fields supplied in this same explicit user edit.
 let result=Object.hasOwn(changes,'rawText')&&changes.rawText!==base.rawText?parseIntentLocal(changes.rawText):clone(base);
 result.status=Object.hasOwn(changes,'status')?changes.status:base.status;
 for(const field of INTENT_FIELDS){
  if(!Object.hasOwn(changes,field))continue;
  let value=clone(changes[field]);
  if(typeof value==='string')value=value.trim()||null;
  setField(result,field,value,{source:'user_edit'});
 }
 if(Object.hasOwn(changes,'objectiveStatus'))result.objectiveStatus=changes.objectiveStatus;
 else if(Object.hasOwn(changes,'immediateActivity'))result.objectiveStatus=result.immediateActivity?'explicit':'unknown';
 if(result.objectiveStatus==='exploratory'&&result.immediateActivity&&result.provenance.fields.immediateActivity.status!=='inferred')result.provenance.fields.immediateActivity.status='exploratory';
 return validateIntentContent(result);
}

export function validateIntentRecord(input){
 if(!input||input.schemaVersion!==1||typeof input.id!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(input.id))throw Error('Invalid intent record.');
 if(typeof input.ownerUserId!=='string'||!input.ownerUserId||!['learner','organization'].includes(input.kind))throw Error('Invalid intent owner.');
 if(input.tenantId!==null&&(typeof input.tenantId!=='string'||!/^[A-Za-z0-9_-]{3,64}$/.test(input.tenantId)))throw Error('Invalid team scope.');
 if(input.kind==='organization'&&!input.tenantId)throw Error('An organization objective requires a team.');
 for(const key of ['createdAt','updatedAt','statusChangedAt'])if(!Number.isSafeInteger(input[key])||input[key]<0)throw Error('Invalid intent timestamp.');
 if(input.updatedAt<input.createdAt||input.statusChangedAt<input.createdAt||input.statusChangedAt>input.updatedAt)throw Error('Invalid intent timestamp order.');
 if(!Number.isSafeInteger(input.revision)||input.revision<1)throw Error('Invalid intent revision.');
 return {schemaVersion:1,id:input.id,ownerUserId:input.ownerUserId,tenantId:input.tenantId,kind:input.kind,...validateIntentContent(input),createdAt:input.createdAt,updatedAt:input.updatedAt,statusChangedAt:input.statusChangedAt,revision:input.revision};
}

export function intentContext(snapshot,{owner='guest',tenantId=null}={}){
 const selection=clone(snapshot.selection||{mode:'none',intentId:null});
 const found=(snapshot.intents||[]).find(x=>x.id===selection.intentId&&x.kind==='learner'&&x.ownerUserId===owner&&x.tenantId===tenantId&&x.status==='active');
 if(selection.mode==='selected'&&!found){selection.mode='none';selection.intentId=null;}
 const objective=snapshot.organizationObjective;
 return {schemaVersion:1,actor:{kind:tenantId?'team':'individual',userId:owner==='guest'||owner==='!locked'?null:owner,tenantId},selection,immediateIntent:selection.mode==='selected'?clone(found):null,organizationObjective:tenantId&&objective?.tenantId===tenantId&&objective.kind==='organization'&&objective.status==='active'?clone(objective):null};
}
