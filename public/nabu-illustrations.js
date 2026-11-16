import * as Art from './nabu-clipart.js';
/* Meaning IDs are authoritative. Never match only the spelling, URL or a keyword.
 * The initial provider is entirely local. An adapter is a developer seam, not a
 * fake Generate button or a configured image service. No credentials live here.
 */
export const ILLUSTRATION_STYLE = Object.freeze({
 version:'nabu-openmoji-1',name:'Nabu / quiet concept illustrations',
 composition:'One legible subject, isolated on a transparent background; no scene clutter or written labels.',
 treatment:'OpenMoji rounded black outlines and consistent original palette; small warm-neutral frame in Nabu. Preserve original artwork.',
 display:'56-96px secondary illustration; descriptive alt text; never a large empty placeholder.',
 future:'Use a separately versioned, licensed style for any future generated catalogue; do not silently mix styles.'
});
export function illustrationRequest(card={},concept={}){
 return {word:String(card.front||''),sourceLanguage:String(card.sourceLang||''),targetLanguage:String(card.targetLang||''),
  meaning:String(card.back||''),sourceSentence:String(card.context||''),conceptId:String(card.conceptId||''),
  sense:String(concept?.sense||''),kind:concept?.kind||'word',depiction:concept?.kind==='expression'?'intended':'concept',
  styleVersion:ILLUSTRATION_STYLE.version};
}
export function illustrationCandidates(request,assets=Art.CLIPART){
 if(!request.conceptId||!request.meaning.trim())return [];
 return assets.filter(a=>a.concepts.includes(request.conceptId)&&a.styleVersion===request.styleVersion&&
  (request.kind!=='expression'||a.depiction==='intended'));
}
export function selectedIllustration(card,assets=Art.CLIPART){
 if(!card?.imageId)return {status:'none',asset:null,message:''};
 if(card.imageDismissed?.includes(card.imageId))return {status:'rejected',asset:null,message:'You marked this illustration as incorrect for this meaning.'};
 const asset=assets.find(a=>a.id===card.imageId);
 if(!asset)return {status:'unavailable',asset:null,message:'The saved illustration is not in this catalogue. Your word and note are unchanged.'};
 if(card.conceptId&&!asset.concepts.includes(card.conceptId))return {status:'mismatch',asset:null,message:'The previous illustration belongs to a different meaning. Choose a suitable image or remove it.'};
 return {status:'ready',asset,message:card.conceptId?'Chosen for this dictionary meaning.':'Chosen by you for this meaning; check that it fits your source.'};
}
export function applyIllustrationChoice(card,id,assets=Art.CLIPART){
 if(!id)return {...card,imageId:''};
 const asset=assets.find(a=>a.id===id);if(!asset)throw new Error('That illustration is unavailable. Choose another or leave it blank.');
 if(card.conceptId&&!asset.concepts.includes(card.conceptId))throw new Error('This image represents a different dictionary meaning. Change the meaning first.');
 return {...card,imageId:id,imageDismissed:(card.imageDismissed||[]).filter(x=>x!==id)};
}
export function rejectIllustration(card){
 if(!card.imageId)return {...card};
 return {...card,imageId:'',imageDismissed:[...new Set([...(card.imageDismissed||[]),card.imageId])].slice(-24)};
}
export function illustrationCacheKey(request){
 if(!request.conceptId)return null;
 return JSON.stringify([request.conceptId,request.styleVersion,request.depiction]);
}
function validateAsset(asset,request){
 // Provider implementations must persist a reviewed local asset first. Remote
 // URLs, raw SVG markup and unlicensed results never enter this view.
 if(!asset||!asset.id||!asset.alt||!asset.license||!asset.source||!asset.concepts?.includes(request.conceptId)||asset.styleVersion!==request.styleVersion||asset.depiction!==request.depiction||
  !(/^data:image\/(?:svg\+xml|png|webp);base64,/.test(asset.src||'')||/^\/clipart\/[a-z0-9_-]+\.(?:svg|png|webp)$/.test(asset.src||'')))throw new Error('The provider did not return a safe, licensed image for this exact meaning.');
 return asset;
}
export function createIllustrationService({assets=Art.CLIPART,provider=null,cache=new Map()}={}){
 const pending=new Map();let epoch=0;
 return {
  async request(request,{authorization=null}={}){
   const existing=illustrationCandidates(request,assets)[0];if(existing)return {status:'ready',asset:existing,reused:true,source:'bundled'};
   const key=illustrationCacheKey(request);
   if(!key)return {status:'unavailable',asset:null,message:'Choose a specific meaning first. Spelling alone is not an image concept.'};
   if(!provider)return {status:'unavailable',asset:null,message:'No bundled illustration for this meaning. Image generation is not connected; nothing was sent.'};
   // Consent is checked before serving provider-cache or pending private results.
   if(authorization?.providerId!==provider.id||authorization.allowSourceContent!==true)return {status:'unauthorized',asset:null,message:'An authorized provider and explicit source-content consent are required.'};
   if(cache.has(key))return {status:'ready',asset:cache.get(key),reused:true,source:'provider-cache'};
   if(pending.has(key))return pending.get(key);
   const generation=epoch;
   const promise=Promise.resolve().then(()=>provider.generate({...request,style:ILLUSTRATION_STYLE})).then(result=>{
    const asset=validateAsset(result,request);
    if(generation!==epoch)return {status:'cancelled',asset:null,message:'The account or request scope changed.'};
    cache.set(key,asset);return {status:'ready',asset,reused:false,source:'provider'};
   }).catch(error=>({status:'error',asset:null,message:error?.message||'Illustration failed. Retry when ready.'})).finally(()=>{if(pending.get(key)===promise)pending.delete(key);});
   pending.set(key,promise);return promise;
  },
  clear(){epoch++;cache.clear();pending.clear();}
 };
}
export function createIllustrationSelection(service){
 let generation=0;
 return {async select(request,options={}){const id=++generation;const result=await service.request(request,options);return id===generation?result:{status:'stale',asset:null};},cancel(){generation++;}};
}
