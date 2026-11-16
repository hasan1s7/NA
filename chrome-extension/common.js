export const LANGUAGES=[['en','English'],['es','Spanish'],['fr','French'],['ar','Arabic'],['zh-CN','Chinese'],['ru','Russian'],['de','German'],['it','Italian'],['ja','Japanese'],['ko','Korean'],['pt','Portuguese'],['tr','Turkish']];
export function serverOrigin(value){let u;try{u=new URL(String(value).trim());}catch{throw new Error('Enter your Nabu server address.');}if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname))))throw new Error('Use HTTPS, or http://127.0.0.1:8000 for your local server. No path, password or query.');return u.origin;}
export function sourceURL(value){if(!value)return '';let u;try{u=new URL(value);}catch{throw new Error('The source URL is invalid.');}if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw new Error('Only HTTP(S) source links are supported.');const safe=new URL(u.origin+u.pathname);if(/(^|\.)youtube\.com$/.test(u.hostname)&&u.pathname==='/watch'&&/^[A-Za-z0-9_-]{11}$/.test(u.searchParams.get('v')||''))safe.searchParams.set('v',u.searchParams.get('v'));return safe.href;}
export function capturePayload(draft,requestId){
 const front=String(draft.text||'').normalize('NFC').trim(),back=String(draft.meaning||'').normalize('NFC').trim();
 if(!front||!back)throw new Error('Add the selected text and its meaning before saving.');
 if(front.length>2000||back.length>2000)throw new Error('Save an excerpt of 2,000 characters or fewer.');
 if(!LANGUAGES.some(x=>x[0]===draft.sourceLang)||!LANGUAGES.some(x=>x[0]===draft.targetLang)||draft.sourceLang===draft.targetLang)throw new Error('Choose two different supported languages.');
 if((draft.context||'').length>1500||(draft.note||'').length>1000)throw new Error('Shorten the context to 1,500 characters and the note to 1,000.');
 const offset=draft.offsetSeconds===''||draft.offsetSeconds==null?null:Number(draft.offsetSeconds);
 if(offset!==null&&(!Number.isFinite(offset)||offset<0||offset>604800))throw new Error('Enter a valid source position in seconds.');
 return {requestId,content:{front,back,sourceLang:draft.sourceLang,targetLang:draft.targetLang,context:draft.context||'',note:draft.note||'',conceptId:draft.conceptId||'',deck:'From my media',learningMode:'reference',provenance:draft.provider||'Learner capture',reviewStatus:'draft'},sourceUrl:draft.includeSource===false?'':sourceURL(draft.sourceUrl||''),sourceTitle:String(draft.sourceTitle||'').slice(0,300),offsetSeconds:offset};
}
export function saveFingerprint(payload){const {requestId,...body}=payload;return JSON.stringify(body);}
export async function requestServer(config,path,{method='GET',body,signal}={}){
 const allowed={status:'GET',translate:'POST',capture:'POST',transcribe:'POST'};
 if(allowed[path]!==method)throw new Error('Unsupported extension request.');
 const origin=serverOrigin(config?.origin||'');if(!/^nabu_ext_[A-Za-z0-9_-]{40,100}$/.test(config?.token||''))throw new Error('Connect this extension in its settings first.');
 const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,path==='transcribe'?120000:35000);
 try{const response=await fetch(origin+'/api/extension/'+path,{method,redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+config.token,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await response.json();}catch{throw new Error('This address did not return a Nabu response.');}if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'The request failed. Your draft has been kept.');return data;}
 catch(error){if(error.name==='AbortError')throw new Error('Request timed out or was cancelled. Your draft remains here; retry manually.');throw error;}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
