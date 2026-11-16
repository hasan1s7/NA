/** Native API adapter. No token/password is stored in JavaScript or localStorage.
 * CapacitorHttp's native cookie jar receives the HttpOnly server cookie.
 * This adapter can call only /api/ on one build-time HTTPS backend origin.
 */
import {validateAPIOrigin} from '../public/nabu-links.js';
export function createTransport(origin,nativeRequest) {
 const base=validateAPIOrigin(origin);
 return async (path,options={})=>{
  if(typeof path!=='string'||!/^\/api\/[A-Za-z0-9_/-]+$/.test(path)||path.includes('//')||path.split('/').includes('..'))throw new Error('Invalid native API path.');
  const signal=options.signal;if(signal?.aborted)throw signal.reason||new DOMException('Request cancelled.','AbortError');
  const method=String(options.method||'GET').toUpperCase();
  if(!['GET','POST','PUT','PATCH','DELETE'].includes(method))throw new Error('Unsupported API method.');
  const headers={};for(const [key,value]of new Headers(options.headers||{})){
   if(['accept','content-type','x-csrf-token','x-nabu-account'].includes(key))headers[key]=value;
  }
  // Same-origin CSRF remains enforced for web. Native requests explicitly name
  // the configured origin; authentication still requires the HttpOnly cookie.
  headers.Origin=base;
  const audio=headers.accept==='audio/mpeg';
  let data;if(options.body!==undefined){try{data=JSON.parse(options.body);}catch{throw new Error('Native requests require JSON.');}}
  const pending=nativeRequest({url:base+path,method,headers,...(data!==undefined?{data}:{}),responseType:audio?'arraybuffer':'json',connectTimeout:15000,readTimeout:audio?50000:18000,disableRedirects:true});
  let abort;
  const cancelled=new Promise((_,reject)=>{abort=()=>reject(signal.reason||new DOMException('Request cancelled.','AbortError'));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();});
  try{
   const result=await Promise.race([pending,cancelled]);
   if(result.url&&new URL(result.url).origin!==base)throw new Error('The API tried to redirect away from your Nabu server.');
   if(!Number.isInteger(result.status)||result.status<200||result.status>599||result.status>=300&&result.status<400)throw new Error('Unexpected API response.');
   const responseHeaders=new Headers();
   for(const [key,value]of Object.entries(result.headers||{}))if(['content-type','retry-after','x-nabu-audio-cache','x-nabu-audio-model'].includes(key.toLowerCase()))responseHeaders.set(key,String(value));
   const contentType=responseHeaders.get('content-type')||'';
   let body;
   if(audio&&result.status<300&&!contentType.includes('json')){
    if(typeof result.data!=='string'||result.data.length>8*1024*1024)throw new Error('Unexpected audio response.');
    try{body=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0));}catch{throw new Error('Invalid audio data.');}
    responseHeaders.set('content-type','audio/mpeg');
   }else{
    body=typeof result.data==='string'?result.data:JSON.stringify(result.data);
    if(body?.length>16*1024*1024)throw new Error('The response exceeded the mobile size limit.');
    responseHeaders.set('content-type','application/json');
   }
   return new Response(result.status===204?null:body,{status:result.status,headers:responseHeaders});
  }finally{signal?.removeEventListener('abort',abort);}
 };
}
