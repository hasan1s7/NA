/** Versioned, authored task mappings for the learner model.
 * This module supplies a small reviewed-by-code, NOT independently linguistically
 * reviewed task set. A task label is an explicit modeling assumption, not a
 * finding that its components are identified by one response.
 */
import {LANGUAGES,concept,normalizeWord} from './nabu-graph.js';
import {CONTRAST_KEYS,contrastTask} from './nabu-evidence-tasks.js';
import {classifyKnownEntry,graphIntegrityRegistry} from './nabu-structure.js';

export const LEARNER_TASK_VERSION = 1;
export const LEARNER_TASK_POLICY = 'authored-learner-tasks-v1';
export const LEARNER_TASK_SOURCES = Object.freeze({
  ar:'https://openbooks.lib.msu.edu/arb201/chapter/5-2-grammar-in-context/',
  en:'https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/passives',
  enIrregular:'https://learnenglish.britishcouncil.org/free-resources/grammar/english-grammar-reference/irregular-verbs',
  es:'https://www.spanishdict.com/guide/past-participle-in-spanish',
  escrito:'https://dle.rae.es/escrito',
  abierto:'https://dle.rae.es/abierto'
});
const copy=value=>structuredClone(value);
const scope='Only the exact authored prompt, reading, input/output mode, choices and recorded assistance. The model components are hypotheses, not a diagnosis from a single answer.';
const quality='AI-assisted authored task; not independently instructor-reviewed, corpus-attested, or validated as a measure of ability. References support the grammatical description or lexical form, not this task or a learning effect.';
const kindNames={meaning:'Check the base meaning','base-recall':'Recall the base verb',reading:'Check this meaning in context',pattern:'Apply the form operation',retrieval:'Recall the result form'};

