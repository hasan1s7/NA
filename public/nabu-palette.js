/** Reviewed light-surface palette templates. No arbitrary CSS or remote assets. */
export const PALETTES = Object.freeze([
 {id:'green',name:'Original green',description:'Forest, mint and warm paper',accent:'#24624f'},
 {id:'lapis',name:'Lapis',description:'Deep blue and quiet stone',accent:'#324f7b'},
 {id:'clay',name:'Clay',description:'Terracotta and warm parchment',accent:'#854733'},
 {id:'plum',name:'Plum',description:'Muted violet and soft linen',accent:'#69446e'}
]);
export function normalizePalette(value){return PALETTES.some(p=>p.id===value)?value:'green';}
export function applyPalette(value,root=document.documentElement){
 const id=normalizePalette(value);root.dataset.nabuPalette=id;
 const meta=root.ownerDocument?.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=PALETTES.find(p=>p.id===id).accent;
 return id;
}
export function isPagesHost(hostname){return typeof hostname==='string'&&/(^|\.)github\.io$/i.test(hostname);}
