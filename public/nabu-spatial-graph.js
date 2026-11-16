/** Nabu meaning map layout. Pure, testable and deliberately sparse. */
export const PALETTE=Object.freeze({ink:'#202e29',green:'#24624f',deep:'#194938',mint:'#e9f2e9',lime:'#dbe9ba',sand:'#f0eade',muted:'#718078',line:'#dfe6df',paper:'#f7f8f5'});
const RUSSIAN_PARTS={
 'expressions.fly_elephant':[
  {label:'делать',gloss:'to make / do'},
  {label:'из',gloss:'out of / from'},
  {label:'мухи',gloss:'of a fly (genitive)'},
  {label:'слона',gloss:'an elephant (accusative)'}
 ],
 'expressions.noodles_ears':[
  {label:'вешать',gloss:'to hang'},
  {label:'лапшу',gloss:'noodles (accusative)'},
  {label:'на уши',gloss:'on someone’s ears'}
 ]
};
export function expressionParts(concept,source){
 if(source==='ru'&&RUSSIAN_PARTS[concept.id])return RUSSIAN_PARTS[concept.id].map(x=>({...x,lang:source}));
 return [];
}
export function preferredLanguages(all,source,target,expanded=false){
 const priority=[target,'en','es','fr','ar','ja','ru','zh-CN','de','it','pt','ko','tr'];
 const candidates=[...new Set(priority.filter(x=>x&&x!==source&&all.includes(x)))];
 return expanded?candidates:candidates.slice(0,5);
}
export function scene(concept,languages,related,source,target,{expanded=false}={}){
 if(!concept)return {nodes:[],links:[],source,target};
 const center={id:'center',kind:'concept',label:concept.terms[source],sub:concept.sense,x:552,y:318,z:0};
 const nodes=[center],links=[];
 const components=expressionParts(concept,source);
 if(components.length){
  components.forEach((part,i)=>{
   const node={id:'component:'+i,kind:'component',label:part.label,sub:part.gloss,lang:source,x:170,y:175+i*92,z:-100};
   nodes.push(node);links.push({from:node.id,to:'center',kind:'component'});
  });
 }else{
  // These are semantic neighbors, not morphology. Make the relationship explicit.
  const curated=related.filter(x=>x?.concept?.id&&x.concept.id!==concept.id).slice(0,4);
  curated.forEach(({concept:c,relation},i)=>{
   const node={id:'related:'+c.id,kind:'related',conceptId:c.id,label:c.terms[source],sub:relation,x:170,y:185+i*108,z:-100};
   nodes.push(node);links.push({from:node.id,to:'center',kind:'semantic'});
  });
 }
 const langs=preferredLanguages(languages,source,target,expanded);
 langs.forEach((lang,i)=>{
  const expression=concept.kind==='expression';
  const value=expression?(concept.meaningTerms?.[lang]||concept.terms[lang]):concept.terms[lang];
  const x=expanded?(i%2?1090:895):986;
  const y=expanded?(125+Math.floor(i/2)*90):(134+i*91);
  const node={id:'language:'+lang,kind:'language',lang,label:value,sub:lang.toUpperCase(),x,y,z:120,index:i};
  nodes.push(node);links.push({from:'center',to:node.id,kind:'translation'});
 });
 const details=concept.details||{};
 const usage=[
  {id:'usage',label:'When to use it',sub:details.usage||concept.note||'No usage annotation yet'},
  {id:'example',label:'In context',sub:details.examples?.[source]||'No example available'},
  {id:'reply',label:'Possible reply',sub:details.replies?.[source]||'No response available'}
 ];
 usage.forEach((item,i)=>{
  const node={...item,kind:'usage',x:355+i*195,y:590,z:-170,index:i};
  nodes.push(node);links.push({from:'center',to:node.id,kind:'usage'});
 });
 return {nodes,links,source,target,center:concept.id,hasComponents:components.length>0,expanded};
}
export function project2D(node){return {x:node.x,y:node.y,depth:0};}
export function project3D(node,azimuth=25,tilt=28){
 // A restrained oblique projection: preserves readable column spacing rather
 // than collapsing every language form into an overlapping 3D pile.
 const a=azimuth*Math.PI/180,b=tilt*Math.PI/180;
 const offset=Math.sin(a)*node.z*.23;
 const depth=node.z+Math.sin(a)*(node.x-552)*.24;
 return {x:node.x+offset,y:node.y*.96+15-node.z*Math.sin(b)*.13,depth};
}
export function bounds(sceneData,mode='2d',azimuth=25,tilt=28){
 const points=sceneData.nodes.map(n=>mode==='3d'?project3D(n,azimuth,tilt):project2D(n));
 return {minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))};
}