function fingerprint(value){let h=2166136261;for(const c of JSON.stringify(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');}
function reference(id,version,provenance){return {id,version,status:'authored',provenance:copy(provenance)};}
function component(id,kind,transferGroup=null){return {id,kind,transferGroup};}
function rootComponent(row){return component('root:'+row.language+':'+row.key,'root');}
function patternComponent(row){return row.pattern?component('pattern:'+row.language+':'+row.pattern,'pattern'):null;}

// Complete attested forms, not a string-transformation generator. Exceptions
// remain lexical-memory tasks and never join a generic "irregular" pattern.
const LEXEMES=[
  {language:'ar',key:'write',base:'كَتَبَ',root:'ك ت ب',form:'مَكْتُوب',action:'put words into writing',result:'expressed in writing',reading:'written-text',pattern:'sound-form-I-passive-maful',context:'النص مكتوب بالعربية.',baseInstruction:'the Arabic past-tense dictionary form',formInstruction:'the masculine singular Arabic passive participle (اسم المفعول)',rule:'For the supported sound Form I roots in this task set, the masculine singular passive participle follows مَفْعُول. This cue does not apply to every Arabic verb.',sources:[LEARNER_TASK_SOURCES.ar]},
  {language:'ar',key:'open',base:'فَتَحَ',root:'ف ت ح',form:'مَفْتُوح',action:'make something open',result:'open rather than closed',reading:'open-door',pattern:'sound-form-I-passive-maful',context:'الباب مفتوح.',baseInstruction:'the Arabic past-tense dictionary form',formInstruction:'the masculine singular Arabic passive participle (اسم المفعول)',rule:'For the supported sound Form I roots in this task set, the masculine singular passive participle follows مَفْعُول. This cue does not apply to every Arabic verb.',sources:[LEARNER_TASK_SOURCES.ar]},
  {language:'en',key:'write',base:'write',root:'write',form:'written',action:'put words into writing',result:'expressed in writing',reading:'written-text',pattern:null,context:'The message was written by hand.',baseInstruction:'the English base verb',formInstruction:'the English past participle',rule:null,sources:[LEARNER_TASK_SOURCES.en,LEARNER_TASK_SOURCES.enIrregular]},
  {language:'en',key:'open',base:'open',root:'open',form:'opened',action:'make something open',result:'made open',reading:'opened-package',pattern:'regular-past-participle-ed',context:'The package has been opened.',baseInstruction:'the English base verb',formInstruction:'the English past participle',rule:'These supported English verbs form their past participle by adding -ed to the supplied base. This is a cue for this regular class, not for irregular verbs.',sources:[LEARNER_TASK_SOURCES.en]},
  {language:'en',key:'wash',base:'wash',root:'wash',form:'washed',action:'clean something with water',result:'cleaned with water',reading:'washed-object',pattern:'regular-past-participle-ed',context:'The shirt has been washed.',baseInstruction:'the English base verb',formInstruction:'the English past participle',rule:'These supported English verbs form their past participle by adding -ed to the supplied base. This is a cue for this regular class, not for irregular verbs.',sources:[LEARNER_TASK_SOURCES.en]},
  {language:'es',key:'write',base:'escribir',root:'escrib-',form:'escrito',action:'put words into writing',result:'expressed in writing',reading:'written-text',pattern:null,context:'El mensaje está escrito en árabe.',baseInstruction:'the Spanish infinitive',formInstruction:'the masculine singular Spanish past participle',rule:null,sources:[LEARNER_TASK_SOURCES.es,LEARNER_TASK_SOURCES.escrito]},
  {language:'es',key:'open',base:'abrir',root:'abr-',form:'abierto',action:'make something open',result:'open rather than closed',reading:'open-package',pattern:null,context:'El paquete está abierto.',baseInstruction:'the Spanish infinitive',formInstruction:'the masculine singular Spanish past participle',rule:null,sources:[LEARNER_TASK_SOURCES.es,LEARNER_TASK_SOURCES.abierto]},
  {language:'es',key:'close',base:'cerrar',root:'cerr-',form:'cerrado',action:'make something closed',result:'closed rather than open',reading:'closed-shop',pattern:'regular-ar-participle-ado',context:'El negocio está cerrado.',baseInstruction:'the Spanish infinitive',formInstruction:'the masculine singular Spanish past participle',rule:'For the supported regular -ar participles here, remove -ar from the infinitive and add -ado. This cue does not produce the exceptional participles of escribir or abrir.',sources:[LEARNER_TASK_SOURCES.es]},
  {language:'es',key:'wash',base:'lavar',root:'lav-',form:'lavado',action:'clean something with water',result:'cleaned with water',reading:'washed-object',pattern:'regular-ar-participle-ado',context:'El coche está lavado.',baseInstruction:'the Spanish infinitive',formInstruction:'the masculine singular Spanish past participle',rule:'For the supported regular -ar participles here, remove -ar from the infinitive and add -ado. This cue does not produce the exceptional participles of escribir or abrir.',sources:[LEARNER_TASK_SOURCES.es]}
];
function choices(answer,alternatives,offset){const distractors=alternatives.filter(x=>x!==answer).slice(0,2),options=[...distractors];options.splice(offset%3,0,answer);return {options,answer:offset%3};}
function lexicalDrafts(row,index){
  const baseId='learner:'+row.language+':'+row.key,root=rootComponent(row),pattern=patternComponent(row),memoryKey='form:'+row.language+':'+row.key+':'+row.reading;
  const baseFormKey='base:'+row.language+':'+row.key;
  const meaning=component('meaning:'+row.language+':'+row.reading,'meaning',row.reading==='written-text'?'literal-reading:written-text':null);
  const localReading=component('lexical-reading:'+row.language+':'+row.key+':'+row.reading,'root');
  const rootSupport={componentId:root.id,text:'The base is '+row.base+', meaning “'+row.action+'”.',seconds:20,exposedFormKeys:[baseFormKey]};
  const patternSupport=pattern?{componentId:pattern.id,text:row.rule,seconds:20,exposedFormKeys:[]}:null;
  const common={language:row.language,lexeme:row.key,rootLabel:row.root,reading:row.reading,contextSentence:row.context,sources:row.sources,lexicalException:!pattern,answerScope:'An exact word-form task; a different correct paraphrase is outside this narrow rubric.'};
  const specs=[
    {key:'meaning',prompt:'In this verb reading, what does '+row.base+' mean?',...choices(row.action,['put words into writing','make something open','clean something with water','make something closed'],index),practiceMode:'recognition',dimension:'visual-recognition',components:[root],memory:false,cues:['The base form and three English meaning choices are visible.'],componentSupport:[]},
    {key:'base-recall',prompt:'Give '+row.baseInstruction+' meaning “'+row.action+'”. Enter only the verb.',accepted:[row.base],practiceMode:'production',dimension:'retrieval',components:[root],memory:false,cues:['The English lexical meaning and required dictionary form are supplied.'],componentSupport:[]},
    {key:'reading',prompt:'In “'+row.context+'”, what does '+row.form+' mean here?',...choices(row.result,['expressed in writing','cleaned with water','closed rather than open','made open','open rather than closed'],index+1),practiceMode:'recognition',dimension:'visual-recognition',components:[meaning,localReading],memory:false,cues:['The form, a context sentence and three English meaning choices are visible.'],componentSupport:[]},
    {key:'pattern',title:pattern?kindNames.pattern:'Recall this exceptional form',prompt:'The base '+row.base+' means “'+row.action+'”. Give '+row.formInstruction+'. Enter only that form.',accepted:[row.form],practiceMode:'production',dimension:'retrieval',components:pattern?[pattern]:[],memory:true,memoryKey,requiredAssistance:{baseMeaningSupplied:true},cues:['The base form, its meaning and the requested form operation are supplied.'],componentSupport:pattern?[patternSupport]:[]},
    {key:'retrieval',prompt:'Give '+row.formInstruction+' for the action “'+row.action+'”. Enter only that form.',accepted:[row.form],practiceMode:'production',dimension:'retrieval',components:pattern?[root,pattern]:[],memory:true,memoryKey,cues:['The English lexical meaning and the requested result-form category are supplied; the source-language base is not shown.'],componentSupport:pattern?[rootSupport,patternSupport]:[]}
  ];
  const actionLabel={write:'writing',open:'opening',wash:'washing',close:'closing'}[row.key];
  return specs.map(spec=>{
    const promptFormKeys=['meaning','pattern'].includes(spec.key)?[baseFormKey]:spec.key==='reading'?[memoryKey]:[];
    const responseFormKey=spec.options?null:spec.key==='base-recall'?baseFormKey:memoryKey;
    const feedbackFormKeys=[...new Set([...promptFormKeys,...(['meaning','base-recall'].includes(spec.key)?[baseFormKey]:[memoryKey])])];
    return {...common,...spec,id:baseId+':'+spec.key,title:(spec.title||kindNames[spec.key])+' · '+(['meaning','reading'].includes(spec.key)?'verb '+(index+1):actionLabel),responseFormKey,promptFormKeys,feedbackFormKeys,explanation:spec.key==='meaning'||spec.key==='base-recall'?row.base+' is the authored base for “'+row.action+'”.':row.form+' is the authored form in this reading. '+(pattern?'This form is included in the explicitly bounded '+row.pattern+' family.':'This is a lexical exception: no shared irregular-form rule is inferred.'),contextKey:baseId+':'+spec.key+':'+row.reading};
  });
}

const BANK_ITEMS=[
  {id:'food.water',key:'water',meaning:'the ordinary clear liquid people drink',distractors:['a baked food made mainly from flour','a room used for sleeping']},
  {id:'food.bread',key:'bread',meaning:'a baked food made mainly from flour',distractors:['the ordinary clear liquid people drink','a vehicle that travels on rails']}
];
const bankIntegrity=graphIntegrityRegistry();
function bankDrafts(){return LANGUAGES.flatMap(language=>BANK_ITEMS.flatMap((entry,index)=>{
  const item=concept(entry.id),term=item?.terms?.[language],eligibility=classifyKnownEntry(entry.id,language),cueEligibility=classifyKnownEntry(entry.id,'en');
  if(!term||!eligibility.eligible||!cueEligibility.eligible||eligibility.requiresContext||!['authored-unreviewed','verified'].includes(eligibility.reviewStatus))return [];
  const id='learner:bank:'+language+':'+entry.key,meaning=component('meaning:'+language+':bank:'+entry.id,'meaning','bank-reading:'+entry.id),lexical=component('lexical-form:'+language+':bank:'+entry.id,'root');
  const common={language,lexeme:'bank:'+entry.id,rootLabel:null,reading:'bank:'+entry.id,contextSentence:null,sources:[],sourceBank:{conceptId:item.id,term,aliases:[...(item.aliases?.[language]||[])],sourceIds:eligibility.provenance.map(p=>p.sourceId),integrityPolicy:bankIntegrity.policyVersion,eligibilityCode:eligibility.code,reviewStatus:eligibility.reviewStatus},lexicalException:false,answerScope:'Only the bundled authored bank term or its declared aliases for this sense; no morphology is inferred.',memory:false,componentSupport:[],qualityNote:'Uses the existing authored vocabulary bank and its declared aliases. It has not been independently native-reviewed. The root-kind component is an item-specific lexical-form gate, not an asserted morphological root. Semantic alignment never supplies knowledge of the local word form.'};
  return [
    {...common,id:id+':meaning',key:'bank-meaning',title:'Recognize a useful word · item '+(index+1),prompt:'What does “'+term+'” mean in this vocabulary reading?',...choices(entry.meaning,entry.distractors,index),practiceMode:'recognition',dimension:'visual-recognition',components:[meaning,lexical],responseFormKey:null,promptFormKeys:[lexical.id],feedbackFormKeys:[lexical.id],cues:['The target-language word and three English definitions are visible.'],explanation:term+' is the authored bank term for '+entry.meaning+'.',contextKey:id+':meaning'},
    {...common,id:id+':retrieval',key:'bank-retrieval',title:'Recall a useful word · '+(entry.key==='water'?'drinking liquid':'baked food'),prompt:'Give the usual '+language+' word for '+entry.meaning+'. Enter only the word.',accepted:[term,...(item.aliases?.[language]||[])],practiceMode:'production',dimension:'retrieval',components:[lexical],responseFormKey:lexical.id,promptFormKeys:[],feedbackFormKeys:[lexical.id],cues:['An English definition supplies the intended semantic content. The target-language lexical form is not shown.'],explanation:'The authored bank answer is '+term+'. Declared aliases are also accepted; other variants require review.',contextKey:id+':retrieval'}
  ];
}));}

const DRAFTS=[...LEXEMES.flatMap(lexicalDrafts),...bankDrafts()];
const byId=new Map(DRAFTS.map(task=>[task.id,task]));

function makeTask(draft){
  const t=copy(draft),ownSource={sourceId:'nabu:authored-learner-tasks-v1',locator:t.id,kind:'authored-draft'};
  const provenance=[ownSource,...t.sources.map(sourceId=>({sourceId,locator:t.language==='ar'?'Grammar 2: passive participle; bounded strong Form I examples':'Past participle description or lexical entry',kind:'reference-not-item-attestation'}))];
  if(t.sourceBank){
    provenance.push({sourceId:t.sourceBank.sourceIds[0]||'nabu:authored-wordgraph-bank',locator:'concepts/'+t.sourceBank.conceptId+'/terms/'+t.language,kind:'authored-bank-snapshot'});
    provenance.push({sourceId:'nabu:'+t.sourceBank.integrityPolicy,locator:t.sourceBank.conceptId+'/'+t.language,kind:'eligibility-policy-not-linguistic-validation'});
  }
  const outputModality=t.options?'choice':'text',version=LEARNER_TASK_VERSION,contentId='learner-lab:'+t.language;
  const task={...t,version,target:{id:t.id+':target',language:t.language},inputModality:'text',outputModality,assessmentScope:scope,
    occurrence:{contentId,version,segmentId:t.lexeme,annotationId:t.key,readingId:t.reading,context:{lexicalId:'learner:'+t.language+':'+t.lexeme,senseId:t.reading,speakerId:null,syntaxId:t.id+':syntax',contextId:t.contextKey}},
    requiredAssistance:t.requiredAssistance||{},baseMeaningSupplied:t.requiredAssistance?.baseMeaningSupplied===true,
    rubricRef:reference('rubric:'+t.id,fingerprint({prompt:t.prompt,options:t.options,answer:t.answer,accepted:t.accepted}),provenance),
    scorerRef:reference(t.options?'nabu:learner-authored-choice':'nabu:learner-exact-word-form','v1',provenance),
    analysisRef:reference('analysis:'+t.id,fingerprint({components:t.components,reading:t.reading,exception:t.lexicalException,memory:t.memory,sourceBank:t.sourceBank,componentSupport:t.componentSupport,responseFormKey:t.responseFormKey,promptFormKeys:t.promptFormKeys,feedbackFormKeys:t.feedbackFormKeys}),provenance),
    qualityNote:t.qualityNote||quality,
    modelAssumptions:{guess:t.options?1/t.options.length:.01,slip:.05,difficulty:0,calibration:'Declared initial nuisance values; not fitted to people or evidence of measurement validity.'}
  };
  task.score=response=>{
    if(task.options&&(!Number.isInteger(response?.choice)||response.choice<0||response.choice>=task.options.length))return {correct:null,label:'The response is outside the displayed choices.',scope};
    if(!task.options&&(typeof response?.answer!=='string'||!response.answer.trim()))return {correct:null,label:'No assessable word-form response was supplied.',scope};
    const correct=task.options?response.choice===task.answer:task.accepted.some(a=>normalizeWord(a,task.language)===normalizeWord(response.answer,task.language));
    return {correct,label:correct?'Matched the authored task answer.':'Did not match the authored task answer; this is not a diagnosis of the cause.',scope};
  };
  return task;
}

export function listLearnerTasks({language,mode}={}){return DRAFTS.filter(t=>(!language||t.language===language)&&(!mode||t.practiceMode===mode)).map(makeTask);}
export function learnerTask(id){const draft=byId.get(id);return draft?makeTask(draft):null;}
export function resolveLearnerTask(ref,event=null){
  if(!ref)return null;const task=learnerTask(ref.id);if(!task||task.version!==ref.version)return null;
  if(event){const actual=event.evidence?.occurrence,expected=task.occurrence;if(!actual||['contentId','version','segmentId','annotationId','readingId'].some(key=>actual[key]!==expected[key])||Object.keys(expected.context).some(key=>actual.context?.[key]!==expected.context[key]))return null;}
  return task;
}

function contrastModel(task){
  if(!task?.id?.startsWith('contrast:'))return null;const key=task.id.slice(9),current=contrastTask(key);if(!current||task.version!==current.version)return null;
  const base=key.split('-')[0],root=component('root:ar:'+base,'root');
  let components=[],memory=false,memoryKey=null;
  if(['take-meaning','open-meaning'].includes(key))components=[root];
  else if(['take-female','open-female','write-female'].includes(key)){components=[component('pattern:ar:singular-feminine-imperative','pattern')];memory=true;memoryKey='form:ar:'+base+':feminine-command';}
  else if(key==='take-male'){components=[component('pattern:ar:singular-masculine-imperative-from-feminine','pattern')];memory=true;memoryKey='form:ar:take:masculine-command';}
  else if(['phrase-now','phrase-later'].includes(key)){memory=true;memoryKey='form:ar:take-your-time:feminine-reassurance';}
  else return null;
  return {id:current.id,version:current.version,language:'ar',mode:current.practiceMode,components,guess:current.options?1/current.options.length:.01,slip:.05,difficulty:0,memory,memoryKey,contextKey:current.occurrence.context.contextId};
}

/** Return only a maintained explicit mapping. Unknown catalogue tasks remain raw
 * evidence; task names or graph adjacency never manufacture components. */
export function modelTask(task){
  const draft=task&&byId.get(task.id);if(!draft)return contrastModel(task);if(task.version!==LEARNER_TASK_VERSION)return null;
  return {id:draft.id,version:LEARNER_TASK_VERSION,language:draft.language,mode:draft.practiceMode,components:copy(draft.components),guess:draft.options?1/draft.options.length:.01,slip:.05,difficulty:0,memory:!!draft.memory,memoryKey:draft.memoryKey||null,contextKey:draft.contextKey};
}

/** This permits a specific conditioned likelihood, never unaided credit. */
export function permitsMeaningSuppliedEvidence(task){
  const maintained=task?.id?.startsWith('learner:')?learnerTask(task.id):task?.id?.startsWith('contrast:')?contrastTask(task.id.slice(9)):null;
  if(!maintained||maintained.version!==task.version||!maintained.requiredAssistance?.baseMeaningSupplied)return false;
  const model=modelTask(maintained);
  return !!model&&model.components.every(c=>c.kind==='pattern');
}

export function mappedContrastTasks(){return CONTRAST_KEYS.map(contrastTask).filter(t=>modelTask(t));}

/** Exact lexical forms visibly supplied by this maintained task. Generic hint
 * events cannot identify a selected component cue, so hint metadata conservatively
 * unions its possible declared cues. Cross-language semantic groups are not keys. */
export function taskExposure(task){
  const draft=task&&byId.get(task.id);
  if(draft&&task.version===LEARNER_TASK_VERSION)return copy({responseFormKey:draft.responseFormKey,promptFormKeys:draft.promptFormKeys,feedbackFormKeys:draft.feedbackFormKeys,
    hintComponentIds:[...new Set((draft.componentSupport||[]).map(cue=>cue.componentId))],hintFormKeys:[...new Set((draft.componentSupport||[]).flatMap(cue=>cue.exposedFormKeys||[]))]});
  const model=contrastModel(task);if(!model)return null;
  const key=task.id.slice(9),base=key.split('-')[0],masculine='form:ar:'+base+':masculine-command',feminine='form:ar:'+base+':feminine-command';
  const noComponentCues={hintComponentIds:[],hintFormKeys:[]};
  if(['take-meaning','open-meaning'].includes(key))return {...noComponentCues,responseFormKey:null,promptFormKeys:[masculine],feedbackFormKeys:[masculine]};
  if(['take-female','open-female','write-female'].includes(key))return {...noComponentCues,responseFormKey:feminine,promptFormKeys:[masculine],feedbackFormKeys:[masculine,feminine]};
  if(key==='take-male')return {...noComponentCues,responseFormKey:masculine,promptFormKeys:[feminine],feedbackFormKeys:[masculine,feminine]};
  return {...noComponentCues,responseFormKey:model.memoryKey,promptFormKeys:[],feedbackFormKeys:[model.memoryKey]};
}
