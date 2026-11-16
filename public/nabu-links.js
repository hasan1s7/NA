/* Shared URL rules. Pure functions: no history, network or browser globals. */
export const ROUTES = Object.freeze({explore:'explore',translate:'', reader:'read', graph:'words', library:'library', review:'review', exchange:'friends', settings:'settings'});
export function viewFromURL(href) {
 const u=new URL(href), old=u.searchParams.get('view');
 if(Object.hasOwn(ROUTES,old))return old;
 const part=u.hash.replace(/^#\/?/,'')||u.pathname.replace(/\/$/,'').split('/').pop();
 return Object.keys(ROUTES).find(key=>ROUTES[key]===part)||'translate';
}
export function appBase(href) {
 const u=new URL(href);u.search='';u.hash='';
 const match=u.pathname.match(/^(.*\/)(?:w\/[A-Za-z0-9_-]+|explore|translate|read|words|library|review|friends|settings)\/?$/);
 if(match)u.pathname=match[1];else u.pathname=u.pathname.slice(0,u.pathname.lastIndexOf('/')+1);
 return u;
}
export function viewURL(view,href,hosted=false) {
 const u=appBase(href),name=ROUTES[view]||'';
 if(hosted)u.pathname+=name;else if(name)u.hash=name;
 return u;
}
export function apiURL(path,href) {
 if(typeof path!=='string'||!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(path))throw new Error('Invalid API path.');
 return new URL('api/'+path,appBase(href));
}
export function shareSlug(href) {
 const u=new URL(href),match=u.pathname.match(/\/w\/([a-z0-9][a-z0-9-]{0,63}-[A-Za-z0-9_-]{16})\/?$/);
 return match?match[1]:null;
}
export function legacyShareToken(href) {
 const hash=new URL(href).hash;
 if(hash.startsWith('#share='))return hash.slice(7);
 if(hash.startsWith('#word/'))return hash.slice(6).split('.').slice(1).join('.');
 return null;
}
export function legacyShareURL(card,payload,href) {
 const u=appBase(href),slug=String(card.front||'word').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,36)||'word';
 u.hash=`word/${encodeURIComponent(slug)}.${payload}`;return u.href;
}
export function validateAPIOrigin(value,{allowEmpty=false}={}) {
 if(allowEmpty&&!value)return '';
 let u;try{u=new URL(value);}catch{throw new Error('Use the HTTPS origin of your full-stack Nabu server.');}
 if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!u.hostname||u.hostname==='localhost'||u.hostname.endsWith('.github.io'))throw new Error('Use an HTTPS backend origin without credentials, path, query or fragment; GitHub Pages is not an account server.');
 return u.origin;
}
export function incomingAppURL(value,apiOrigin) {
 const expected=validateAPIOrigin(apiOrigin);let u;try{u=new URL(value);}catch{return null;}
 if(u.origin!==expected||u.username||u.password)return null;
 if(shareSlug(u.href))return u.pathname;
 if(Object.values(ROUTES).includes(u.pathname.replace(/^\//,'').replace(/\/$/,'')))return u.pathname;
 return null;
}
