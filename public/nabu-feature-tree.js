export const TREE = Object.freeze({
  id:'root',
  label:'What does the learner need right now?',
  children:[
    {id:'meaning-now',label:'Understand something now',children:[
      {id:'translate',label:'Translate',features:['Offline word graph','DeepL / MyMemory fallback','Sense disambiguation']},
      {id:'transliterate',label:'Read unfamiliar scripts',features:['Approximate transliteration','Pronunciation support']},
      {id:'concatenate',label:'Piece together known terms',features:['Term concatenation','Token-by-token explanation']}
    ]},
    {id:'context',label:'Understand language in context',children:[
      {id:'reader',label:'Read in context',features:['Paste text','Tap/select a word or phrase','Context-aware lookup']},
      {id:'phrases',label:'Learn expressions',features:['Phrase bank','Idioms with literal guide','Usage notes']}
    ]},
    {id:'explore',label:'Explore the language system',children:[
      {id:'graph',label:'Browse the word graph',features:['1026 linked meanings','Topic filters','Related concepts','Cross-language forms']},
      {id:'bank',label:'Build intuition',features:['Search','Categories','Starter words','Recent lookups']}
    ]},
    {id:'retain',label:'Retain and practice',children:[
      {id:'library',label:'Save what matters',features:['Auto-save translations','Personal library','Reference vs learning modes']},
      {id:'review',label:'Practice later',features:['SM-2-style scheduling','Recognition / production / listening / cloze','Daily queue']}
    ]},
    {id:'collab',label:'Work with other people',children:[
      {id:'friends',label:'Share and collaborate',features:['Friends','Shared collections','Proposals and corrections']}
    ]},
    {id:'control',label:'Control data and delivery',children:[
      {id:'data',label:'Own the data',features:['Full backup','Anki TSV export','Import','Persistent storage']},
      {id:'account',label:'Move across devices',features:['Account sync','Offline queue','Recovery code','Mobile shell']}
    ]}
  ]
});

function walk(node, parentId='', depth=0, out={nodes:[],edges:[]}){
  out.nodes.push({id:node.id,label:node.label,parentId,depth,features:[...(node.features||[])]});
  if(parentId) out.edges.push({from:parentId,to:node.id,type:'decision'});
  for(const child of node.children||[]) walk(child,node.id,depth+1,out);
  return out;
}

export function exportFeatureTree(){
  return walk(TREE);
}

export function featureTreeStats(){
  const data=exportFeatureTree();
  return {
    nodes:data.nodes.length,
    edges:data.edges.length,
    leaves:data.nodes.filter(n=>!data.edges.some(e=>e.from===n.id)).length,
    featureBullets:data.nodes.reduce((n,node)=>n+node.features.length,0)
  };
}
