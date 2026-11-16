/** Read-only structural bridge over the EXISTING bank and curated reader.
 * A legacy concept is an authored alignment group, not a multilingual lexeme.
 * No graph edge writes learner evidence, and no morphology is inferred here.
 */
import * as G from './nabu-graph.js';
import * as X from './nabu-content.js';
import {GRAPH_INTEGRITY} from './nabu-structure-data.js';

export const STRUCTURE_SCHEMA_VERSION = 1;
const clone = value => structuredClone(value);
const record = value => !!value && typeof value === 'object' && !Array.isArray(value);
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
const registry=freeze(clone(GRAPH_INTEGRITY));
const flags=new Map(registry.entryFlags.map(item=>[item.conceptId,item]));
const draftKinds=new Set(['authored-catalogue','authored-content','authored-fixture','user-provided']);
const sourceKinds=new Set([...draftKinds,'lexical-reference','attestation','generated','external-import']);
const checkedKinds=new Set(['lexical-reference','attestation']);
const boundedText=(value,max=2000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
const sourceList=value=>Array.isArray(value)?value:record(value)?[value]:[];
function issue(code,message){return {code,message};}
function result(eligible,code,reason,extra={}){
 return {eligible,code,reason,reviewStatus:'unknown',attested:false,humanReviewed:false,issues:[],provenance:[],...extra};
}

/** Exact NFC surface identity, language scoped. Lookup tolerance is not identity.
 * Identical surfaces can link to several alignments; they are not merged senses.
 */
export function surfaceFormId(text,language){
 if(!G.LANGUAGES.includes(language)||!boundedText(text,10000))throw Error('A form needs a supported language and nonempty surface.');
 return 'form:'+language+':'+encodeURIComponent(text.normalize('NFC'));
}
function alignmentId(id){return 'alignment:'+id;}
function catalogueSource(c,locator=''){
 return {
  sourceId:'nabu-bank:'+c.id,lineageId:'nabu-bank:'+c.id,kind:'authored-catalogue',
  sourcePath:c.kind?'data/phrasebank-source.json':'data/wordgraph-source.json',recordId:c.id,
  locator:locator||c.id,reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false,
  notice:'Authored alignment and examples; not independently native-reviewed.'
 };
}
function mediaSource(item,locator=''){
 return {
  sourceId:'nabu-explore:'+item.id+'@'+item.version,lineageId:'nabu-explore:'+item.id+'@'+item.version,
  kind:'authored-content',sourcePath:'data/explore.json',recordId:item.id,version:item.version,
  locator:locator||item.id,reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false,
  notice:item.editorialStatus
 };
}
function usageId(c,language,kind){return 'usage:bank:'+c.id+':'+language+':'+kind;}
function usageIds(c,language){return ['example','reply'].filter(k=>c.details?.[k==='example'?'examples':'replies']?.[language]).map(k=>usageId(c,language,k));}

export function classifyKnownEntry(conceptId,language){
 const base={known:false,legacyConceptId:typeof conceptId==='string'?conceptId:null,language:typeof language==='string'?language:null,kind:null,form:null,alignmentId:null,lexemeId:null,senseId:null,usageIds:[],patternApplicationIds:[],requiresContext:false};
 if(!G.LANGUAGES.includes(language))return result(false,'unsupported-language','This language is not in the existing Nabu bank.',base);
 const c=G.concept(conceptId);
 if(!c)return result(false,'unknown-entry','This identifier is not an existing Nabu catalogue entry. No lexical or pattern claim is made.',base);
 const flag=flags.get(c.id),provenance=[catalogueSource(c)],issues=flag?[issue(flag.code,flag.reason)]:[];
 return result(!flag?.requiresContext,flag?.requiresContext?'context-required':'authored-draft',
  flag?.requiresContext?flag.reason:'Available as an authored, unreviewed entry; it is not an attested or independently validated lexical analysis.',{
   ...base,known:true,kind:c.kind||'word',form:{id:surfaceFormId(c.terms[language],language),type:'form',language,text:c.terms[language]},
   alignmentId:alignmentId(c.id),reviewStatus:flag?.reviewStatus||'authored-unreviewed',
   usageIds:usageIds(c,language),requiresContext:!!flag?.requiresContext,issues,provenance,
   gloss:c.sense,posHint:c.pos||null,posScope:'legacy entry hint; not a language-specific grammatical analysis'
  });
}

export function candidateEligibility(conceptId,sourceLang,targetLang){
 const source=classifyKnownEntry(conceptId,sourceLang);
 if(!source.known||!G.LANGUAGES.includes(sourceLang))return {...source,sourceLang,targetLang};
 if(!G.LANGUAGES.includes(targetLang))return result(false,'unsupported-language','The target language is not in the existing Nabu bank.',{...source,eligible:false,code:'unsupported-language',reason:'The target language is not in the existing Nabu bank.',sourceLang,targetLang});
 if(sourceLang===targetLang)return {...source,eligible:false,code:'same-language-pair',reason:'Choose two different bank languages for a translation recommendation.',sourceLang,targetLang};
 const target=classifyKnownEntry(conceptId,targetLang);
 return {...source,sourceLang,targetLang,targetForm:target.form,relation:'authored-translation-alignment',automaticEvidenceTransfer:false};
}

/** Preserve every matching entry. A single catalogue result still does not prove
 * that the surface has only one sense outside this small bank. */
export function lookupGraphForms(text,language){
 if(!G.LANGUAGES.includes(language)||typeof text!=='string')return {status:'unsupported',candidates:[]};
 const candidates=G.lookup(text,language).map(c=>classifyKnownEntry(c.id,language));
 return {status:candidates.length>1?'ambiguous':candidates.length?'catalogue-match':'missing',candidates,exhaustiveLexicon:false};
}

export function graphIntegrityRegistry(){return clone(registry);}

/** Lineage groups are provenance buckets, NOT proof of statistical independence.
 * Several suffixes/outputs from one application/source stay in the same bucket.
 * Unattributed items are grouped together rather than counted as fresh sources.
 */
export function groupEvidenceBySource(evidence=[]){
 if(!Array.isArray(evidence)||evidence.length>10000)throw Error('Evidence must be a bounded list.');
 const groups=new Map();let unattributedCount=0;
 for(const item of evidence){
  if(!record(item))throw Error('Each evidence item needs an object.');
  const lineage=[item.lineageId,item.sourceLineageId,item.derivationLineageId,item.parentSourceId,item.sourceId].find(x=>boundedText(x,500));
  const application=boundedText(item.applicationId,500)?item.applicationId:null;
  const key=lineage?'source:'+lineage:application?'unattributed-application:'+application:'unattributed';if(!lineage)unattributedCount++;
  if(!groups.has(key))groups.set(key,{lineageId:lineage||null,sourceIds:[],items:[]});
  const group=groups.get(key);if(boundedText(item.sourceId,500)&&!group.sourceIds.includes(item.sourceId))group.sourceIds.push(item.sourceId);
  group.items.push(clone(item));
 }
 return {groups:[...groups.values()],sourceLineageCount:[...groups.values()].filter(g=>g.lineageId!==null).length,unattributedCount,independenceEstablished:false};
}

function traceableSource(p){return record(p)&&boundedText(p.sourceId,500)&&boundedText(p.lineageId,500)&&boundedText(p.locator,1000)&&sourceKinds.has(p.kind);}
function lexicalVerification(form,language){return typeof form==='string'?registry.lexicalVerifications.find(x=>x.language===language&&x.form===form.normalize('NFC'))||null:null;}
function quarantineFor(options,provenance){
 return registry.externalImportIssues.find(entry=>{
  if(options.quarantineRecordId===entry.id)return true;
  const sameSource=options.sourceId===entry.sourceId||options.sourceDocument===entry.sourceDocument||provenance.some(p=>p?.sourceId===entry.sourceId||p?.sourceDocument===entry.sourceDocument);
  if(!sameSource)return false;
  if(options.sourceRecordId===entry.id||provenance.some(p=>p?.recordId===entry.id))return true;
  const texts=entry.observations.flatMap(x=>[x.exactText,x.extractedRowText]).filter(Boolean);
  if(texts.includes(options.rawOutput))return true;
  const inputs=[options.inputForm,...(Array.isArray(options.inputs)?options.inputs.map(x=>x?.form):[])];
  const outputs=[options.form,options.outputForm,...(Array.isArray(options.outputs)?options.outputs.map(x=>x?.form):[])];
  const actual=entry.observations.find(x=>x.actualOutput)?.actualOutput;
  return options.patternId===entry.patternId&&inputs.includes(entry.inputForm)&&!!actual&&outputs.includes(actual);
 })||null;
}

/** This gate evaluates supplied provenance, not a web request or linguistic
 * oracle. A boolean "attested" is insufficient. Lexical listing and corpus
 * attestation are reported separately; neither validates an entire paradigm.
 */
export function generatedCandidateEligibility(options={}){
 if(!record(options))return result(false,'unknown-quality','Structural quality information is unavailable.');
 const provenance=sourceList(options.provenance).filter(record),quarantine=quarantineFor(options,provenance);
 const lexical=lexicalVerification(options.form,options.language);
 const extras={dictionaryListed:!!lexical,lexicalStatus:lexical?.lexicalStatus||null,patternApplicationVerified:false,provenance:clone(provenance),humanReviewed:false,attested:false};
 if(quarantine||['quarantined','needs_verification'].includes(options.status))return result(false,'quarantined-record',quarantine?.reason||'This source record requires verification before it can support a new recommendation.',{...extras,reviewStatus:'needs_verification',quarantineRecordId:quarantine?.id||null,issues:[issue('source-record-needs-verification',quarantine?.reason||'The supplied record is quarantined.')]});
 const declared=provenance.filter(p=>traceableSource(p)&&checkedKinds.has(p.kind)&&p.verificationStatus==='verified'&&p.supportsForm===true&&boundedText(options.form,10000)&&p.form===options.form&&p.language===options.language&&G.LANGUAGES.includes(options.language));
 const dictionarySources=lexical?lexical.provenance:[];
 const corpus=declared.filter(p=>p.kind==='attestation');
 if(corpus.length)return result(true,'declared-form-attestation','The supplied verified source record supports this exact form. Contextual meaning, frequency and the full pattern application remain separate questions.',{...extras,reviewStatus:'form-attestation-supplied',attested:true,provenance:clone([...provenance,...dictionarySources]),evidenceVerification:'caller-supplied record; not independently fetched by this adapter'});
 if((declared.some(p=>p.kind==='lexical-reference')||lexical)&&!['unknown','unattested'].includes(options.status))return result(true,'dictionary-listed-form','This form is dictionary-listed. This does not establish corpus frequency, contextual meaning or the supplied pattern application.',{...extras,dictionaryListed:true,reviewStatus:'dictionary-listed-form-only',provenance:clone([...provenance,...dictionarySources]),attested:false});
 if(['draft','authored-unreviewed'].includes(options.status)&&provenance.some(p=>traceableSource(p)&&draftKinds.has(p.kind)))return result(true,'authored-draft','Available only as an authored, unreviewed example; no attestation or learner benefit is asserted.',{...extras,reviewStatus:'authored-unreviewed'});
 if(lexical)return result(false,'application-evidence-required','The surface is dictionary-listed; the supplied application or contextual claim still needs its own evidence.',{...extras,reviewStatus:'application-unverified',provenance:clone([...provenance,...dictionarySources])});
 return result(false,options.status==='generated'?'generated-unverified':options.status==='unattested'?'unattested':'unknown-quality','No form-specific verified source or traceable authored example supports this structural recommendation.',{...extras,reviewStatus:options.status==='generated'?'generated-unverified':'unknown'});
}

/** Build a bounded, typed view without rewriting the legacy graph. Only actual
 * authored examples and exact source anchors become usage nodes. Empty concept
 * links in the reader remain empty; matching glosses never create a new edge.
 */
export function structureSlice({conceptIds=[],languages=G.LANGUAGES,mediaRefs=[],includeUsages=true}={}){
 if(!Array.isArray(conceptIds)||conceptIds.length>100||!Array.isArray(languages)||languages.length>12||languages.some(l=>!G.LANGUAGES.includes(l))||!Array.isArray(mediaRefs)||mediaRefs.length>20)throw Error('Choose at most 100 entries, 12 supported languages and 20 media references.');
 const nodes=new Map(),edges=[],issues=[];
 const add=node=>{
  const previous=nodes.get(node.id);if(previous&&previous.type!==node.type)throw Error('Typed graph ID collision.');
  if(!previous)nodes.set(node.id,node);
  else for(const p of node.provenance||[])if(!previous.provenance.some(old=>old.sourceId===p.sourceId&&old.locator===p.locator))previous.provenance.push(clone(p));
  return node.id;
 };
 const edge=(from,to,type,provenance,extra={})=>edges.push({from,to,type,provenance:clone(provenance),automaticEvidenceTransfer:false,...extra});
 const form=(text,language,provenance)=>add({id:surfaceFormId(text,language),type:'form',language,text:text.normalize('NFC'),lexemeId:null,senseIds:[],provenance:clone(provenance)});
 for(const id of [...new Set(conceptIds)]){
  const c=G.concept(id);if(!c){issues.push(issue('unknown-entry','Unknown catalogue entry: '+String(id)));continue;}
  const source=catalogueSource(c),flag=flags.get(id),alignment=add({id:alignmentId(id),type:'alignment',legacyConceptId:id,kind:c.kind||'word',gloss:c.sense,category:c.category,reviewStatus:flag?'review-needed':'authored-unreviewed',humanReviewed:false,attested:false,requiresContext:!!flag,provenance:[source]});
  if(flag)issues.push({...issue(flag.code,flag.reason),legacyConceptId:id});
  for(const language of [...new Set(languages)]){
   const forms=[{text:c.terms[language],type:'listed-term'},...(c.aliases[language]||[]).map(text=>({text,type:'listed-alias'}))];
   if(c.meaningTerms&&c.meaningTerms[language]!==c.terms[language])forms.push({text:c.meaningTerms[language],type:'authored-meaning-rendering'});
   if(c.literalTerms)forms.push({text:c.literalTerms[language],type:'authored-literal-rendering'});
   const seen=new Set();for(const listed of forms){const fid=form(listed.text,language,[source]),key=fid+'|'+listed.type;if(seen.has(key))continue;seen.add(key);edge(fid,alignment,listed.type,[source],{requiresContext:!!flag});}
   if(includeUsages)for(const kind of ['example','reply']){
    const text=c.details?.[kind==='example'?'examples':'replies']?.[language];if(!text)continue;
    const provenance=[catalogueSource(c,'concepts.'+id+'.details.'+(kind==='example'?'examples':'replies')+'.'+language)];
    const uid=add({id:usageId(c,language,kind),type:'usage',usageKind:'authored-'+kind,language,text,lexemeId:null,senseId:null,reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false,provenance});
    edge(uid,alignment,'authored-example-for-alignment',provenance);
   }
  }
 }
 for(const ref of mediaRefs){
  if(!record(ref)||typeof ref.id!=='string'||!Number.isInteger(ref.version)||ref.version<1)throw Error('A media reference needs an ID and integer version.');
  const item=X.itemById(ref.id,ref.version);if(!item){issues.push(issue('unknown-media','Unknown media reference: '+ref.id+'@'+ref.version));continue;}
  const mid=add({id:'media:explore:'+item.id+'@'+item.version,type:'media',contentId:item.id,version:item.version,language:item.language,format:item.format,title:item.title,reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false,sourceReferences:clone(item.sourceReferences),rights:clone(item.rights),provenance:[mediaSource(item)]});
  if(includeUsages)for(const annotation of item.annotations){
   const segment=item.segments.find(s=>s.id===annotation.segmentId),quote=segment?Array.from(segment.text).slice(annotation.start,annotation.end).join(''):null;
   if(quote!==annotation.quote){issues.push(issue('invalid-source-anchor','Annotation '+item.id+'/'+annotation.id+' did not match the source.'));continue;}
   const provenance=[mediaSource(item,'annotations.'+annotation.id)],fid=form(annotation.quote,item.language,provenance);
   const uid=add({id:'usage:explore:'+item.id+'@'+item.version+':'+annotation.id,type:'usage',usageKind:'anchored-authored-interpretation',language:item.language,text:annotation.quote,meaning:annotation.meaning,meaningLanguage:item.translationLanguage,usage:annotation.usage,lexemeId:null,senseId:null,legacyConceptId:annotation.conceptId||null,anchor:{contentId:item.id,version:item.version,segmentId:annotation.segmentId,start:annotation.start,end:annotation.end,indexConvention:'Unicode scalar values',quote:annotation.quote,prefix:annotation.prefix,suffix:annotation.suffix},reviewStatus:'authored-unreviewed',humanReviewed:false,attested:false,provenance});
   edge(uid,mid,'occurs-in-source',provenance);edge(uid,fid,'has-surface',provenance);
   // There are currently no authored bank links in these annotations. Never
   // invent one from an English gloss or a fuzzy surface match.
  }
 }
 return {schemaVersion:1,policyVersion:registry.policyVersion,nodes:[...nodes.values()],edges,issues,capabilities:{legacyAlignments:true,exactSurfaceForms:true,authoredUsages:true,sourceAnchors:true,lexemeInventory:false,lexicalSenseInventory:false,productionPatternApplications:false},evidencePolicy:clone(registry.evidencePolicy)};
}

function requiredString(value,name,max=500){if(!boundedText(value,max))throw Error(name+' must be nonempty bounded text.');return value;}
function validateFeatures(value,depth=0){
 if(!record(value)||depth>3||Object.keys(value).length>40)throw Error('Features must be a bounded explicit object.');
 for(const [key,entry] of Object.entries(value)){
  requiredString(key,'Feature name',80);
  if(entry===null||typeof entry==='boolean')continue;
  if(typeof entry==='number'&&Number.isFinite(entry))continue;
  if(typeof entry==='string'&&entry.length<=500)continue;
  if(record(entry)){validateFeatures(entry,depth+1);continue;}
  if(Array.isArray(entry)&&entry.length<=20&&entry.every(x=>x===null||typeof x==='boolean'||typeof x==='number'&&Number.isFinite(x)||typeof x==='string'&&x.length<=200))continue;
  throw Error('Unsupported grammatical feature value.');
 }
 return clone(value);
}
function validateApplicationAnalysis(value,name){
 if(!record(value))throw Error(name+' must be a full application object.');
 requiredString(value.id,name+' ID');requiredString(value.patternId,name+' pattern ID');
 if(!G.LANGUAGES.includes(value.language))throw Error('Application language must be supported.');
 for(const key of ['inputs','outputs']){
  if(!Array.isArray(value[key])||value[key].length<1||value[key].length>32)throw Error('A full application needs bounded inputs and outputs.');
  const ids=new Set();for(const part of value[key]){
   if(!record(part))throw Error('Each input and output needs its complete form and features.');
   requiredString(part.id,'Input/output ID');if(ids.has(part.id))throw Error('Duplicate input/output ID.');ids.add(part.id);
   requiredString(part.form,'Input/output form',2000);
   if(!G.LANGUAGES.includes(part.language))throw Error('Every input/output form needs its language.');
   validateFeatures(part.features);
  }
 }
 validateFeatures(value.features);
 if(!Array.isArray(value.provenance)||!value.provenance.length||value.provenance.length>50||value.provenance.some(p=>!traceableSource(p)))throw Error('A full application needs traceable source provenance and lineage.');
 return clone(value);
}

/** Shape validation does not establish grammaticality, productivity, attestation
 * or uniqueness of an analysis. Shipped production morphology remains empty.
 */
export function validatePatternApplication(input){
 const value=validateApplicationAnalysis(input,'Pattern application');
 if(!['generated','authored-unreviewed','verified','quarantined','needs_verification'].includes(value.status))throw Error('Declare the application review status.');
 if(typeof value.fixtureOnly!=='boolean')throw Error('Declare whether this application is a fixture.');
 if(!Array.isArray(value.competingAnalyses)||value.competingAnalyses.length>20)throw Error('Include competing analyses explicitly, even when none are supplied.');
 const ids=new Set([value.id]);value.competingAnalyses=value.competingAnalyses.map(alt=>{
  const checked=validateApplicationAnalysis(alt,'Competing analysis');if(ids.has(checked.id))throw Error('Application and competing-analysis IDs must be distinct.');ids.add(checked.id);return checked;
 });
 const groups=groupEvidenceBySource([...value.provenance,...value.competingAnalyses.flatMap(a=>a.provenance)]);
 const quarantine=quarantineFor(value,value.provenance);
 return {...value,type:'pattern-application',validation:{shapeValid:true,linguisticCorrectness:'not-checked',evidenceUnit:'whole-application',sourceLineageCount:groups.sourceLineageCount,independenceEstablished:false},quarantine:quarantine?{id:quarantine.id,status:quarantine.status,reason:quarantine.reason}:null};
}
