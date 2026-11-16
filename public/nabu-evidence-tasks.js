/** Small authored checks around existing Explore content. No generated forms or
 * graph expansion. These drafts are not corpus attestation or instructor review. */
import * as X from './nabu-content.js';

export const EVIDENCE_TASK_VERSION = 1;
export const CONTRAST_SOURCE = 'https://openbooks.lib.msu.edu/arb201/chapter/4-2-grammar-in-context/';
const clone=value=>structuredClone(value);
const provenance=(locator)=>[{sourceId:'nabu:authored-evidence-contrasts-v1',locator,kind:'authored-draft'},{sourceId:CONTRAST_SOURCE,locator:'Imperatives: regular singular masculine and feminine examples',kind:'grammar-reference-not-item-attestation'}];
const ref=(id,version,source,status='authored')=>({id,version,status,provenance:clone(source)});
function fingerprint(value){let hash=2166136261;for(const c of JSON.stringify(value)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');}
const scope='Only this authored prompt, intended reading, response mode and recorded assistance; no claim about general competence.';
function scorer(task){return response=>{if(task.outputModality==='choice'&&(!Number.isInteger(response?.choice)||response.choice<0||response.choice>=task.options.length))return {correct:null,label:'The response was not one of the offered choices.',scope:task.assessmentScope};if(task.outputModality==='text'&&(typeof response?.answer!=='string'||!response.answer.trim()))return {correct:null,label:'No assessable text response was recorded.',scope:task.assessmentScope};const correct=task.outputModality==='choice'?response.choice===task.answer:task.accepted.some(a=>X.normalizeAnswer(a)===X.normalizeAnswer(response.answer));return {correct,label:correct?'Matched the authored answer.':'Did not match the authored answer.',scope:task.assessmentScope};};}
function occurrence(item,annotation,context={}){return {contentId:item.id,version:item.version,segmentId:annotation?.segmentId||null,annotationId:annotation?.id||null,readingId:annotation?`${item.id}:${annotation.id}:editorial-reading`:null,context:{lexicalId:annotation?.conceptId||null,senseId:annotation?`${item.id}:${annotation.id}:meaning`:null,speakerId:null,syntaxId:annotation?`${item.id}:${annotation.segmentId}:source-syntax`:null,contextId:annotation?`${item.id}:${annotation.segmentId}`:item.id,...context}};}
export function mediaOccurrence(item,annotation=null){return occurrence(item,annotation);}

/** The legacy exercise remains unchanged. New replay refuses a discovered
 * annotation/prompt mismatch rather than attributing an answer to the wrong sense. */
export function catalogueEvidenceTask(item,activityId){
 const activity=item?.practice.find(t=>t.id===activityId);if(!activity)return null;
 const annotation=item.annotations.find(a=>a.id===activity.annotationId);if(!annotation)return null;
 const source=[{sourceId:`nabu:catalogue:${item.id}@${item.version}`,locator:`${annotation.segmentId}/${annotation.id}/${activity.id}`,kind:'authored-editorial-draft'}];
 const mismatched=item.id==='imru-al-qais-stop-and-weep'&&activity.id==='p3';
 const definition={id:`catalog:${item.id}:${activity.id}`,version:item.version,title:activity.mode==='recall'?'Recall this expression':'Understand this expression',prompt:activity.prompt,options:activity.options||null,answer:activity.answer,accepted:activity.accepted||null,explanation:activity.explanation,hint:activity.hint,
  target:{id:`catalog:${item.id}:${annotation.id}:reading`,language:item.language},dimension:activity.mode==='recall'?'retrieval':'visual-recognition',practiceMode:activity.mode==='recall'?'production':'recognition',inputModality:'text',outputModality:activity.mode==='recall'?'text':'choice',assessmentScope:scope,
  occurrence:occurrence(item,annotation,{syntaxId:activity.mode==='related-context'?`${item.id}:${activity.id}:authored-syntax`:`${item.id}:${annotation.segmentId}:source-syntax`}),
  cues:activity.mode==='recall'?['The authored English meaning and task instructions are supplied.']:['The authored prompt and answer choices are visible.'],
  rubricRef:ref(`rubric:catalog:${item.id}:${activity.id}`,fingerprint(activity),source),scorerRef:ref(activity.mode==='recall'?'nabu:arabic-optional-vowels':'nabu:authored-choice','v1',source),
  analysisRef:ref(`analysis:catalog:${item.id}:${annotation.id}`,fingerprint({annotation,prompt:activity.prompt}),source,mismatched?'quarantined':'authored'),
  qualityNote:mismatched?'The p3 prompt asks about the morning of parting, but its annotation reference is a4 (grief). New evidence remains unscored until the mapping is reviewed.':null};
 definition.score=scorer(definition);return definition;
}

const authored=[
 {key:'take-meaning',title:'Check the base meaning',prompt:'In the command خذ, which base meaning is intended?',options:['Take.','Give.','Write.'],answer:0,target:'take:meaning',dimension:'visual-recognition',mode:'recognition',lexical:'take',sense:'take-command',syntax:'isolated-masculine-command',cues:['The command and three meaning choices are visible.'],explanation:'خذ is the masculine singular command “take” in this authored contrast. This checks meaning with choices, not the feminine operation.'},
 {key:'open-meaning',title:'Check another base meaning',prompt:'In the command افتح, which base meaning is intended?',options:['Close.','Open.','Read.'],answer:1,target:'open:meaning',dimension:'visual-recognition',mode:'recognition',lexical:'open',sense:'open-command',syntax:'isolated-masculine-command',cues:['The command and three meaning choices are visible.'],explanation:'افتح is the masculine singular command “open” in this authored contrast.'},
 {key:'take-female',title:'Address one woman',prompt:'Change خذ (“take”, addressed to one man) so that it addresses one woman.',accepted:['خذي'],target:'take:feminine-command',dimension:'retrieval',mode:'production',lexical:'take',sense:'take-command',syntax:'isolated-feminine-command',cues:['The masculine form, meaning and intended addressee are supplied.'],baseMeaningSupplied:true,explanation:'The authored feminine form is خذي. Meaning was supplied, so this does not assess independent base meaning.'},
 {key:'open-female',title:'Use the operation on another supported base',prompt:'Change افتح so that the command addresses one woman.',accepted:['افتحي'],target:'open:feminine-command',dimension:'retrieval',mode:'production',lexical:'open',sense:'open-command',syntax:'isolated-feminine-command',requires:'open-meaning',cues:['The masculine form and intended addressee are supplied.'],explanation:'The authored feminine form is افتحي. Eligibility requires a direct base-meaning response; that response is still limited to its recognition task.'},
 {key:'take-male',title:'Use the same base in the other direction',prompt:'Change خذي so that the command addresses one man.',accepted:['خذ'],target:'take:masculine-command',dimension:'retrieval',mode:'production',lexical:'take',sense:'take-command',syntax:'isolated-masculine-command',cues:['The feminine form and intended addressee are supplied.'],explanation:'The authored masculine form is خذ. The direction and addressee changed; this is a different task, not another count for the feminine form.'},
 {key:'write-female',title:'Try a new base with meaning supplied',prompt:'اكتب means “write” to one man. Change it to address one woman.',accepted:['اكتبي'],target:'write:feminine-command',dimension:'retrieval',mode:'production',lexical:'write',sense:'write-command',syntax:'isolated-feminine-command',baseMeaningSupplied:true,cues:['The base form, its meaning and intended addressee are supplied.'],explanation:'The authored feminine form is اكتبي. Meaning was supplied; this is assisted evidence about this application only.'},
 {key:'phrase-now',title:'Recall the phrase in a message',prompt:'Complete the message to a woman with “take your time”: يا ليلى، ___؛ سأنتظرك هنا.',accepted:['خذي وقتك'],target:'phrase:take-your-time',dimension:'retrieval',mode:'cloze',lexical:'take-your-time',sense:'reassurance',syntax:'vocative-waiting-message',cues:['An English meaning and a sentence with a gap are visible.'],explanation:'The authored completion is خذي وقتك. This assesses the phrase in this particular sentence with its English cue.'},
 {key:'phrase-later',title:'A later check in a changed sentence',prompt:'Complete the message to a woman with “take your time”: لا تستعجلي؛ ___ في اختيار الكتاب.',accepted:['خذي وقتك'],target:'phrase:take-your-time',dimension:'retrieval',mode:'cloze',lexical:'take-your-time',sense:'reassurance',syntax:'negative-imperative-book-choice',laterThan:'phrase-now',cues:['An English meaning and a different sentence with a gap are visible.'],explanation:'The authored completion is خذي وقتك. The surrounding syntax and situation differ. A later successful check supports only this tested delay and condition.'}
];
export const CONTRAST_KEYS=Object.freeze(authored.map(t=>t.key));
export function contrastTask(key){
 const draft=authored.find(t=>t.key===key);if(!draft)return null;const t=clone(draft),source=provenance(t.key);
 const task={...t,id:`contrast:${t.key}`,version:EVIDENCE_TASK_VERSION,target:{id:`authored:ar:${t.target}`,language:'ar'},practiceMode:t.mode,inputModality:'text',outputModality:t.options?'choice':'text',assessmentScope:scope,
  occurrence:{contentId:'a-little-later',version:1,segmentId:'s6',annotationId:'a3',readingId:`authored:contrast:${t.key}`,context:{lexicalId:`authored:ar:${t.lexical}`,senseId:`authored:ar:${t.sense}`,speakerId:null,syntaxId:`authored:ar:${t.syntax}`,contextId:`authored:contrast:${t.key}`}},
  rubricRef:ref(`rubric:contrast:${t.key}`,fingerprint(t),source),scorerRef:ref(t.options?'nabu:authored-choice':'nabu:arabic-optional-vowels','v1',source),analysisRef:ref(`analysis:contrast:${t.key}`,fingerprint({draft:t,source}),source),
  requiredAssistance:t.baseMeaningSupplied?{baseMeaningSupplied:true}:{},qualityNote:'Small AI-assisted authored contrast, not instructor-reviewed or corpus-attested. The cited grammar supports the operation, not this exact task or a learning effect.'};
 task.score=scorer(task);return task;
}
export function resolveEvidenceTask(taskRef,event=null){
 if(!taskRef)return null;let task=null;
 if(taskRef.id.startsWith('contrast:'))task=contrastTask(taskRef.id.slice(9));
 else if(taskRef.id.startsWith('catalog:')){const [,id,activityId]=taskRef.id.split(':');task=catalogueEvidenceTask(X.itemById(id),activityId);}
 if(!task||task.version!==taskRef.version)return null;
 if(event){const actual=event.evidence?.occurrence,expected=task.occurrence;if(!actual||['contentId','version','segmentId','annotationId','readingId'].some(k=>actual[k]!==expected[k])||Object.keys(expected.context).some(k=>actual.context?.[k]!==expected.context[k]))return null;}
 return task;
}
export function contrastEligibility(task,projection,now){
 if(!task)return {available:false,reason:'No authored task is available.'};
 if(!Number.isSafeInteger(now)||now<0)return {available:false,reason:'A valid current time is required to check the task conditions.'};
 if(task.requires){const required=contrastTask(task.requires),evidence=projection?.targets.find(t=>t.target.id===required.target.id&&t.dimension===required.dimension&&t.practiceMode===required.practiceMode);
  if(!evidence||evidence.assessmentFreshness!=='within-policy-window'||evidence.lastAssessment?.outcome!=='correct')return {available:false,reason:'First check the meaning of this other base. Its presence in the graph is not learner evidence.'};}
 if(task.laterThan){const earlier=contrastTask(task.laterThan),rows=projection?.ledger.filter(r=>r.taskRef?.id===earlier.id&&r.counted)||[],last=rows.at(-1);if(!last||now-last.at<86400000)return {available:false,reason:'Available after a direct phrase check and at least 24 hours. This fixed delay is a task condition, not a forgetting estimate.'};}
 return {available:true,reason:task.baseMeaningSupplied?'Meaning is supplied; the response is recorded as assisted.':'The authored check can run with the recorded prompt and cues.'};
}
